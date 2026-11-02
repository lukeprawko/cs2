import { NavGraph } from '../engine/NavGraph';
import { PhysicsWorld } from '../engine/Physics';
import { BOMBSITE_ZONES, PLAYER_DIMENSIONS } from '../world/DustAlleyMap';
import { BotDifficulty } from '../store/useSettingsStore';
import { BombData, BOMB_CONSTANTS } from './BombLogic';
import { Team, WEAPONS_DB, WeaponId } from './WeaponsDB';

export type TacticalRole = 'entry' | 'support' | 'sniper' | 'lurker' | 'anchor';

export type RoundStrategyT =
  | 'RUSH_A'
  | 'RUSH_B'
  | 'MID_TO_A_SPLIT'
  | 'MID_CONTROL'
  | 'SLOW_DEFAULT';

export interface ActorState {
  id: string;
  name: string;
  team: Team;
  isBot: boolean;
  role: TacticalRole;
  alive: boolean;
  hp: number;
  armor: number;
  hasHelmet: boolean;
  hasDefuseKit: boolean;
  hasC4: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  ping: number;

  // Spatial kinematics
  position: [number, number, number];
  velocity: [number, number, number];
  yaw: number;
  pitch: number;
  grounded: boolean;
  crouching: boolean;
  walking: boolean;
  walkCycle: number;

  // Weapons & combat
  activeWeapon: WeaponId;
  primaryWeapon: WeaponId | null;
  secondaryWeapon: WeaponId;
  grenades: WeaponId[];
  ammoMag: Record<WeaponId, number>;
  ammoReserve: Record<WeaponId, number>;
  fireCooldown: number;
  reloadTimer: number;
  deployTimer: number;
  recoilPitch: number;
  recoilYaw: number;
  zoomLevel: number;
  flashBlindTimer: number;
  hitFlashTimer: number;
  koTimer: number; // >0 while playing KO topple animation after death

  // AI Perception & Navigation
  spottedUntil: number; // timestamp up to which this actor is visible on enemy radar
  path: Array<[number, number, number]>;
  pathCursor: number;
  repathTimer: number;
  targetEnemyId: string | null;
  reactionTimer: number;
  lastKnownEnemyPos: [number, number, number] | null;
  assignedSite: 'A' | 'B' | 'MID';
  strafeDir: number;
  strafeTimer: number;
  utilityCooldown: number;
  UtilityThrowInternal?: () => void;
}

const DIFFICULTY_PARAMS: Record<
  BotDifficulty,
  {
    reactionDelay: number;
    aimSpreadRad: number;
    burstLength: number;
    recoilCompensation: number;
    turnSpeed: number;
  }
> = {
  easy: {
    reactionDelay: 0.52,
    aimSpreadRad: 0.085,
    burstLength: 3,
    recoilCompensation: 0.35,
    turnSpeed: 4.5,
  },
  medium: {
    reactionDelay: 0.34,
    aimSpreadRad: 0.048,
    burstLength: 5,
    recoilCompensation: 0.6,
    turnSpeed: 7.0,
  },
  hard: {
    reactionDelay: 0.21,
    aimSpreadRad: 0.025,
    burstLength: 7,
    recoilCompensation: 0.8,
    turnSpeed: 10.5,
  },
  expert: {
    reactionDelay: 0.125,
    aimSpreadRad: 0.012,
    burstLength: 9,
    recoilCompensation: 0.94,
    turnSpeed: 15.0,
  },
};

export const BOT_NAMES_CT = ['Phoenix', 'Valkyrie', 'Sentinel', 'Cipher', 'Aegis'];
export const BOT_NAMES_T = ['Kobra', 'mirage', 'Viper', 'Sabre', 'Nomad'];

export function pickRoundStrategyT(): RoundStrategyT {
  const r = Math.random();
  if (r < 0.28) return 'RUSH_A';
  if (r < 0.54) return 'RUSH_B';
  if (r < 0.74) return 'MID_TO_A_SPLIT';
  if (r < 0.88) return 'MID_CONTROL';
  return 'SLOW_DEFAULT';
}

export interface BotActions {
  onFireWeapon: (bot: ActorState) => void;
  onThrowGrenade: (bot: ActorState, grenadeId: WeaponId, targetPos: [number, number, number]) => void;
  onRadioCallout: (bot: ActorState, text: string) => void;
}

/**
 * Updates a single Bot AI inside the central GameLoop (zero React state allocations).
 */
export function updateBotAI(
  bot: ActorState,
  allActors: ActorState[],
  bomb: BombData,
  roundPhase: 'buy' | 'live' | 'planted' | 'round_end' | 'match_end',
  tStrategy: RoundStrategyT,
  difficulty: BotDifficulty,
  physics: PhysicsWorld,
  nav: NavGraph,
  smokeClouds: Array<{ position: [number, number, number]; radius: number }>,
  nowSec: number,
  dt: number,
  actions: BotActions
): void {
  if (!bot.alive) return;

  // During buy phase, bots wait in spawn and prepare weapons
  if (roundPhase === 'buy') {
    const desiredWeapon = bot.primaryWeapon || bot.secondaryWeapon;
    if (bot.activeWeapon !== desiredWeapon) {
      bot.activeWeapon = desiredWeapon;
    }
    physics.stepCharacter(bot, 0, 0, 0, false, dt);
    return;
  }

  const params = DIFFICULTY_PARAMS[difficulty];
  bot.utilityCooldown = Math.max(0, bot.utilityCooldown - dt);

  // Reload if magazine empty
  const activeSpec = WEAPONS_DB[bot.activeWeapon];
  if (
    activeSpec.category !== 'melee' &&
    activeSpec.category !== 'grenade' &&
    bot.ammoMag[bot.activeWeapon] <= 0 &&
    bot.ammoReserve[bot.activeWeapon] > 0 &&
    bot.reloadTimer <= 0
  ) {
    bot.reloadTimer = activeSpec.reloadTime;
  }

  // If blinded by flashbang, strafe randomly and cannot see enemies
  const isBlinded = bot.flashBlindTimer > 0.35;

  // 1. PERCEPTION: Scan for visible enemies within FOV cone
  let visibleEnemy: ActorState | null = null;
  let closestDist = Infinity;

  const eyeY =
    bot.position[1] +
    (bot.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
  const lookX = -Math.sin(bot.yaw);
  const lookZ = -Math.cos(bot.yaw);

  if (!isBlinded) {
    for (let i = 0; i < allActors.length; i++) {
      const other = allActors[i];
      if (!other.alive || other.team === bot.team) continue;

      const dx = other.position[0] - bot.position[0];
      const dy = other.position[1] + 1.2 - eyeY;
      const dz = other.position[2] - bot.position[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 68) continue;

      // FOV cone check (~125 deg) and close-range acoustic awareness (< 11m if moving fast)
      const dot = (dx * lookX + dz * lookZ) / Math.max(0.001, Math.hypot(dx, dz));
      const otherSpeed = Math.hypot(other.velocity[0], other.velocity[2]);
      const heardClose = dist < 12 && otherSpeed > 2.8 && !other.walking;

      if (dot > -0.15 || heardClose) {
        if (
          physics.hasLineOfSight(
            bot.position[0],
            eyeY,
            bot.position[2],
            other.position[0],
            other.position[1] + 1.25,
            other.position[2],
            smokeClouds
          )
        ) {
          other.spottedUntil = Math.max(other.spottedUntil, nowSec + 3.5);
          if (dist < closestDist) {
            closestDist = dist;
            visibleEnemy = other;
          }
        }
      }
    }
  }

  // 2. TARGET TRACKING & REACTION
  if (visibleEnemy) {
    if (bot.targetEnemyId !== visibleEnemy.id) {
      bot.targetEnemyId = visibleEnemy.id;
      bot.reactionTimer = params.reactionDelay * (0.85 + Math.random() * 0.3);
      if (Math.random() < 0.25 && bot.utilityCooldown <= 0) {
        const spotLoc =
          visibleEnemy.position[0] > 14
            ? 'A'
            : visibleEnemy.position[0] < -14
            ? 'B'
            : 'Mid';
        actions.onRadioCallout(bot, `Wróg zauważony na ${spotLoc}!`);
        bot.utilityCooldown = 6.0;
      }
    }
    bot.lastKnownEnemyPos = [
      visibleEnemy.position[0],
      visibleEnemy.position[1],
      visibleEnemy.position[2],
    ];
    bot.reactionTimer = Math.max(0, bot.reactionTimer - dt);

    // Tactical grenade usage before engaging at medium range
    if (
      bot.grenades.length > 0 &&
      bot.utilityCooldown <= 0 &&
      closestDist > 13 &&
      closestDist < 32 &&
      Math.random() < 0.015
    ) {
      const nade = bot.grenades[0];
      bot.UtilityThrowInternal?.();
      actions.onThrowGrenade(bot, nade, [
        visibleEnemy.position[0],
        visibleEnemy.position[1] + 0.5,
        visibleEnemy.position[2],
      ]);
      bot.utilityCooldown = 8.0;
    }

    // Smoothly turn towards enemy head/chest
    const aimHeight =
      difficulty === 'expert' || difficulty === 'hard' ? 1.48 : 1.18;
    const tx = visibleEnemy.position[0] - bot.position[0];
    const ty = visibleEnemy.position[1] + aimHeight - eyeY;
    const tz = visibleEnemy.position[2] - bot.position[2];
    const desiredYaw = Math.atan2(-tx, -tz);
    const desiredPitch = Math.atan2(ty, Math.hypot(tx, tz));

    let yawDiff = desiredYaw - bot.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    const turnStep = Math.min(1, params.turnSpeed * dt);
    bot.yaw += yawDiff * turnStep;
    bot.pitch += (desiredPitch - bot.pitch) * turnStep;

    // Fire when reaction timer elapsed and aim is reasonably aligned
    if (
      bot.reactionTimer <= 0 &&
      Math.abs(yawDiff) < 0.26 &&
      bot.reloadTimer <= 0 &&
      bot.deployTimer <= 0 &&
      bot.fireCooldown <= 0
    ) {
      // Switch from C4/grenade to primary or secondary when attacked
      if (bot.activeWeapon === 'c4' || WEAPONS_DB[bot.activeWeapon].category === 'grenade') {
        bot.activeWeapon = bot.primaryWeapon || bot.secondaryWeapon;
      } else {
        actions.onFireWeapon(bot);
      }
    }
  } else {
    bot.targetEnemyId = null;
  }

  // 3. OBJECTIVE LOGIC: C4 PLANTING (T) & DEFUSING (CT)
  // T Bot carrying C4 inside Bombsite A or B plants the bomb!
  if (bot.team === 'T' && bot.hasC4 && bomb.state === 'carried' && !visibleEnemy) {
    const siteZone =
      bot.assignedSite === 'B' ? BOMBSITE_ZONES.B : BOMBSITE_ZONES.A;
    const centerA: [number, number] = [
      (BOMBSITE_ZONES.A.minX + BOMBSITE_ZONES.A.maxX) * 0.5,
      (BOMBSITE_ZONES.A.minZ + BOMBSITE_ZONES.A.maxZ) * 0.5,
    ];
    const centerB: [number, number] = [
      (BOMBSITE_ZONES.B.minX + BOMBSITE_ZONES.B.maxX) * 0.5,
      (BOMBSITE_ZONES.B.minZ + BOMBSITE_ZONES.B.maxZ) * 0.5,
    ];
    const targetSiteCenter = bot.assignedSite === 'B' ? centerB : centerA;
    const distToSite = Math.hypot(
      bot.position[0] - targetSiteCenter[0],
      bot.position[2] - targetSiteCenter[1]
    );

    if (
      distToSite < 3.0 &&
      bot.position[0] >= siteZone.minX &&
      bot.position[0] <= siteZone.maxX &&
      bot.position[2] >= siteZone.minZ &&
      bot.position[2] <= siteZone.maxZ
    ) {
      // Stop and plant C4
      bot.crouching = true;
      physics.stepCharacter(bot, 0, 0, 0, false, dt);
      if (bomb.planterId === null || bomb.planterId === bot.id) {
        if (bomb.planterId !== bot.id) {
          bomb.planterId = bot.id;
          bomb.plantProgress = 0;
          actions.onRadioCallout(bot, 'Podkładam ładunek C4!');
        }
        bomb.plantProgress += dt / BOMB_CONSTANTS.PLANT_TIME;
      }
      return;
    }
  }

  // CT Bot defusing planted C4 when close to it and no immediate visible enemy
  if (bot.team === 'CT' && bomb.state === 'planted') {
    const distToBomb = Math.hypot(
      bot.position[0] - bomb.position[0],
      bot.position[2] - bomb.position[2]
    );
    if (distToBomb < BOMB_CONSTANTS.INTERACTION_RADIUS && !visibleEnemy) {
      if (bomb.defuserId === null || bomb.defuserId === bot.id) {
        bot.crouching = true;
        physics.stepCharacter(bot, 0, 0, 0, false, dt);
        if (bomb.defuserId !== bot.id) {
          bomb.defuserId = bot.id;
          bomb.defuserHasKit = bot.hasDefuseKit;
          bomb.defuseProgress = 0;
          actions.onRadioCallout(bot, 'Rozbrajam bombę! Osłaniajcie mnie!');
        }
        const reqTime = bot.hasDefuseKit
          ? BOMB_CONSTANTS.DEFUSE_TIME_WITH_KIT
          : BOMB_CONSTANTS.DEFUSE_TIME_NO_KIT;
        bomb.defuseProgress += dt / reqTime;
        return;
      }
    }
  }

  // 4. NAVIGATION GOAL SELECTION & A* PATH FOLLOWING
  bot.repathTimer -= dt;
  if (bot.repathTimer <= 0 || bot.path.length === 0) {
    bot.repathTimer = 1.6 + Math.random() * 0.8;
    const goal = computeBotGoal(bot, bomb, tStrategy);
    bot.path = nav.findPath(bot.position[0], bot.position[2], goal[0], goal[1]);
    bot.pathCursor = 0;
  }

  let wishX = 0;
  let wishZ = 0;

  // In combat: tactical strafe / crouch-peek instead of running blindly
  if (visibleEnemy && closestDist < 26) {
    bot.strafeTimer -= dt;
    if (bot.strafeTimer <= 0) {
      bot.strafeTimer = 0.55 + Math.random() * 0.65;
      bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
      bot.crouching = Math.random() < 0.32;
    }
    const rightX = Math.cos(bot.yaw);
    const rightZ = -Math.sin(bot.yaw);
    wishX = rightX * bot.strafeDir;
    wishZ = rightZ * bot.strafeDir;
  } else if (bot.pathCursor < bot.path.length) {
    bot.crouching = false;
    const targetWp = bot.path[bot.pathCursor];
    const dx = targetWp[0] - bot.position[0];
    const dz = targetWp[2] - bot.position[2];
    const dist = Math.hypot(dx, dz);

    if (dist < 1.35) {
      bot.pathCursor++;
    } else {
      wishX = dx / dist;
      wishZ = dz / dist;

      // Look along movement direction if no enemy visible
      if (!visibleEnemy) {
        const moveYaw = Math.atan2(-wishX, -wishZ);
        let diff = moveYaw - bot.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.yaw += diff * Math.min(1, 6.5 * dt);
        bot.pitch += (0 - bot.pitch) * Math.min(1, 5.0 * dt);
      }
    }
  }

  const maxSpeed = WEAPONS_DB[bot.activeWeapon].moveSpeed * (bot.crouching ? 0.52 : 0.92);
  physics.stepCharacter(bot, wishX, wishZ, maxSpeed, false, dt);

  const horizSpeed = Math.hypot(bot.velocity[0], bot.velocity[2]);
  bot.walkCycle += horizSpeed * dt * 1.9;
}

function computeBotGoal(
  bot: ActorState,
  bomb: BombData,
  tStrategy: RoundStrategyT
): [number, number] {
  // If bomb is planted, everyone converges on the planted bomb site!
  if (bomb.state === 'planted') {
    const jitterX = (Math.random() - 0.5) * 3.5;
    const jitterZ = (Math.random() - 0.5) * 3.5;
    if (bot.team === 'CT') {
      // First CT goes straight to bomb to defuse
      return [bomb.position[0], bomb.position[2]];
    }
    // T bots guard around planted bomb
    return [bomb.position[0] + jitterX, bomb.position[2] + jitterZ];
  }

  // If bomb is dropped on ground, T bots go pick it up
  if (bot.team === 'T' && bomb.state === 'dropped') {
    return [bomb.position[0], bomb.position[2]];
  }

  const siteACenter: [number, number] = [
    (BOMBSITE_ZONES.A.minX + BOMBSITE_ZONES.A.maxX) * 0.5,
    (BOMBSITE_ZONES.A.minZ + BOMBSITE_ZONES.A.maxZ) * 0.5,
  ];
  const siteBCenter: [number, number] = [
    (BOMBSITE_ZONES.B.minX + BOMBSITE_ZONES.B.maxX) * 0.5,
    (BOMBSITE_ZONES.B.minZ + BOMBSITE_ZONES.B.maxZ) * 0.5,
  ];

  // T Team strategies
  if (bot.team === 'T') {
    if (tStrategy === 'RUSH_A') {
      bot.assignedSite = 'A';
      return [
        siteACenter[0] + (Math.random() - 0.5) * 2.5,
        siteACenter[1] + (Math.random() - 0.5) * 2.5,
      ];
    }
    if (tStrategy === 'RUSH_B') {
      bot.assignedSite = 'B';
      return [
        siteBCenter[0] + (Math.random() - 0.5) * 2.5,
        siteBCenter[1] + (Math.random() - 0.5) * 2.5,
      ];
    }
    if (tStrategy === 'MID_TO_A_SPLIT') {
      bot.assignedSite = 'A';
      return bot.role === 'lurker' || bot.role === 'support'
        ? [7.5, -10.5]
        : [siteACenter[0], siteACenter[1]];
    }
    // Default / Mid Control
    if (bot.assignedSite === 'B') return [siteBCenter[0], siteBCenter[1]];
    return [siteACenter[0], siteACenter[1]];
  }

  // CT Team defensive setups (2 A, 2 B, 1 Mid/Rotator)
  if (bot.assignedSite === 'A') {
    return bot.role === 'anchor'
      ? [siteACenter[0] + 1.5, siteACenter[1] - 1.2]
      : [8.5, -10.5];
  }
  if (bot.assignedSite === 'B') {
    return bot.role === 'anchor'
      ? [siteBCenter[0] - 1.2, siteBCenter[1] - 1.2]
      : [-15.5, -6.5];
  }
  // Mid rotator
  return [-1.8 + (Math.random() - 0.5) * 2.5, -9.5];
}
