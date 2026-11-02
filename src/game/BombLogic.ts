export const BOMB_CONSTANTS = {
  PLANT_TIME: 3.2, // seconds
  BOMB_TIMER: 40.0, // seconds after plant
  DEFUSE_TIME_NO_KIT: 10.0, // seconds
  DEFUSE_TIME_WITH_KIT: 5.0, // seconds
  EXPLOSION_MAX_DAMAGE: 500,
  EXPLOSION_RADIUS: 38.0, // meters
  INTERACTION_RADIUS: 2.6, // meters to pick up or defuse C4
};

export type BombSite = 'A' | 'B';

export type BombState =
  | 'carried'
  | 'dropped'
  | 'planting'
  | 'planted'
  | 'defused'
  | 'exploded';

export interface BombData {
  state: BombState;
  carrierId: string | null;
  position: [number, number, number];
  site: BombSite | null;
  plantProgress: number; // 0.0 to 1.0
  planterId: string | null;
  timeRemaining: number; // 40.0 down to 0
  defuseProgress: number; // 0.0 to 1.0
  defuserId: string | null;
  defuserHasKit: boolean;
  beepTimer: number;
}

export function createInitialBombData(carrierId: string | null, spawnPos: [number, number, number]): BombData {
  return {
    state: carrierId ? 'carried' : 'dropped',
    carrierId,
    position: [...spawnPos],
    site: null,
    plantProgress: 0,
    planterId: null,
    timeRemaining: BOMB_CONSTANTS.BOMB_TIMER,
    defuseProgress: 0,
    defuserId: null,
    defuserHasKit: false,
    beepTimer: 0,
  };
}

/**
 * Returns the current interval between C4 beeps in seconds.
 * Accelerates dramatically in the last 10 seconds.
 */
export function getBombBeepInterval(timeRemaining: number): number {
  const clamped = Math.max(0, Math.min(BOMB_CONSTANTS.BOMB_TIMER, timeRemaining));
  if (clamped > 25) return 1.05;
  if (clamped > 15) return 0.72;
  if (clamped > 10) return 0.48;
  if (clamped > 5) return 0.25;
  if (clamped > 2) return 0.14;
  return 0.08;
}

/**
 * Calculates C4 explosion damage at a given distance in meters.
 */
export function getBombExplosionDamage(distance: number): number {
  if (distance >= BOMB_CONSTANTS.EXPLOSION_RADIUS) return 0;
  const falloff = 1 - distance / BOMB_CONSTANTS.EXPLOSION_RADIUS;
  return Math.round(BOMB_CONSTANTS.EXPLOSION_MAX_DAMAGE * Math.pow(falloff, 1.5));
}
