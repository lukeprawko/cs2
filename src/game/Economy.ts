import { EQUIPMENT_DB, Team, WEAPONS_DB, WeaponId } from './WeaponsDB';
export { EQUIPMENT_DB };

export const ECONOMY_CONSTANTS = {
  START_MONEY: 800,
  MAX_MONEY: 16000,
  WIN_REWARD_ELIMINATION: 3250,
  WIN_REWARD_BOMB_DEFUSED: 3500,
  WIN_REWARD_BOMB_EXPLODED: 3500,
  WIN_REWARD_TIME_EXPIRED: 3250,
  LOSS_BONUSES: [1400, 1900, 2400, 2900, 3400],
  BOMB_PLANT_INDIVIDUAL: 300,
  BOMB_PLANT_TEAM_BONUS_ON_LOSS: 800,
  BOMB_DEFUSE_INDIVIDUAL: 300,
  MAX_GRENADES: 4,
};

export type HitboxZone = 'head' | 'chest' | 'stomach' | 'legs';

export interface DamageResult {
  healthDamage: number;
  armorDamage: number;
  isHeadshot: boolean;
}

export function clampMoney(amount: number): number {
  return Math.max(0, Math.min(ECONOMY_CONSTANTS.MAX_MONEY, Math.round(amount)));
}

export function getLossBonus(consecutiveLosses: number): number {
  const idx = Math.max(
    0,
    Math.min(
      ECONOMY_CONSTANTS.LOSS_BONUSES.length - 1,
      consecutiveLosses - 1
    )
  );
  return ECONOMY_CONSTANTS.LOSS_BONUSES[idx];
}

/**
 * Calculates CS-style hit damage taking into account hitbox multiplier,
 * distance drop-off, wall penetration loss, armor, and helmet.
 */
export function calculateHitDamage(
  weaponId: WeaponId,
  zone: HitboxZone,
  distance: number,
  targetArmor: number,
  targetHasHelmet: boolean,
  penetratedWallThickness = 0
): DamageResult {
  const spec = WEAPONS_DB[weaponId];
  let base = spec.damage;

  // Distance falloff (mild, realistic)
  const falloff = Math.pow(0.98, distance / 10);
  base *= falloff;

  // Wall penetration reduction
  if (penetratedWallThickness > 0) {
    const ratio = Math.min(
      0.7,
      penetratedWallThickness / Math.max(0.1, spec.wallPenetration)
    );
    base *= 1 - ratio * 0.65;
  }

  // Hitbox zone multiplier
  let mult = 1.0;
  if (zone === 'head') mult = 4.0;
  else if (zone === 'stomach') mult = 1.25;
  else if (zone === 'legs') mult = 0.75;

  const rawDamage = base * mult;
  const isProtected =
    targetArmor > 0 &&
    (zone === 'chest' ||
      zone === 'stomach' ||
      (zone === 'head' && targetHasHelmet));

  if (!isProtected) {
    return {
      healthDamage: Math.max(1, Math.round(rawDamage)),
      armorDamage: 0,
      isHeadshot: zone === 'head',
    };
  }

  const penetratedDamage = rawDamage * spec.armorPenetration;
  const absorbedByArmor = (rawDamage - penetratedDamage) * 0.5;
  const actualArmorCost = Math.min(targetArmor, Math.ceil(absorbedByArmor));

  return {
    healthDamage: Math.max(1, Math.round(penetratedDamage)),
    armorDamage: actualArmorCost,
    isHeadshot: zone === 'head',
  };
}

export interface BotLoadoutState {
  money: number;
  team: Team;
  primary: WeaponId | null;
  secondary: WeaponId;
  grenades: WeaponId[];
  armor: number;
  hasHelmet: boolean;
  hasDefuseKit: boolean;
}

/**
 * Determines how a bot spends money at the start of a round:
 * - Full buy (>= 3900): Armor+Helmet, Rifle/AWP, Grenades, Defuse Kit (CT)
 * - Force buy (2000 - 3899): Kevlar, SMG/Shotgun or Deagle, Flash/Smoke
 * - Eco (< 2000): Save money or buy Deagle/CZ75/Flash if > 1400
 */
export function executeBotAutoBuy(state: BotLoadoutState, preferSniper = false): BotLoadoutState {
  const next: BotLoadoutState = {
    ...state,
    grenades: [...state.grenades],
  };

  // Full buy
  if (next.money >= 3700) {
    if (!next.hasHelmet && next.money >= EQUIPMENT_DB.kevlar_helmet.price) {
      const cost = next.armor >= 50 ? 350 : EQUIPMENT_DB.kevlar_helmet.price;
      next.money -= cost;
      next.armor = 100;
      next.hasHelmet = true;
    }
    if (!next.primary) {
      if (preferSniper && next.money >= WEAPONS_DB.awp.price) {
        next.primary = 'awp';
        next.money -= WEAPONS_DB.awp.price;
      } else {
        const rifle: WeaponId = next.team === 'CT' ? 'm4a1s' : 'ak47';
        if (next.money >= WEAPONS_DB[rifle].price) {
          next.primary = rifle;
          next.money -= WEAPONS_DB[rifle].price;
        }
      }
    }
    if (
      next.team === 'CT' &&
      !next.hasDefuseKit &&
      next.money >= EQUIPMENT_DB.defuse_kit.price
    ) {
      next.hasDefuseKit = true;
      next.money -= EQUIPMENT_DB.defuse_kit.price;
    }
    // Buy utility
    const desiredNades: WeaponId[] = ['smoke_grenade', 'flashbang', 'he_grenade'];
    for (const nade of desiredNades) {
      if (
        next.grenades.length < ECONOMY_CONSTANTS.MAX_GRENADES &&
        !next.grenades.includes(nade) &&
        next.money >= WEAPONS_DB[nade].price
      ) {
        next.grenades.push(nade);
        next.money -= WEAPONS_DB[nade].price;
      }
    }
    return next;
  }

  // Force buy
  if (next.money >= 2000) {
    if (next.armor < 50 && next.money >= EQUIPMENT_DB.kevlar.price) {
      next.armor = 100;
      next.money -= EQUIPMENT_DB.kevlar.price;
    }
    if (!next.primary) {
      const smg: WeaponId = next.team === 'CT' ? 'mp9' : 'mac10';
      if (next.money >= WEAPONS_DB[smg].price) {
        next.primary = smg;
        next.money -= WEAPONS_DB[smg].price;
      }
    }
    if (
      next.grenades.length < 2 &&
      next.money >= WEAPONS_DB.flashbang.price
    ) {
      next.grenades.push('flashbang');
      next.money -= WEAPONS_DB.flashbang.price;
    }
    return next;
  }

  // Eco / Pistol round
  if (next.money === 800 && next.armor === 0) {
    next.armor = 100;
    next.money -= EQUIPMENT_DB.kevlar.price;
  } else if (next.money >= 1450 && next.secondary !== 'deagle') {
    next.secondary = 'deagle';
    next.money -= WEAPONS_DB.deagle.price;
  }

  return next;
}
