import { audioEngine } from './AudioEngine';
import { InputManager, requestPointerLockSafe } from './InputManager';
import { NavGraph } from './NavGraph';
import { ObjectPool } from './ObjectPool';
import { PhysicsWorld } from './Physics';
import {
  ActorState,
  BOT_NAMES_CT,
  BOT_NAMES_T,
  pickRoundStrategyT,
  RoundStrategyT,
  TacticalRole,
  updateBotAI,
} from '../game/BotAI';
import {
  BOMB_CONSTANTS,
  BombData,
  createInitialBombData,
  getBombBeepInterval,
  getBombExplosionDamage,
} from '../game/BombLogic';
import {
  calculateHitDamage,
  clampMoney,
  ECONOMY_CONSTANTS,
  EQUIPMENT_DB,
  executeBotAutoBuy,
  getLossBonus,
  HitboxZone,
} from '../game/Economy';
import { multiplayerClient } from '../game/MultiplayerClient';
import {
  getStartingPistol,
  Team,
  WEAPONS_DB,
  WeaponId,
} from '../game/WeaponsDB';
import {
  BUY_ZONES,
  CT_SPAWNS,
  getActiveBombSite,
  isPointInZone,
  PLAYER_DIMENSIONS,
  T_SPAWNS,
} from '../world/DustAlleyMap';
import { RoundPhase, useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';

export interface ActiveGrenade {
  id: string;
  type: 'he_grenade' | 'flashbang' | 'smoke_grenade';
  throwerId: string;
  throwerTeam: Team;
  position: [number, number, number];
  velocity: [number, number, number];
  fuseTimer: number;
  detonated: boolean;
}

export interface SmokeCloud {
  id: string;
  position: [number, number, number];
  radius: number;
  timeRemaining: number;
}

export interface PooledParticle {
  active: boolean;
  position: [number, number, number];
  velocity: [number, number, number];
  color: number;
  size: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface PooledDecal {
  active: boolean;
  position: [number, number, number];
  normal: [number, number, number];
  scale: number;
}

export interface PooledTracer {
  active: boolean;
  start: [number, number, number];
  end: [number, number, number];
  life: number;
}

/**
 * Central Game Simulation Controller (60-120Hz fixed/clamped update).
 * Keeps all high-frequency state in mutable arrays/objects and syncs
 * low-frequency summaries to Zustand every ~80ms or on discrete events.
 */
export class GameSimulation {
  public physics = new PhysicsWorld();
  public nav = new NavGraph();
  public input = new InputManager();

  public actors: ActorState[] = [];
  public localPlayerId = 'local_player';
  public spectateIndex = 0;

  public roundPhase: RoundPhase = 'buy';
  public roundNumber = 1;
  public maxRounds = 24;
  public ctScore = 0;
  public tScore = 0;
  public ctConsecutiveLosses = 0;
  public tConsecutiveLosses = 0;
  public phaseTimer = 5.0;
  public tStrategy: RoundStrategyT = 'RUSH_A';

  public bomb: BombData = createInitialBombData(null, [0, 0, 36]);
  public grenades: ActiveGrenade[] = [];
  public smokeClouds: SmokeCloud[] = [];
  public droppedC4Rotation = 0;

  // Zero-GC pools for visual effects
  public particlePool = new ObjectPool<PooledParticle>(160, () => ({
    active: false,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    color: 0xf59e0b,
    size: 0.06,
    life: 0,
    maxLife: 0.5,
    gravity: 9.8,
  }));

  public decalPool = new ObjectPool<PooledDecal>(64, () => ({
    active: false,
    position: [0, 0, 0],
    normal: [0, 1, 0],
    scale: 0.14,
  }));

  public tracerPool = new ObjectPool<PooledTracer>(24, () => ({
    active: false,
    start: [0, 0, 0],
    end: [0, 0, 0],
    life: 0,
  }));

  // Viewmodel & camera juice state
  public muzzleFlashTimer = 0;
  public viewPunchPitch = 0;
  public viewPunchRoll = 0;
  public cameraTrauma = 0; // screen shake from explosions
  public hitstopTimer = 0; // brief 0.03s hitstop on kills/headshots
  public lastWeaponSlot: WeaponId = 'knife';
  public knifeSwingCount = 0;
  public lastKnifeHeavy = false;

  private hudSyncAccumulator = 0;
  private netSendAccumulator = 0;
  private footstepAccumulator = 0;
  private elapsedSec = 0;
  private fireClickBufferTimer = 0;

  constructor() {
    this.input.onUserExitedPointerLock = () => {
      const store = useGameStore.getState();
      if (store.screenState === 'playing' && !store.buyMenuOpen) {
        store.setScreenState('paused');
      }
    };
    multiplayerClient.onMatchStartCallback = (snap) => {
      this.applyMultiplayerSnapshot(snap, true);
    };
    multiplayerClient.onRemoteShotCallback = (_shooterId, _weaponId, origin, target) => {
      this.spawnTracer(origin, target);
    };
    multiplayerClient.onRemoteGrenadeThrowCallback = (data) => {
      if (this.grenades.length >= 16) {
        this.grenades.shift();
      }
      this.grenades.push({
        id: `nade_${Date.now()}_${Math.random()}`,
        type: data.nadeId as ActiveGrenade['type'],
        throwerId: data.throwerId,
        throwerTeam: data.throwerTeam,
        position: [...data.origin],
        velocity: [...data.velocity],
        fuseTimer: data.nadeId === 'flashbang' ? 1.5 : 2.1,
        detonated: false,
      });
    };
  }

  public startOfflineMatch(): void {
    const settings = useSettingsStore.getState();
    this.maxRounds = settings.matchLength === 'MR12' ? 24 : 30;
    this.roundNumber = 1;
    this.ctScore = 0;
    this.tScore = 0;
    this.ctConsecutiveLosses = 0;
    this.tConsecutiveLosses = 0;
    useGameStore.getState().updateHUD({
      isMultiplayer: false,
      maxRounds: this.maxRounds,
      killFeed: [],
      radioFeed: [],
      roundEndSummary: null,
    });

    this.buildRoster(settings.preferredTeam, settings.playerName);
    this.startNewRound(true);
    useGameStore.getState().setScreenState('playing');
  }

  public buildRoster(playerTeam: Team, playerName: string): void {
    this.actors = [];
    const roles: TacticalRole[] = ['entry', 'sniper', 'support', 'lurker', 'anchor'];

    // Create 5 CT and 5 T actors
    for (let i = 0; i < 5; i++) {
      const isLocalCT = playerTeam === 'CT' && i === 0;
      this.actors.push(
        this.createFreshActor(
          isLocalCT ? this.localPlayerId : `bot_ct_${i}`,
          isLocalCT ? playerName : BOT_NAMES_CT[i],
          'CT',
          !isLocalCT,
          roles[i],
          i < 2 ? 'A' : i < 4 ? 'B' : 'MID'
        )
      );
    }

    for (let i = 0; i < 5; i++) {
      const isLocalT = playerTeam === 'T' && i === 0;
      this.actors.push(
        this.createFreshActor(
          isLocalT ? this.localPlayerId : `bot_t_${i}`,
          isLocalT ? playerName : BOT_NAMES_T[i],
          'T',
          !isLocalT,
          roles[i],
          i < 3 ? 'A' : 'B'
        )
      );
    }
  }

  private createFreshActor(
    id: string,
    name: string,
    team: Team,
    isBot: boolean,
    role: TacticalRole,
    assignedSite: 'A' | 'B' | 'MID'
  ): ActorState {
    const startPistol = getStartingPistol(team);
    const magMap = {} as Record<WeaponId, number>;
    const resMap = {} as Record<WeaponId, number>;
    (Object.keys(WEAPONS_DB) as WeaponId[]).forEach((wId) => {
      magMap[wId] = WEAPONS_DB[wId].magSize;
      resMap[wId] = WEAPONS_DB[wId].reserveAmmo;
    });

    return {
      id,
      name,
      team,
      isBot,
      role,
      alive: true,
      hp: 100,
      armor: 0,
      hasHelmet: false,
      hasDefuseKit: false,
      hasC4: false,
      money: ECONOMY_CONSTANTS.START_MONEY,
      kills: 0,
      deaths: 0,
      assists: 0,
      mvps: 0,
      ping: isBot ? 0 : 18,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      yaw: team === 'CT' ? Math.PI : 0,
      pitch: 0,
      grounded: true,
      crouching: false,
      walking: false,
      walkCycle: 0,
      activeWeapon: startPistol,
      primaryWeapon: null,
      secondaryWeapon: startPistol,
      grenades: [],
      ammoMag: magMap,
      ammoReserve: resMap,
      fireCooldown: 0,
      reloadTimer: 0,
      deployTimer: 0,
      recoilPitch: 0,
      recoilYaw: 0,
      zoomLevel: 0,
      flashBlindTimer: 0,
      hitFlashTimer: 0,
      koTimer: 0,
      spottedUntil: 0,
      path: [],
      pathCursor: 0,
      repathTimer: 0,
      targetEnemyId: null,
      reactionTimer: 0,
      lastKnownEnemyPos: null,
      assignedSite,
      strafeDir: 1,
      strafeTimer: 0,
      utilityCooldown: 0,
    };
  }

  public startNewRound(resetEconomy = false): void {
    this.input.clearAll();
    this.roundPhase = 'buy';
    this.phaseTimer = 5.0; // 5s buy phase (fast competitive start)
    this.tStrategy = pickRoundStrategyT();
    this.grenades = [];
    this.smokeClouds = [];
    this.particlePool.clearAll();
    this.tracerPool.clearAll();
    this.decalPool.clearAll();
    useGameStore.getState().updateHUD({ roundEndSummary: null, buyMenuOpen: false });

    let ctIdx = 0;
    let tIdx = 0;
    const tActors = this.actors.filter((a) => a.team === 'T');
    const c4Carrier = tActors[Math.floor(Math.random() * tActors.length)];

    for (const actor of this.actors) {
      const spawn =
        actor.team === 'CT'
          ? CT_SPAWNS[ctIdx++ % CT_SPAWNS.length]
          : T_SPAWNS[tIdx++ % T_SPAWNS.length];

      const survivedPrevious = actor.alive && !resetEconomy;
      actor.alive = true;
      actor.hp = 100;
      actor.koTimer = 0;
      actor.position = [spawn.x, spawn.y, spawn.z];
      actor.velocity = [0, 0, 0];
      actor.yaw = spawn.yaw;
      actor.pitch = 0;
      actor.crouching = false;
      actor.walking = false;
      actor.recoilPitch = 0;
      actor.recoilYaw = 0;
      actor.zoomLevel = 0;
      actor.flashBlindTimer = 0;
      actor.fireCooldown = 0;
      actor.reloadTimer = 0;
      actor.path = [];
      actor.targetEnemyId = null;

      if (resetEconomy || !survivedPrevious) {
        actor.armor = 0;
        actor.hasHelmet = false;
        actor.hasDefuseKit = false;
        actor.primaryWeapon = null;
        actor.secondaryWeapon = getStartingPistol(actor.team);
        actor.grenades = [];
        if (resetEconomy) {
          actor.money = ECONOMY_CONSTANTS.START_MONEY;
        }
      }

      actor.hasC4 = c4Carrier ? actor.id === c4Carrier.id : false;

      // Bots perform auto-buy at start of buy phase
      if (actor.isBot) {
        const bought = executeBotAutoBuy(
          {
            money: actor.money,
            team: actor.team,
            primary: actor.primaryWeapon,
            secondary: actor.secondaryWeapon,
            grenades: actor.grenades,
            armor: actor.armor,
            hasHelmet: actor.hasHelmet,
            hasDefuseKit: actor.hasDefuseKit,
          },
          actor.role === 'sniper'
        );
        actor.money = bought.money;
        actor.primaryWeapon = bought.primary;
        actor.secondaryWeapon = bought.secondary;
        actor.grenades = bought.grenades;
        actor.armor = bought.armor;
        actor.hasHelmet = bought.hasHelmet;
        actor.hasDefuseKit = bought.hasDefuseKit;
      }

      // Refill all magazines & reserves
      (Object.keys(WEAPONS_DB) as WeaponId[]).forEach((wId) => {
        actor.ammoMag[wId] = WEAPONS_DB[wId].magSize;
        actor.ammoReserve[wId] = WEAPONS_DB[wId].reserveAmmo;
      });

      actor.activeWeapon = actor.primaryWeapon || actor.secondaryWeapon;
    }

    this.bomb = createInitialBombData(
      c4Carrier ? c4Carrier.id : null,
      c4Carrier ? c4Carrier.position : [0, 0, 36]
    );
    this.syncHUD(true);
  }

  public getLocalPlayer(): ActorState | undefined {
    const id = useGameStore.getState().isMultiplayer
      ? multiplayerClient.localPlayerId || this.localPlayerId
      : this.localPlayerId;
    return this.actors.find((a) => a.id === id) || this.actors[0];
  }

  public getCameraTargetActor(): ActorState | undefined {
    const local = this.getLocalPlayer();
    if (!local) return this.actors[0];
    if (local.alive) return local;
    const aliveAllies = this.actors.filter(
      (a) => a.alive && a.team === local.team
    );
    if (aliveAllies.length > 0) {
      return aliveAllies[this.spectateIndex % aliveAllies.length];
    }
    return local;
  }

  /**
   * Main per-frame simulation step.
   */
  public step(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.elapsedSec += dt;

    // Decay visual timers even during hitstop
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.6);
    this.viewPunchPitch *= Math.exp(-14 * dt);
    this.viewPunchRoll *= Math.exp(-14 * dt);
    this.droppedC4Rotation += dt * 1.5;

    this.updateParticlesAndTracers(dt);

    const store = useGameStore.getState();
    if (store.screenState !== 'playing') {
      this.input.endFrame();
      return;
    }

    // Handle UI shortcut keys (Tab, B, Esc/P)
    this.handleGlobalUIKeys();

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.input.endFrame();
      return;
    }

    if (store.isMultiplayer && multiplayerClient.latestSnapshot) {
      this.stepMultiplayerClient(dt);
      this.input.endFrame();
      return;
    }

    // OFFLINE AUTHORITATIVE LOOP
    this.stepRoundTimersAndObjectives(dt);

    const local = this.getLocalPlayer();
    if (local) {
      this.stepLocalPlayer(local, dt);
    }

    // Step AI Bots
    const settings = useSettingsStore.getState();
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i];
      actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
      actor.deployTimer = Math.max(0, actor.deployTimer - dt);
      actor.flashBlindTimer = Math.max(0, actor.flashBlindTimer - dt);
      actor.hitFlashTimer = Math.max(0, actor.hitFlashTimer - dt);

      if (!actor.alive) {
        actor.koTimer = Math.min(1, actor.koTimer + dt * 3.2);
        continue;
      }

      // Reload completion
      if (actor.reloadTimer > 0) {
        actor.reloadTimer -= dt;
        if (actor.reloadTimer <= 0) {
          this.completeReload(actor);
        }
      }

      // Recoil recovery
      const spec = WEAPONS_DB[actor.activeWeapon];
      const recov = spec.recoilRecoveryRate * dt;
      actor.recoilPitch *= Math.max(0, 1 - recov);
      actor.recoilYaw *= Math.max(0, 1 - recov);

      if (actor.isBot) {
        updateBotAI(
          actor,
          this.actors,
          this.bomb,
          this.roundPhase,
          this.tStrategy,
          settings.botDifficulty,
          this.physics,
          this.nav,
          this.smokeClouds,
          this.elapsedSec,
          dt,
          {
            onFireWeapon: (bot) =>
              bot.activeWeapon === 'knife'
                ? this.attackKnife(bot, false)
                : this.fireWeapon(bot),
            onThrowGrenade: (bot, nadeId, targetPos) =>
              this.botThrowGrenade(bot, nadeId, targetPos),
            onRadioCallout: (bot, text) => {
              if (local && bot.team === local.team) {
                useGameStore.getState().pushRadio({
                  id: `${Date.now()}_${Math.random()}`,
                  senderName: bot.name,
                  team: bot.team,
                  text,
                  timestamp: Date.now(),
                });
              }
            },
          }
        );
      }
    }

    this.stepGrenadesAndSmokes(dt);

    // Sync HUD at ~12Hz
    this.hudSyncAccumulator += dt;
    if (this.hudSyncAccumulator >= 0.08) {
      this.hudSyncAccumulator = 0;
      this.syncHUD(false);
    }

    this.input.endFrame();
  }

  private handleGlobalUIKeys(): void {
    const store = useGameStore.getState();

    // Scoreboard hold Tab
    const tabHeld = this.input.keysHeld.has('Tab');
    if (tabHeld !== store.scoreboardOpen) {
      store.setScoreboardOpen(tabHeld);
    }

    // Buy menu toggle B
    if (this.input.consumeKey('KeyB')) {
      const local = this.getLocalPlayer();
      if (local && local.alive && this.roundPhase === 'buy') {
        const nextOpen = !store.buyMenuOpen;
        store.setBuyMenuOpen(nextOpen);
        if (!nextOpen) {
          requestPointerLockSafe();
        }
        audioEngine.playUIClick(false);
      }
    }

    // Skip remaining buy phase with Enter (both offline and online multiplayer)
    if (
      this.input.consumeKey('Enter') &&
      this.roundPhase === 'buy' &&
      !store.buyMenuOpen
    ) {
      if (store.isMultiplayer) {
        multiplayerClient.skipBuyPhase();
      } else {
        this.roundPhase = 'live';
        this.phaseTimer = 115.0;
        this.syncHUD(true);
      }
      audioEngine.playUIClick(true);
    }

    // Pause menu toggle P or Escape
    if (this.input.consumeKey('KeyP') || this.input.consumeKey('Escape')) {
      if (store.buyMenuOpen) {
        store.setBuyMenuOpen(false);
      } else {
        store.setScreenState('paused');
      }
    }
  }

  private stepLocalPlayer(player: ActorState, dt: number): void {
    const store = useGameStore.getState();
    const settings = useSettingsStore.getState();

    if (!player.alive) {
      if (this.input.consumeMouseButton(0) || this.input.consumeKey('Space')) {
        this.spectateIndex++;
      }
      return;
    }

    // Mouse look
    if (!store.buyMenuOpen) {
      const sensRad = settings.mouseSensitivity * 0.0012;
      const zoomScale = player.zoomLevel > 0 ? 0.45 : 1.0;
      player.yaw -= this.input.mouseDeltaX * sensRad * zoomScale;
      player.pitch -= this.input.mouseDeltaY * sensRad * zoomScale;
      const maxPitch = Math.PI * 0.48;
      player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));
    }

    // Weapon switching (1-5, Q, Scroll, G drop)
    if (this.input.consumeKey('Digit1') && player.primaryWeapon) {
      this.equipWeapon(player, player.primaryWeapon);
    } else if (this.input.consumeKey('Digit2')) {
      this.equipWeapon(player, player.secondaryWeapon);
    } else if (this.input.consumeKey('Digit3')) {
      this.equipWeapon(player, 'knife');
    } else if (this.input.consumeKey('Digit4') && player.grenades.length > 0) {
      const currentIdx = player.grenades.indexOf(player.activeWeapon);
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % player.grenades.length;
      this.equipWeapon(player, player.grenades[nextIdx]);
    } else if (this.input.consumeKey('Digit5') && player.hasC4) {
      this.equipWeapon(player, 'c4');
    } else if (this.input.consumeKey('KeyQ')) {
      this.equipWeapon(player, this.lastWeaponSlot);
    } else if (this.input.wheelDelta !== 0 && !store.buyMenuOpen) {
      this.cyclePlayerWeapon(player, this.input.wheelDelta > 0 ? 1 : -1);
    }

    // Reload (R)
    if (this.input.consumeKey('KeyR')) {
      const spec = WEAPONS_DB[player.activeWeapon];
      if (
        spec.magSize > 1 &&
        player.ammoMag[player.activeWeapon] < spec.magSize &&
        player.ammoReserve[player.activeWeapon] > 0 &&
        player.reloadTimer <= 0
      ) {
        player.reloadTimer = spec.reloadTime;
        player.zoomLevel = 0;
        audioEngine.playReload(player.activeWeapon);
      }
    }

    // Right click (Scope Zoom or Heavy Knife Attack)
    if (this.input.consumeMouseButton(2) && !store.buyMenuOpen) {
      const spec = WEAPONS_DB[player.activeWeapon];
      if (spec.zoomLevels && spec.zoomLevels.length > 0 && player.reloadTimer <= 0) {
        player.zoomLevel = (player.zoomLevel + 1) % (spec.zoomLevels.length + 1);
        audioEngine.playUIClick(false);
      } else if (player.activeWeapon === 'knife' && player.fireCooldown <= 0) {
        this.attackKnife(player, true);
      }
    }

    // Left click Fire / Throw Grenade / Plant C4 (with click buffer & spam-hold support)
    const spec = WEAPONS_DB[player.activeWeapon];
    this.fireClickBufferTimer = Math.max(0, this.fireClickBufferTimer - dt);
    if (this.input.consumeMouseButton(0)) {
      this.fireClickBufferTimer = 0.12;
    }
    const triggerPulled =
      spec.automatic || spec.canSpamHold
        ? this.input.mouseButtonsHeld.has(0) || this.fireClickBufferTimer > 0
        : this.fireClickBufferTimer > 0;

    if (
      triggerPulled &&
      !store.buyMenuOpen &&
      this.roundPhase !== 'buy' &&
      player.fireCooldown <= 0 &&
      player.reloadTimer <= 0 &&
      player.deployTimer <= 0
    ) {
      this.fireClickBufferTimer = 0;
      if (player.activeWeapon === 'c4') {
        // Holding LPM with C4 in site also plants
      } else if (spec.category === 'grenade') {
        this.throwPlayerGrenade(player, player.activeWeapon);
      } else if (player.activeWeapon === 'knife') {
        this.attackKnife(player, false);
      } else {
        this.fireWeapon(player);
      }
    }

    // Use / Plant / Defuse (Holding E or LPM with C4)
    const holdingE =
      this.input.keysHeld.has('KeyE') ||
      (player.activeWeapon === 'c4' && this.input.mouseButtonsHeld.has(0));
    this.handlePlayerBombInteraction(player, holdingE, dt);

    // WASD Movement — strictly frozen during 'buy' phase until round starts!
    const isBuyFrozen = this.roundPhase === 'buy';
    let forward = 0;
    let right = 0;
    if (!isBuyFrozen) {
      if (this.input.keysHeld.has('KeyW') || this.input.keysHeld.has('ArrowUp')) forward += 1;
      if (this.input.keysHeld.has('KeyS') || this.input.keysHeld.has('ArrowDown')) forward -= 1;
      if (this.input.keysHeld.has('KeyD') || this.input.keysHeld.has('ArrowRight')) right += 1;
      if (this.input.keysHeld.has('KeyA') || this.input.keysHeld.has('ArrowLeft')) right -= 1;
    }

    player.crouching =
      this.input.keysHeld.has('ControlLeft') ||
      this.input.keysHeld.has('ControlRight') ||
      this.input.keysHeld.has('KeyC');
    player.walking =
      this.input.keysHeld.has('ShiftLeft') || this.input.keysHeld.has('ShiftRight');

    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);
    const wishX = isBuyFrozen ? 0 : -sinY * forward + cosY * right;
    const wishZ = isBuyFrozen ? 0 : -cosY * forward - sinY * right;

    let maxSpeed = spec.moveSpeed;
    if (player.crouching) maxSpeed *= 0.48;
    else if (player.walking) maxSpeed *= 0.58;
    if (player.zoomLevel > 0) maxSpeed *= 0.65;

    const jumpPressed = isBuyFrozen ? false : this.input.consumeKey('Space');
    if (isBuyFrozen) {
      this.input.consumeKey('Space');
      player.velocity[0] = 0;
      player.velocity[2] = 0;
    }
    this.physics.stepCharacter(player, wishX, wishZ, maxSpeed, jumpPressed, dt);
    if (isBuyFrozen) {
      player.velocity[0] = 0;
      player.velocity[2] = 0;
    }

    // Pick up dropped C4 if T player walks over it
    if (
      player.team === 'T' &&
      this.bomb.state === 'dropped' &&
      Math.hypot(
        player.position[0] - this.bomb.position[0],
        player.position[2] - this.bomb.position[2]
      ) < 1.8
    ) {
      this.bomb.state = 'carried';
      this.bomb.carrierId = player.id;
      player.hasC4 = true;
      audioEngine.playUIClick(true);
    }

    // Footstep audio & view bob
    const horizSpeed = Math.hypot(player.velocity[0], player.velocity[2]);
    player.walkCycle += horizSpeed * dt * 1.9;
    if (player.grounded && horizSpeed > 2.2 && !player.walking && !player.crouching) {
      this.footstepAccumulator += horizSpeed * dt;
      if (this.footstepAccumulator >= 2.35) {
        this.footstepAccumulator = 0;
        audioEngine.playFootstep(undefined, horizSpeed / 5.0);
      }
    }

    // Update 3D Audio Listener
    const eyeY =
      player.position[1] +
      (player.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
    audioEngine.updateListener(
      player.position[0],
      eyeY,
      player.position[2],
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * Math.cos(player.pitch)
    );
  }

  private handlePlayerBombInteraction(
    player: ActorState,
    holdingUse: boolean,
    dt: number
  ): void {
    if (this.roundPhase === 'buy' || this.roundPhase === 'round_end') return;

    // 1. Planting C4 (T player inside Bombsite A or B)
    const site = getActiveBombSite(player.position[0], player.position[2]);
    if (
      player.team === 'T' &&
      player.hasC4 &&
      this.bomb.state === 'carried' &&
      site &&
      holdingUse
    ) {
      if (this.bomb.planterId !== player.id) {
        this.bomb.planterId = player.id;
        this.bomb.plantProgress = 0;
        audioEngine.playPlantOrDefuseTone(false, player.position);
      }
      this.bomb.plantProgress += dt / BOMB_CONSTANTS.PLANT_TIME;
      player.velocity[0] *= 0.2;
      player.velocity[2] *= 0.2;
      return;
    } else if (this.bomb.planterId === player.id) {
      this.bomb.planterId = null;
      this.bomb.plantProgress = 0;
    }

    // 2. Defusing C4 (CT player near planted C4)
    if (player.team === 'CT' && this.bomb.state === 'planted' && holdingUse) {
      const dist = Math.hypot(
        player.position[0] - this.bomb.position[0],
        player.position[2] - this.bomb.position[2]
      );
      if (dist <= BOMB_CONSTANTS.INTERACTION_RADIUS) {
        if (this.bomb.defuserId !== player.id) {
          this.bomb.defuserId = player.id;
          this.bomb.defuserHasKit = player.hasDefuseKit;
          this.bomb.defuseProgress = 0;
          audioEngine.playPlantOrDefuseTone(true, this.bomb.position);
        }
        const defuseDuration = player.hasDefuseKit
          ? BOMB_CONSTANTS.DEFUSE_TIME_WITH_KIT
          : BOMB_CONSTANTS.DEFUSE_TIME_NO_KIT;
        this.bomb.defuseProgress += dt / defuseDuration;
        player.velocity[0] *= 0.2;
        player.velocity[2] *= 0.2;
        return;
      }
    }

    if (this.bomb.defuserId === player.id) {
      this.bomb.defuserId = null;
      this.bomb.defuseProgress = 0;
    }
  }

  public checkTeamElimination(): void {
    if (this.roundPhase === 'round_end' || this.roundPhase === 'match_end') {
      return;
    }

    const ctAlive = this.actors.filter((a) => a.team === 'CT' && a.alive).length;
    const tAlive = this.actors.filter((a) => a.team === 'T' && a.alive).length;

    // If all CTs are eliminated (even if the bomb is planted!), Terrorists immediately win the round
    if (ctAlive === 0) {
      const topT = [...this.actors]
        .filter((a) => a.team === 'T')
        .sort((a, b) => b.kills - a.kills)[0];
      this.concludeRound(
        'T',
        'Oddział antyterrorystów wyeliminowany',
        topT ? topT.name : 'T',
        'Najwięcej eliminacji w rundzie'
      );
    } else if (tAlive === 0 && this.bomb.state !== 'planted') {
      const topCT = [...this.actors]
        .filter((a) => a.team === 'CT')
        .sort((a, b) => b.kills - a.kills)[0];
      this.concludeRound(
        'CT',
        'Oddział terrorystów wyeliminowany',
        topCT ? topCT.name : 'CT',
        'Wyeliminowanie drużyny przeciwnej'
      );
    }
  }

  private stepRoundTimersAndObjectives(dt: number): void {
    if (this.roundPhase === 'match_end') return;

    if (this.roundPhase === 'round_end') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.advanceToNextRound();
      }
      return;
    }

    // Sync bomb position to carrier if carried
    if (this.bomb.state === 'carried' && this.bomb.carrierId) {
      const carrier = this.actors.find((a) => a.id === this.bomb.carrierId);
      if (carrier && carrier.alive) {
        this.bomb.position = [
          carrier.position[0],
          carrier.position[1] + 0.1,
          carrier.position[2],
        ];
      } else {
        this.bomb.state = 'dropped';
        this.bomb.carrierId = null;
      }
    }

    // Check if planting completed
    if (this.bomb.state === 'carried' && this.bomb.planterId) {
      const planter = this.actors.find((a) => a.id === this.bomb.planterId);
      if (!planter || !planter.alive) {
        this.bomb.planterId = null;
        this.bomb.plantProgress = 0;
      } else if (this.bomb.plantProgress >= 1.0) {
        const site = getActiveBombSite(planter.position[0], planter.position[2]) || 'A';
        this.bomb.state = 'planted';
        this.bomb.site = site;
        this.bomb.carrierId = null;
        this.bomb.planterId = null;
        this.bomb.plantProgress = 0;
        this.bomb.timeRemaining = BOMB_CONSTANTS.BOMB_TIMER;
        this.bomb.position = [
          planter.position[0],
          planter.position[1] + 0.05,
          planter.position[2],
        ];
        planter.hasC4 = false;
        planter.money = clampMoney(
          planter.money + ECONOMY_CONSTANTS.BOMB_PLANT_INDIVIDUAL
        );
        if (planter.activeWeapon === 'c4') {
          planter.activeWeapon = planter.primaryWeapon || planter.secondaryWeapon;
        }
        this.roundPhase = 'planted';
        this.phaseTimer = BOMB_CONSTANTS.BOMB_TIMER;
        audioEngine.playPlantOrDefuseTone(false, this.bomb.position);
        useGameStore.getState().pushRadio({
          id: `plant_${Date.now()}`,
          senderName: 'DOWÓDZTWO',
          team: planter.team,
          text: `Ładunek C4 został podłożony na strefie ${site}!`,
          timestamp: Date.now(),
        });
      }
    }

    // Check if planted bomb is ticking or defused (only while round is still active)
    if (this.roundPhase === 'planted' && this.bomb.state === 'planted') {
      this.bomb.timeRemaining = Math.max(0, this.bomb.timeRemaining - dt);
      this.phaseTimer = this.bomb.timeRemaining;

      this.bomb.beepTimer -= dt;
      if (this.bomb.beepTimer <= 0) {
        this.bomb.beepTimer = getBombBeepInterval(this.bomb.timeRemaining);
        audioEngine.playBombBeep(
          this.bomb.position,
          this.bomb.timeRemaining <= 10
        );
      }

      // Check defuse completion
      if (this.bomb.defuserId) {
        const defuser = this.actors.find((a) => a.id === this.bomb.defuserId);
        if (!defuser || !defuser.alive) {
          this.bomb.defuserId = null;
          this.bomb.defuseProgress = 0;
        } else if (this.bomb.defuseProgress >= 1.0) {
          this.bomb.state = 'defused';
          this.bomb.defuserId = null;
          this.bomb.defuseProgress = 0;
          defuser.mvps += 1;
          defuser.money = clampMoney(
            defuser.money + ECONOMY_CONSTANTS.BOMB_DEFUSE_INDIVIDUAL
          );
          audioEngine.playPlantOrDefuseTone(true, this.bomb.position);
          this.concludeRound(
            'CT',
            'Ładunek C4 został rozbrojony',
            defuser.name,
            'Rozbrojenie ładunku C4'
          );
          return;
        }
      }

      // Check bomb explosion
      if (this.bomb.timeRemaining <= 0) {
        this.bomb.state = 'exploded';
        this.detonateC4();
        this.concludeRound(
          'T',
          'Cel zniszczony — wybuch ładunku C4',
          'Oddział T',
          'Detonacja ładunku C4'
        );
        return;
      }
    }

    // Phase timer transitions
    if (this.roundPhase === 'buy') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.roundPhase = 'live';
        this.phaseTimer = 115.0; // 1:55 round timer
        useGameStore.getState().setBuyMenuOpen(false);
      }
      return;
    }

    if (this.roundPhase === 'live') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.concludeRound(
          'CT',
          'Czas rundy dobiegł końca — cel obroniony',
          'Oddział CT',
          'Obrona strefy przed czasem'
        );
        return;
      }
    }

    this.checkTeamElimination();
  }

  private detonateC4(): void {
    audioEngine.playExplosion(this.bomb.position, true);
    this.cameraTrauma = 1.0;

    // Massive fireball particle burst
    for (let i = 0; i < 48; i++) {
      const p = this.particlePool.acquire();
      p.position = [
        this.bomb.position[0],
        this.bomb.position[1] + 0.4,
        this.bomb.position[2],
      ];
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const speed = 5 + Math.random() * 16;
      p.velocity = [
        Math.cos(theta) * Math.sin(phi) * speed,
        Math.cos(phi) * speed,
        Math.sin(theta) * Math.sin(phi) * speed,
      ];
      p.color = i % 2 === 0 ? 0xf59e0b : 0xef4444;
      p.size = 0.35 + Math.random() * 0.35;
      p.life = 0;
      p.maxLife = 0.8 + Math.random() * 0.6;
      p.gravity = 4.0;
    }

    for (const actor of this.actors) {
      if (!actor.alive) continue;
      const dist = Math.hypot(
        actor.position[0] - this.bomb.position[0],
        actor.position[2] - this.bomb.position[2]
      );
      const dmg = getBombExplosionDamage(dist);
      if (dmg > 0) {
        actor.hp = Math.max(0, actor.hp - dmg);
        if (actor.hp <= 0) {
          actor.alive = false;
          actor.deaths += 1;
        }
      }
    }
  }

  private concludeRound(
    winner: Team,
    reason: string,
    mvpName: string,
    mvpReason: string
  ): void {
    if (this.roundPhase === 'round_end' || this.roundPhase === 'match_end') return;
    this.roundPhase = 'round_end';
    this.phaseTimer = 4.5;

    if (winner === 'CT') {
      this.ctScore += 1;
      this.ctConsecutiveLosses = 0;
      this.tConsecutiveLosses += 1;
    } else {
      this.tScore += 1;
      this.tConsecutiveLosses = 0;
      this.ctConsecutiveLosses += 1;
    }

    // Distribute end-of-round economy rewards
    const winReward =
      this.bomb.state === 'defused'
        ? ECONOMY_CONSTANTS.WIN_REWARD_BOMB_DEFUSED
        : this.bomb.state === 'exploded'
        ? ECONOMY_CONSTANTS.WIN_REWARD_BOMB_EXPLODED
        : ECONOMY_CONSTANTS.WIN_REWARD_ELIMINATION;

    const lossBonus =
      winner === 'CT'
        ? getLossBonus(this.tConsecutiveLosses) +
          (this.bomb.state === 'defused'
            ? ECONOMY_CONSTANTS.BOMB_PLANT_TEAM_BONUS_ON_LOSS
            : 0)
        : getLossBonus(this.ctConsecutiveLosses);

    for (const actor of this.actors) {
      if (actor.team === winner) {
        actor.money = clampMoney(actor.money + winReward);
      } else {
        actor.money = clampMoney(actor.money + lossBonus);
      }
    }

    const local = this.getLocalPlayer();
    if (local) {
      audioEngine.playRoundEndSting(local.team === winner);
    }

    useGameStore.getState().updateHUD({
      roundEndSummary: { winner, reason, mvpName, mvpReason },
    });
    this.syncHUD(true);
  }

  private advanceToNextRound(): void {
    const winTarget = Math.floor(this.maxRounds / 2) + 1;
    if (
      this.ctScore >= winTarget ||
      this.tScore >= winTarget ||
      this.roundNumber >= this.maxRounds
    ) {
      this.roundPhase = 'match_end';
      useGameStore.getState().setScreenState('gameover');
      this.syncHUD(true);
      return;
    }

    const halfRound = Math.floor(this.maxRounds / 2);
    const isHalftimeSwap = this.roundNumber === halfRound;
    this.roundNumber += 1;

    if (isHalftimeSwap) {
      // Swap sides and scores at halftime
      const tmpScore = this.ctScore;
      this.ctScore = this.tScore;
      this.tScore = tmpScore;
      this.ctConsecutiveLosses = 0;
      this.tConsecutiveLosses = 0;
      for (const actor of this.actors) {
        actor.team = actor.team === 'CT' ? 'T' : 'CT';
      }
    }

    this.startNewRound(isHalftimeSwap);
  }

  public equipWeapon(actor: ActorState, weaponId: WeaponId): void {
    if (actor.activeWeapon === weaponId) return;
    const isLocal =
      actor.id ===
      (useGameStore.getState().isMultiplayer
        ? multiplayerClient.localPlayerId
        : this.localPlayerId);
    if (isLocal) {
      this.lastWeaponSlot = actor.activeWeapon;
      audioEngine.playWeaponDeploy(weaponId === 'knife');
    }
    actor.activeWeapon = weaponId;
    actor.reloadTimer = 0;
    actor.zoomLevel = 0;
    actor.deployTimer = WEAPONS_DB[weaponId].deployTime;
  }

  private cyclePlayerWeapon(player: ActorState, dir: number): void {
    const available: WeaponId[] = [];
    if (player.primaryWeapon) available.push(player.primaryWeapon);
    available.push(player.secondaryWeapon);
    available.push('knife');
    player.grenades.forEach((g) => available.push(g));
    if (player.hasC4) available.push('c4');

    const idx = available.indexOf(player.activeWeapon);
    const nextIdx = (idx + dir + available.length) % available.length;
    this.equipWeapon(player, available[nextIdx]);
  }

  private completeReload(actor: ActorState): void {
    const w = actor.activeWeapon;
    const spec = WEAPONS_DB[w];
    const needed = spec.magSize - actor.ammoMag[w];
    const take = Math.min(needed, actor.ammoReserve[w]);
    actor.ammoMag[w] += take;
    actor.ammoReserve[w] -= take;
    actor.reloadTimer = 0;
  }

  public buyItemForLocalPlayer(itemId: string): boolean {
    const store = useGameStore.getState();
    if (store.isMultiplayer) {
      multiplayerClient.sendBuy(itemId);
      audioEngine.playUIClick(true);
      return true;
    }

    const player = this.getLocalPlayer();
    if (!player || !player.alive || this.roundPhase !== 'buy') return false;
    if (!isPointInZone(player.position[0], player.position[2], BUY_ZONES[player.team])) {
      return false;
    }

    // Equipment purchases
    if (itemId in EQUIPMENT_DB) {
      const eq = EQUIPMENT_DB[itemId as keyof typeof EQUIPMENT_DB];
      if (eq.team !== 'BOTH' && eq.team !== player.team) return false;

      if (eq.id === 'kevlar') {
        if (player.armor >= 100 || player.money < eq.price) return false;
        player.money -= eq.price;
        player.armor = 100;
      } else if (eq.id === 'kevlar_helmet') {
        if (player.hasHelmet && player.armor >= 100) return false;
        const cost = player.armor >= 100 ? 350 : eq.price;
        if (player.money < cost) return false;
        player.money -= cost;
        player.armor = 100;
        player.hasHelmet = true;
      } else if (eq.id === 'defuse_kit') {
        if (player.hasDefuseKit || player.money < eq.price) return false;
        player.money -= eq.price;
        player.hasDefuseKit = true;
      }
      audioEngine.playUIClick(true);
      this.syncHUD(true);
      return true;
    }

    // Weapon / Grenade purchases
    if (itemId in WEAPONS_DB) {
      const spec = WEAPONS_DB[itemId as WeaponId];
      if (spec.team !== 'BOTH' && spec.team !== player.team) return false;
      if (player.money < spec.price) return false;

      if (spec.category === 'grenade') {
        if (player.grenades.length >= ECONOMY_CONSTANTS.MAX_GRENADES) return false;
        const sameCount = player.grenades.filter((g) => g === spec.id).length;
        if (sameCount >= (spec.id === 'flashbang' ? 2 : 1)) return false;
        player.money -= spec.price;
        player.grenades.push(spec.id);
        this.equipWeapon(player, spec.id);
      } else if (spec.slot === 1) {
        if (player.primaryWeapon === spec.id) return false;
        player.money -= spec.price;
        player.primaryWeapon = spec.id;
        player.ammoMag[spec.id] = spec.magSize;
        player.ammoReserve[spec.id] = spec.reserveAmmo;
        this.equipWeapon(player, spec.id);
      } else if (spec.slot === 2) {
        if (player.secondaryWeapon === spec.id) return false;
        player.money -= spec.price;
        player.secondaryWeapon = spec.id;
        player.ammoMag[spec.id] = spec.magSize;
        player.ammoReserve[spec.id] = spec.reserveAmmo;
        this.equipWeapon(player, spec.id);
      }
      audioEngine.playUIClick(true);
      this.syncHUD(true);
      return true;
    }

    return false;
  }

  /**
   * Dedicated melee knife attack routine (Light Slash or Heavy Thrust).
   * Completely isolated from firearm physics: NO bullet tracers, NO gun recoil
   * (crosshair never blooms or climbs), and NO gunshot audio or network shot events.
   */
  public attackKnife(shooter: ActorState, isHeavy = false): void {
    if (this.roundPhase === 'buy' || shooter.deployTimer > 0) return;

    const isMultiplayer = useGameStore.getState().isMultiplayer;
    const isLocal =
      shooter.id ===
      (isMultiplayer ? multiplayerClient.localPlayerId : this.localPlayerId);

    // Knife attack cooldown
    shooter.fireCooldown = isHeavy ? 0.95 : 0.40;
    shooter.spottedUntil = Math.max(shooter.spottedUntil, this.elapsedSec + 1.5);

    if (isLocal) {
      this.lastKnifeHeavy = isHeavy;
      if (!isHeavy) {
        this.knifeSwingCount += 1;
      }
      // Subtle viewmodel knife slash tilt (zero aim pitch recoil)
      this.viewPunchRoll += (Math.random() - 0.5) * (isHeavy ? 0.02 : 0.012);
    }

    const eyeY =
      shooter.position[1] +
      (shooter.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
    const origin: [number, number, number] = [
      shooter.position[0],
      eyeY,
      shooter.position[2],
    ];

    const cosP = Math.cos(shooter.pitch);
    const dir: [number, number, number] = [
      -Math.sin(shooter.yaw) * cosP,
      Math.sin(shooter.pitch),
      -Math.cos(shooter.yaw) * cosP,
    ];

    const maxReach = isHeavy ? 2.1 : 2.45;

    // Check world obstacles first
    const worldHits = this.physics.raycastWorld(
      origin[0],
      origin[1],
      origin[2],
      dir[0],
      dir[1],
      dir[2],
      maxReach
    );
    const wallHit = worldHits[0] || null;
    const maxObstacleDist = wallHit ? wallHit.distance : maxReach;

    // Find best target actor in melee cone
    let bestActor: ActorState | null = null;
    let bestDist = maxObstacleDist;
    let isHeadshot = false;

    for (const actor of this.actors) {
      if (!actor.alive || actor.id === shooter.id) continue;
      if (actor.team === shooter.team) continue;

      const toActorX = actor.position[0] - origin[0];
      const toActorZ = actor.position[2] - origin[2];
      const horizDist = Math.hypot(toActorX, toActorZ);
      if (horizDist > maxReach + 0.4) continue;

      const actorEyeY =
        actor.position[1] +
        (actor.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
      const toActorY = actorEyeY * 0.7 + actor.position[1] * 0.3 - origin[1];
      const dist = Math.hypot(toActorX, toActorY, toActorZ);
      if (dist > maxReach || dist >= bestDist) continue;

      const invDist = 1 / Math.max(0.01, dist);
      const dot = (toActorX * dir[0] + toActorY * dir[1] + toActorZ * dir[2]) * invDist;
      if (dot > 0.62) {
        bestDist = dist;
        bestActor = actor;
        isHeadshot = Math.abs(actorEyeY - (origin[1] + dir[1] * dist)) < 0.28;
      }
    }

    if (bestActor) {
      // Check for backstab angle: compare shooter forward with victim forward
      const shooterFwdX = -Math.sin(shooter.yaw);
      const shooterFwdZ = -Math.cos(shooter.yaw);
      const victimFwdX = -Math.sin(bestActor.yaw);
      const victimFwdZ = -Math.cos(bestActor.yaw);
      const backstabDot = shooterFwdX * victimFwdX + shooterFwdZ * victimFwdZ;
      const isBackstab = backstabDot > 0.65;

      let damage: number;
      if (isBackstab) {
        damage = isHeavy ? 180 : 90; // CS2 lethal backstab
      } else if (isHeavy) {
        damage = bestActor.armor > 0 ? 55 : 65;
      } else {
        damage = bestActor.armor > 0 ? 34 : 40;
      }

      if (isHeadshot) {
        damage = Math.round(damage * 1.5);
      }

      bestActor.hp = Math.max(0, bestActor.hp - damage);
      if (bestActor.armor > 0) {
        bestActor.armor = Math.max(0, bestActor.armor - Math.round(damage * 0.4));
      }
      bestActor.hitFlashTimer = 0.08;

      // Flesh hit audio
      audioEngine.playKnifeAttack(isHeavy, 'flesh', isLocal ? undefined : origin);

      // Blood burst
      const hitPos: [number, number, number] = [
        origin[0] + dir[0] * bestDist,
        origin[1] + dir[1] * bestDist,
        origin[2] + dir[2] * bestDist,
      ];
      this.spawnImpactParticles(hitPos, 0xef4444, 12);

      if (isLocal) {
        this.hitstopTimer = 0.035;
        audioEngine.playHitMarker(isHeadshot);
        useGameStore.getState().updateHUD({
          hitMarker: isHeadshot ? 'headshot' : 'normal',
        });
        setTimeout(() => {
          useGameStore.getState().updateHUD({ hitMarker: 'none' });
        }, 140);
      }

      if (bestActor.hp <= 0) {
        this.handleActorDeath(shooter, bestActor, isHeadshot, false);
      }
    } else if (wallHit) {
      audioEngine.playKnifeAttack(isHeavy, 'wall', isLocal ? undefined : origin);
      this.spawnImpactParticles(wallHit.point, 0xfbbf24, 6);
    } else {
      audioEngine.playKnifeAttack(isHeavy, 'none', isLocal ? undefined : origin);
    }
  }

  /**
   * Fires a hitscan firearm with dynamic movement/jump/crouch spread,
   * multi-pellet shotgun support, wallbang penetration, hitbox multipliers, and decals.
   */
  public fireWeapon(shooter: ActorState): void {
    if (shooter.activeWeapon === 'knife') {
      this.attackKnife(shooter, false);
      return;
    }

    const spec = WEAPONS_DB[shooter.activeWeapon];
    if (shooter.ammoMag[shooter.activeWeapon] <= 0) {
      return;
    }

    const isMultiplayer = useGameStore.getState().isMultiplayer;
    const isLocal =
      shooter.id ===
      (isMultiplayer ? multiplayerClient.localPlayerId : this.localPlayerId);

    shooter.ammoMag[shooter.activeWeapon] -= 1;
    if (
      shooter.ammoMag[shooter.activeWeapon] <= 0 &&
      shooter.ammoReserve[shooter.activeWeapon] > 0
    ) {
      shooter.reloadTimer = spec.reloadTime;
      if (isLocal) {
        audioEngine.playReload(shooter.activeWeapon);
      }
    }

    shooter.fireCooldown = 60 / spec.fireRate;
    shooter.spottedUntil = Math.max(shooter.spottedUntil, this.elapsedSec + 2.5);

    const eyeY =
      shooter.position[1] +
      (shooter.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
    const origin: [number, number, number] = [
      shooter.position[0],
      eyeY,
      shooter.position[2],
    ];

    audioEngine.playGunshot(shooter.activeWeapon, isLocal ? undefined : origin);

    if (isLocal) {
      this.muzzleFlashTimer = 0.055;
      this.viewPunchPitch += spec.recoilVertical * 0.65;
      this.viewPunchRoll += (Math.random() - 0.5) * spec.recoilHorizontal;
    }

    // Calculate current dynamic spread (including rapid spam bloom from accumulated recoil)
    const horizSpeed = Math.hypot(shooter.velocity[0], shooter.velocity[2]);
    const speedRatio = Math.min(1, horizSpeed / 5.0);
    let spread = spec.baseSpread;
    if (shooter.crouching) spread *= spec.crouchSpreadMult;
    if (shooter.zoomLevel > 0 && spec.scopedSpreadMult) spread *= spec.scopedSpreadMult;
    spread += speedRatio * spec.moveSpreadBonus;
    if (!shooter.grounded) spread += spec.jumpSpreadBonus;

    // Add spam bloom proportional to current unrecovered recoil
    const spamStacks = shooter.recoilPitch / Math.max(0.01, spec.recoilVertical);
    spread += spamStacks * (spec.spamSpreadPerShot || 0.015);

    const pellets = spec.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const pitchAngle =
        shooter.pitch +
        shooter.recoilPitch * 1.65 +
        (Math.random() - 0.5) * spread * 2;
      const yawAngle =
        shooter.yaw +
        shooter.recoilYaw * 1.65 +
        (Math.random() - 0.5) * spread * 2;

      const dx = -Math.sin(yawAngle) * Math.cos(pitchAngle);
      const dy = Math.sin(pitchAngle);
      const dz = -Math.cos(yawAngle) * Math.cos(pitchAngle);

      if (isMultiplayer && isLocal) {
        multiplayerClient.sendFire({
          origin,
          dir: [dx, dy, dz],
          weaponId: shooter.activeWeapon,
        });
      }

      this.traceBullet(shooter, origin, [dx, dy, dz], spec.range);
    }

    // Apply recoil kick after shot
    shooter.recoilPitch = Math.min(0.28, shooter.recoilPitch + spec.recoilVertical);
    shooter.recoilYaw += (Math.random() - 0.5) * spec.recoilHorizontal * 2;
  }

  private traceBullet(
    shooter: ActorState,
    origin: [number, number, number],
    dir: [number, number, number],
    maxRange: number
  ): void {
    const worldHits = this.physics.raycastWorld(
      origin[0],
      origin[1],
      origin[2],
      dir[0],
      dir[1],
      dir[2],
      maxRange
    );

    // Determine effective max distance before solid non-penetrable wall
    let solidWallDist = maxRange;
    let firstWallHit = worldHits[0] || null;
    let penetratedThickness = 0;

    for (let i = 0; i < worldHits.length; i++) {
      const h = worldHits[i];
      if (!h.penetrable || WEAPONS_DB[shooter.activeWeapon].wallPenetration <= 0) {
        solidWallDist = h.distance;
        break;
      } else {
        penetratedThickness += 0.35;
        if (penetratedThickness > WEAPONS_DB[shooter.activeWeapon].wallPenetration) {
          solidWallDist = h.distance;
          break;
        }
      }
    }

    // Check intersection with enemy actors along ray
    let hitActor: ActorState | null = null;
    let hitDist = solidWallDist;
    let hitZone: HitboxZone = 'chest';
    let hitPoint: [number, number, number] = [
      origin[0] + dir[0] * solidWallDist,
      origin[1] + dir[1] * solidWallDist,
      origin[2] + dir[2] * solidWallDist,
    ];

    for (let i = 0; i < this.actors.length; i++) {
      const target = this.actors[i];
      if (!target.alive || target.id === shooter.id || target.team === shooter.team) {
        continue;
      }

      const actorHeight = target.crouching
        ? PLAYER_DIMENSIONS.HEIGHT_CROUCH
        : PLAYER_DIMENSIONS.HEIGHT_STAND;
      const radius = 0.42;

      // Ray-cylinder intersection in XZ
      const toX = target.position[0] - origin[0];
      const toZ = target.position[2] - origin[2];
      const proj = toX * dir[0] + toZ * dir[2];
      if (proj < 0 || proj > hitDist) continue;

      const closestX = origin[0] + dir[0] * proj;
      const closestY = origin[1] + dir[1] * proj;
      const closestZ = origin[2] + dir[2] * proj;

      const distSqXZ =
        (closestX - target.position[0]) ** 2 +
        (closestZ - target.position[2]) ** 2;

      if (
        distSqXZ <= radius * radius &&
        closestY >= target.position[1] &&
        closestY <= target.position[1] + actorHeight
      ) {
        hitActor = target;
        hitDist = proj;
        hitPoint = [closestX, closestY, closestZ];
        const relY = (closestY - target.position[1]) / actorHeight;
        if (relY > 0.78) hitZone = 'head';
        else if (relY > 0.52) hitZone = 'chest';
        else if (relY > 0.34) hitZone = 'stomach';
        else hitZone = 'legs';
      }
    }

    if (WEAPONS_DB[shooter.activeWeapon].category !== 'melee') {
      const muzzleStart: [number, number, number] = [
        origin[0] + dir[0] * 0.45,
        origin[1] - 0.12 + dir[1] * 0.45,
        origin[2] + dir[2] * 0.45,
      ];
      this.spawnTracer(muzzleStart, hitPoint);
    }

    if (hitActor) {
      const isWallbang = firstWallHit !== null && firstWallHit.distance < hitDist;
      const dmgRes = calculateHitDamage(
        shooter.activeWeapon,
        hitZone,
        hitDist,
        hitActor.armor,
        hitActor.hasHelmet,
        isWallbang ? 0.32 : 0
      );
      const finalDamage = dmgRes.healthDamage;

      hitActor.hp = Math.max(0, hitActor.hp - finalDamage);
      hitActor.armor = Math.max(0, hitActor.armor - dmgRes.armorDamage);
      hitActor.hitFlashTimer = 0.06;

      // Hit sparks / impact burst on target
      this.spawnImpactParticles(hitPoint, dmgRes.isHeadshot ? 0xef4444 : 0xf59e0b, 8);

      if (shooter.id === this.localPlayerId) {
        audioEngine.playHitMarker(dmgRes.isHeadshot);
        useGameStore.getState().updateHUD({
          hitMarker: dmgRes.isHeadshot ? 'headshot' : 'normal',
        });
        setTimeout(() => {
          useGameStore.getState().updateHUD({ hitMarker: 'none' });
        }, 140);
      }

      if (hitActor.id === this.localPlayerId) {
        this.viewPunchPitch += 0.04;
      }

      if (hitActor.hp <= 0) {
        this.handleActorDeath(shooter, hitActor, dmgRes.isHeadshot, isWallbang);
      }
    } else if (firstWallHit) {
      // Spawn bullet hole decal and dust/spark particles on wall
      const decal = this.decalPool.acquire();
      decal.position = [
        firstWallHit.point[0] + firstWallHit.normal[0] * 0.015,
        firstWallHit.point[1] + firstWallHit.normal[1] * 0.015,
        firstWallHit.point[2] + firstWallHit.normal[2] * 0.015,
      ];
      decal.normal = [...firstWallHit.normal];
      decal.scale = 0.11 + Math.random() * 0.05;
      this.spawnImpactParticles(firstWallHit.point, 0xd4b895, 5);
    }
  }

  private handleActorDeath(
    killer: ActorState,
    victim: ActorState,
    isHeadshot: boolean,
    isWallbang: boolean
  ): void {
    victim.alive = false;
    victim.deaths += 1;
    victim.koTimer = 0.01;
    killer.kills += 1;

    // Reset victim inventory on death: lose primary gun, grenades, armor & defuse kit
    victim.primaryWeapon = null;
    victim.secondaryWeapon = getStartingPistol(victim.team);
    victim.activeWeapon = victim.secondaryWeapon;
    victim.grenades = [];
    victim.armor = 0;
    victim.hasHelmet = false;
    victim.hasDefuseKit = false;

    if (victim.id === this.localPlayerId) {
      this.equipWeapon(victim, victim.secondaryWeapon);
      this.syncHUD(true);
    }

    const spec = WEAPONS_DB[killer.activeWeapon];
    killer.money = clampMoney(killer.money + spec.killReward);

    if (killer.id === this.localPlayerId || isHeadshot) {
      this.hitstopTimer = 0.035; // Crisp 35ms hitstop juice on kill
    }

    // If victim carried C4, drop it on the ground!
    if (victim.hasC4) {
      victim.hasC4 = false;
      this.bomb.state = 'dropped';
      this.bomb.carrierId = null;
      this.bomb.position = [
        victim.position[0],
        victim.position[1] + 0.05,
        victim.position[2],
      ];
    }

    useGameStore.getState().pushKillFeed({
      id: `${Date.now()}_${Math.random()}`,
      killerName: killer.name,
      killerTeam: killer.team,
      victimName: victim.name,
      victimTeam: victim.team,
      weaponId: killer.activeWeapon,
      isHeadshot,
      isWallbang,
      timestamp: Date.now(),
    });

    if (!useGameStore.getState().isMultiplayer) {
      this.checkTeamElimination();
    }
  }

  private throwPlayerGrenade(player: ActorState, nadeId: WeaponId): void {
    const idx = player.grenades.indexOf(nadeId);
    if (idx === -1) return;
    player.grenades.splice(idx, 1);

    const eyeY =
      player.position[1] +
      (player.crouching ? PLAYER_DIMENSIONS.EYE_CROUCH : PLAYER_DIMENSIONS.EYE_STAND);
    const dx = -Math.sin(player.yaw) * Math.cos(player.pitch);
    const dy = Math.sin(player.pitch) + 0.18;
    const dz = -Math.cos(player.yaw) * Math.cos(player.pitch);
    const throwSpeed = 16.5;

    const origin: [number, number, number] = [
      player.position[0] + dx * 0.5,
      eyeY,
      player.position[2] + dz * 0.5,
    ];
    const velocity: [number, number, number] = [
      dx * throwSpeed + player.velocity[0] * 0.35,
      dy * throwSpeed,
      dz * throwSpeed + player.velocity[2] * 0.35,
    ];

    if (this.grenades.length >= 16) {
      this.grenades.shift();
    }

    this.grenades.push({
      id: `nade_${Date.now()}_${Math.random()}`,
      type: nadeId as ActiveGrenade['type'],
      throwerId: player.id,
      throwerTeam: player.team,
      position: origin,
      velocity: velocity,
      fuseTimer: nadeId === 'flashbang' ? 1.5 : 2.1,
      detonated: false,
    });

    if (useGameStore.getState().isMultiplayer) {
      multiplayerClient.sendThrowGrenade(nadeId, origin, velocity);
    }

    this.equipWeapon(player, player.primaryWeapon || player.secondaryWeapon);
    this.syncHUD(true);
  }

  private botThrowGrenade(
    bot: ActorState,
    nadeId: WeaponId,
    targetPos: [number, number, number]
  ): void {
    const idx = bot.grenades.indexOf(nadeId);
    if (idx === -1) return;
    bot.grenades.splice(idx, 1);

    const dx = targetPos[0] - bot.position[0];
    const dz = targetPos[2] - bot.position[2];
    const dist = Math.max(1, Math.hypot(dx, dz));
    const speed = Math.min(17, Math.max(8, dist * 0.75));

    this.grenades.push({
      id: `nade_${Date.now()}_${Math.random()}`,
      type: nadeId as ActiveGrenade['type'],
      throwerId: bot.id,
      throwerTeam: bot.team,
      position: [bot.position[0], bot.position[1] + 1.5, bot.position[2]],
      velocity: [(dx / dist) * speed, 4.2, (dz / dist) * speed],
      fuseTimer: 1.7,
      detonated: false,
    });
  }

  private stepGrenadesAndSmokes(dt: number): void {
    const gravity = 15.5;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuseTimer -= dt;
      g.velocity[1] -= gravity * dt;

      const nx = g.position[0] + g.velocity[0] * dt;
      const ny = g.position[1] + g.velocity[1] * dt;
      const nz = g.position[2] + g.velocity[2] * dt;

      // Bounce against world colliders
      const hits = this.physics.raycastWorld(
        g.position[0],
        g.position[1],
        g.position[2],
        g.velocity[0],
        g.velocity[1],
        g.velocity[2],
        Math.hypot(g.velocity[0], g.velocity[1], g.velocity[2]) * dt + 0.15
      );

      if (hits.length > 0) {
        const n = hits[0].normal;
        const dot =
          g.velocity[0] * n[0] + g.velocity[1] * n[1] + g.velocity[2] * n[2];
        g.velocity[0] = (g.velocity[0] - 2 * dot * n[0]) * 0.55;
        g.velocity[1] = (g.velocity[1] - 2 * dot * n[1]) * 0.45;
        g.velocity[2] = (g.velocity[2] - 2 * dot * n[2]) * 0.55;
      } else {
        g.position[0] = nx;
        g.position[1] = Math.max(0.08, ny);
        g.position[2] = nz;
      }

      if (g.fuseTimer <= 0) {
        this.detonateGrenade(g);
        this.grenades.splice(i, 1);
      }
    }

    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      this.smokeClouds[i].timeRemaining -= dt;
      if (this.smokeClouds[i].timeRemaining <= 0) {
        this.smokeClouds.splice(i, 1);
      }
    }
  }

  private detonateGrenade(g: ActiveGrenade): void {
    if (g.type === 'he_grenade') {
      audioEngine.playExplosion(g.position, false);
      this.spawnImpactParticles(g.position, 0xf59e0b, 24);
      const thrower =
        this.actors.find((a) => a.id === g.throwerId) || this.actors[0];

      for (const actor of this.actors) {
        if (!actor.alive) continue;
        const dist = Math.hypot(
          actor.position[0] - g.position[0],
          actor.position[1] + 0.9 - g.position[1],
          actor.position[2] - g.position[2]
        );
        if (dist < 8.5) {
          const rawDmg = Math.round(98 * (1 - dist / 8.5));
          const finalDmg = actor.armor > 0 ? Math.round(rawDmg * 0.6) : rawDmg;
          actor.hp = Math.max(0, actor.hp - finalDmg);
          if (actor.id === this.localPlayerId) {
            this.cameraTrauma = Math.max(this.cameraTrauma, (1 - dist / 8.5) * 0.65);
          }
          if (actor.hp <= 0) {
            this.handleActorDeath(thrower, actor, false, false);
          }
        }
      }
      return;
    }

    if (g.type === 'flashbang') {
      audioEngine.playExplosion(g.position, false);
      for (const actor of this.actors) {
        if (!actor.alive) continue;
        const eyeY = actor.position[1] + 1.6;
        const dx = g.position[0] - actor.position[0];
        const dy = g.position[1] - eyeY;
        const dz = g.position[2] - actor.position[2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 34) continue;

        if (
          this.physics.hasLineOfSight(
            actor.position[0],
            eyeY,
            actor.position[2],
            g.position[0],
            g.position[1],
            g.position[2],
            this.smokeClouds
          )
        ) {
          const lookX = -Math.sin(actor.yaw);
          const lookZ = -Math.cos(actor.yaw);
          const dot =
            (dx * lookX + dz * lookZ) / Math.max(0.01, Math.hypot(dx, dz));
          const angleFactor = dot > 0.2 ? 1.0 : dot > -0.3 ? 0.65 : 0.25;
          const distFactor = Math.max(0.25, 1 - dist / 36);
          const blindDuration = 4.5 * angleFactor * distFactor;
          actor.flashBlindTimer = Math.max(actor.flashBlindTimer, blindDuration);
          if (actor.id === this.localPlayerId) {
            audioEngine.playFlashbangRing(angleFactor * distFactor);
          }
        }
      }
      return;
    }

    if (g.type === 'smoke_grenade') {
      audioEngine.playSmokePop(g.position);
      // Cap maximum smoke clouds to prevent performance degradation or exploit stacking
      if (this.smokeClouds.length >= 6) {
        this.smokeClouds.shift();
      }
      this.smokeClouds.push({
        id: g.id,
        position: [g.position[0], g.position[1] + 1.2, g.position[2]],
        radius: 6.2, // Expanded 6.2m dense smoke radius
        timeRemaining: 18.0, // 18s smoke duration blocking player & bot LOS
      });
    }
  }

  public spawnImpactParticles(
    pos: [number, number, number],
    color: number,
    count: number
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      p.position = [pos[0], pos[1], pos[2]];
      p.velocity = [
        (Math.random() - 0.5) * 6,
        1.5 + Math.random() * 4.5,
        (Math.random() - 0.5) * 6,
      ];
      p.color = color;
      p.size = 0.05 + Math.random() * 0.05;
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.25;
      p.gravity = 12.0;
    }
  }

  public spawnTracer(
    start: [number, number, number],
    end: [number, number, number]
  ): void {
    const t = this.tracerPool.acquire();
    t.start = [...start];
    t.end = [...end];
    t.life = 0.065;
  }

  private updateParticlesAndTracers(dt: number): void {
    const particles = this.particlePool.getAll();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.velocity[1] -= p.gravity * dt;
      p.position[0] += p.velocity[0] * dt;
      p.position[1] += p.velocity[1] * dt;
      p.position[2] += p.velocity[2] * dt;
    }

    const tracers = this.tracerPool.getAll();
    for (let i = 0; i < tracers.length; i++) {
      const t = tracers[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
      }
    }
  }

  private stepMultiplayerClient(dt: number): void {
    const snap = multiplayerClient.latestSnapshot;
    if (!snap) return;

    this.applyMultiplayerSnapshot(snap, false);

    // Tick weapon cooldowns, reload timers, deploy timers, and recoil recovery on client
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i];
      actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
      actor.deployTimer = Math.max(0, actor.deployTimer - dt);
      actor.flashBlindTimer = Math.max(0, actor.flashBlindTimer - dt);
      actor.hitFlashTimer = Math.max(0, actor.hitFlashTimer - dt);

      if (!actor.alive) {
        actor.koTimer = Math.min(1, actor.koTimer + dt * 3.2);
        continue;
      }

      if (actor.reloadTimer > 0) {
        actor.reloadTimer -= dt;
        if (actor.reloadTimer <= 0) {
          this.completeReload(actor);
        }
      }

      const spec = WEAPONS_DB[actor.activeWeapon];
      const recov = spec.recoilRecoveryRate * dt;
      actor.recoilPitch *= Math.max(0, 1 - recov);
      actor.recoilYaw *= Math.max(0, 1 - recov);
    }

    const local = this.getLocalPlayer();
    if (local) {
      this.stepLocalPlayer(local, dt);
      this.netSendAccumulator += dt;
      if (this.netSendAccumulator >= 0.045) {
        this.netSendAccumulator = 0;
        const holdingUse =
          this.input.keysHeld.has('KeyE') ||
          (local.activeWeapon === 'c4' && this.input.mouseButtonsHeld.has(0));
        multiplayerClient.sendInput({
          position: local.position,
          velocity: local.velocity,
          yaw: local.yaw,
          pitch: local.pitch,
          crouching: local.crouching,
          activeWeapon: local.activeWeapon,
          firing: this.input.mouseButtonsHeld.has(0),
          planting: holdingUse && local.team === 'T' && local.hasC4,
          defusing: holdingUse && local.team === 'CT',
        });
      }
    }

    this.stepGrenadesAndSmokes(dt);

    this.hudSyncAccumulator += dt;
    if (this.hudSyncAccumulator >= 0.08) {
      this.hudSyncAccumulator = 0;
      this.syncHUD(false);
    }
  }

  private applyMultiplayerSnapshot(
    snap: NonNullable<typeof multiplayerClient.latestSnapshot>,
    initial: boolean
  ): void {
    const prevRoundNumber = this.roundNumber;
    const prevRoundPhase = this.roundPhase;
    this.roundPhase = snap.roundPhase;
    this.roundNumber = snap.roundNumber;
    this.ctScore = snap.ctScore;
    this.tScore = snap.tScore;
    this.phaseTimer = snap.phaseTimeRemaining;
    this.bomb = snap.bomb;

    const isNewRound = initial || snap.roundNumber !== prevRoundNumber;
    const enteredBuyPhase = snap.roundPhase === 'buy' && prevRoundPhase !== 'buy';

    if (isNewRound || enteredBuyPhase) {
      // Clear all active smoke clouds, in-flight grenades, decals & particles on new round start
      this.smokeClouds = [];
      this.grenades = [];
      this.decalPool.clearAll();
      this.particlePool.clearAll();
      this.tracerPool.clearAll();
      useGameStore.getState().updateHUD({ roundEndSummary: null, buyMenuOpen: false });
    }

    // Remove actors that are no longer in the room snapshot
    const validIds = new Set(snap.actors.map((a) => a.id));
    this.actors = this.actors.filter((a) => validIds.has(a.id));

    for (const netActor of snap.actors) {
      let existing = this.actors.find((a) => a.id === netActor.id);
      if (!existing) {
        existing = this.createFreshActor(
          netActor.id,
          netActor.name,
          netActor.team,
          netActor.isBot,
          'entry',
          'A'
        );
        existing.position = [...netActor.position];
        existing.yaw = netActor.yaw;
        this.actors.push(existing);
      }

      const isSelf = netActor.id === multiplayerClient.localPlayerId;
      const prevPrimary = existing.primaryWeapon;
      const prevSecondary = existing.secondaryWeapon;

      existing.name = netActor.name;
      existing.team = netActor.team;
      existing.isBot = netActor.isBot;
      existing.alive = netActor.alive;
      existing.hp = netActor.hp;
      existing.armor = netActor.armor;
      existing.hasHelmet = netActor.hasHelmet;
      existing.hasDefuseKit = netActor.hasDefuseKit;
      existing.hasC4 = netActor.hasC4;
      existing.money = netActor.money;
      existing.kills = netActor.kills;
      existing.deaths = netActor.deaths;
      existing.assists = netActor.assists;
      existing.mvps = netActor.mvps;
      existing.primaryWeapon = netActor.primaryWeapon;
      if (netActor.secondaryWeapon) {
        existing.secondaryWeapon = netActor.secondaryWeapon;
      }
      if (netActor.grenades) {
        existing.grenades = [...netActor.grenades];
      }

      if (!existing.alive) {
        existing.primaryWeapon = null;
        existing.grenades = [];
        existing.armor = 0;
        existing.hasHelmet = false;
        existing.hasDefuseKit = false;
        if (isSelf && existing.activeWeapon !== existing.secondaryWeapon && existing.activeWeapon !== 'knife') {
          this.equipWeapon(existing, existing.secondaryWeapon);
        }
      }

      if (isNewRound) {
        (Object.keys(WEAPONS_DB) as WeaponId[]).forEach((wId) => {
          existing!.ammoMag[wId] = WEAPONS_DB[wId].magSize;
          existing!.ammoReserve[wId] = WEAPONS_DB[wId].reserveAmmo;
        });
      }

      // If local player just bought a new primary or secondary weapon, equip and fill ammo
      if (isSelf) {
        if (netActor.primaryWeapon && netActor.primaryWeapon !== prevPrimary) {
          const w = netActor.primaryWeapon;
          existing.ammoMag[w] = WEAPONS_DB[w].magSize;
          existing.ammoReserve[w] = WEAPONS_DB[w].reserveAmmo;
          this.equipWeapon(existing, w);
        } else if (
          netActor.secondaryWeapon &&
          netActor.secondaryWeapon !== prevSecondary
        ) {
          const w = netActor.secondaryWeapon;
          existing.ammoMag[w] = WEAPONS_DB[w].magSize;
          existing.ammoReserve[w] = WEAPONS_DB[w].reserveAmmo;
          this.equipWeapon(existing, w);
        }
      }

      if (!isSelf || initial || isNewRound || snap.roundPhase === 'buy' || !existing.alive) {
        // Snap on round start / buy phase, or smooth-interpolate remote players
        const alpha = initial || isNewRound || snap.roundPhase === 'buy' ? 1.0 : 0.35;
        existing.position[0] += (netActor.position[0] - existing.position[0]) * alpha;
        existing.position[1] += (netActor.position[1] - existing.position[1]) * alpha;
        existing.position[2] += (netActor.position[2] - existing.position[2]) * alpha;
        if (!isSelf || initial || isNewRound) {
          existing.yaw = netActor.yaw;
          existing.pitch = netActor.pitch;
          existing.crouching = netActor.crouching;
          existing.activeWeapon = netActor.activeWeapon;
        }
      }
    }
  }

  public syncHUD(forceFull: boolean): void {
    const local = this.getLocalPlayer();
    if (!local) return;

    const camActor = this.getCameraTargetActor() || local;
    const spec = WEAPONS_DB[camActor.activeWeapon];
    const inBuy = isPointInZone(
      local.position[0],
      local.position[2],
      BUY_ZONES[local.team]
    );
    const activeSite = getActiveBombSite(local.position[0], local.position[2]);

    const horizSpeed = Math.hypot(camActor.velocity[0], camActor.velocity[2]);
    const dynamicSpreadPx = Math.round(
      4 +
        spec.baseSpread * 240 +
        (horizSpeed / 5.0) * spec.moveSpreadBonus * 220 +
        camActor.recoilPitch * 180
    );

    let actionProgress = 0;
    let actionLabel: string | null = null;
    if (this.bomb.planterId === local.id && this.bomb.plantProgress > 0) {
      actionProgress = this.bomb.plantProgress;
      actionLabel = 'PODKŁADANIE ŁADUNKU C4...';
    } else if (this.bomb.defuserId === local.id && this.bomb.defuseProgress > 0) {
      actionProgress = this.bomb.defuseProgress;
      actionLabel = local.hasDefuseKit
        ? 'ROZBRAJANIE Z ZESTAWEM (5s)...'
        : 'ROZBRAJANIE ŁADUNKU C4 (10s)...';
    }

    // Build radar dots (allies always visible; enemies only when spottedUntil > elapsedSec)
    const dots = this.actors
      .filter(
        (a) =>
          a.alive &&
          (a.team === local.team || a.spottedUntil > this.elapsedSec)
      )
      .map((a) => ({
        id: a.id,
        team: a.team,
        x: a.position[0],
        z: a.position[2],
        yaw: a.yaw,
        isLocal: a.id === local.id,
        alive: a.alive,
      }));

    // Calculate smoke density if player camera is inside any smoke cloud
    let smokeDensity = 0;
    const camEyeY =
      camActor.position[1] +
      (camActor.crouching
        ? PLAYER_DIMENSIONS.EYE_CROUCH
        : PLAYER_DIMENSIONS.EYE_STAND);
    for (let i = 0; i < this.smokeClouds.length; i++) {
      const s = this.smokeClouds[i];
      const dx = s.position[0] - camActor.position[0];
      const dy = s.position[1] - camEyeY;
      const dz = s.position[2] - camActor.position[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist < s.radius) {
        const factor = 1 - dist / s.radius;
        smokeDensity = Math.max(smokeDensity, factor > 0.08 ? 0.98 : factor * 12.0);
      }
    }

    const flashAlpha =
      camActor.flashBlindTimer > 1.8
        ? 1.0
        : camActor.flashBlindTimer > 0
        ? camActor.flashBlindTimer / 1.8
        : 0;

    useGameStore.getState().updateHUD({
      roundPhase: this.roundPhase,
      roundNumber: this.roundNumber,
      ctScore: this.ctScore,
      tScore: this.tScore,
      phaseTimeRemaining: Math.max(0, this.phaseTimer),
      playerTeam: local.team,
      playerAlive: local.alive,
      playerHp: camActor.hp,
      playerArmor: camActor.armor,
      playerHasHelmet: camActor.hasHelmet,
      playerHasDefuseKit: camActor.hasDefuseKit,
      playerHasC4: camActor.hasC4,
      playerMoney: local.money,
      inBuyZone: inBuy,
      activeBombSite: activeSite,
      activeWeapon: camActor.activeWeapon,
      ammoMag: camActor.ammoMag[camActor.activeWeapon] ?? 0,
      ammoReserve: camActor.ammoReserve[camActor.activeWeapon] ?? 0,
      isReloading: camActor.reloadTimer > 0,
      primaryWeapon: camActor.primaryWeapon,
      secondaryWeapon: camActor.secondaryWeapon,
      grenades: [...camActor.grenades],
      zoomLevel: camActor.zoomLevel,
      crosshairSpreadPx: dynamicSpreadPx,
      bombState: this.bomb.state,
      bombSite: this.bomb.site,
      bombTimeRemaining: this.bomb.timeRemaining,
      actionProgress,
      actionLabel,
      flashAlpha,
      smokeDensity,
      spectatingName: local.alive ? null : camActor.name,
      ctAliveCount: this.actors.filter((a) => a.team === 'CT' && a.alive).length,
      tAliveCount: this.actors.filter((a) => a.team === 'T' && a.alive).length,
      radar: {
        localX: camActor.position[0],
        localZ: camActor.position[2],
        localYaw: camActor.yaw,
        dots,
        bombPosition:
          this.bomb.state === 'planted' ||
          this.bomb.state === 'dropped' ||
          local.team === 'T'
            ? [...this.bomb.position]
            : null,
        bombState: this.bomb.state,
      },
      ...(forceFull || useGameStore.getState().scoreboardOpen
        ? {
            scoreboard: this.actors.map((a) => ({
              id: a.id,
              name: a.name,
              team: a.team,
              isBot: a.isBot,
              alive: a.alive,
              hp: a.hp,
              armor: a.armor,
              hasHelmet: a.hasHelmet,
              hasDefuseKit: a.hasDefuseKit,
              hasC4: a.hasC4,
              money: a.money,
              kills: a.kills,
              deaths: a.deaths,
              assists: a.assists,
              mvps: a.mvps,
              ping: a.ping,
              primaryWeapon: a.primaryWeapon,
            })),
          }
        : {}),
    });
  }
}

export const gameSim = new GameSimulation();

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  };
  w.render_game_to_text = () => {
    const store = useGameStore.getState();
    const local = gameSim.getLocalPlayer();
    return JSON.stringify({
      screenState: store.screenState,
      isMultiplayer: store.isMultiplayer,
      roundPhase: gameSim.roundPhase,
      roundNumber: gameSim.roundNumber,
      phaseTimer: Number(gameSim.phaseTimer.toFixed(2)),
      actorCount: gameSim.actors.length,
      botCount: gameSim.actors.filter((a) => a.isBot).length,
      player: local
        ? {
            id: local.id,
            team: local.team,
            position: local.position.map((v) => Number(v.toFixed(2))),
            velocity: local.velocity.map((v) => Number(v.toFixed(2))),
            crouching: local.crouching,
            activeWeapon: local.activeWeapon,
            money: local.money,
          }
        : null,
    });
  };
  w.advanceTime = (ms: number) => {
    const steps = Math.max(1, Math.round(ms / 16.67));
    const dt = ms / 1000 / steps;
    for (let i = 0; i < steps; i++) {
      gameSim.step(dt);
    }
  };
}

