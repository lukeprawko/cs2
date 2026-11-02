import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { exitPointerLockSafe } from '../engine/InputManager';
import { BombSite, BombState } from '../game/BombLogic';
import { Team, WeaponId } from '../game/WeaponsDB';

export type ScreenState = 'title' | 'playing' | 'paused' | 'gameover';
export type RoundPhase = 'buy' | 'live' | 'planted' | 'round_end' | 'match_end';

export interface KillFeedEntry {
  id: string;
  killerName: string;
  killerTeam: Team;
  victimName: string;
  victimTeam: Team;
  weaponId: WeaponId | 'c4';
  isHeadshot: boolean;
  isWallbang: boolean;
  timestamp: number;
}

export interface RadioMessage {
  id: string;
  senderName: string;
  team: Team;
  text: string;
  timestamp: number;
}

export interface ScoreboardPlayer {
  id: string;
  name: string;
  team: Team;
  isBot: boolean;
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
  primaryWeapon: WeaponId | null;
}

export interface RadarActorDot {
  id: string;
  team: Team;
  x: number;
  z: number;
  yaw: number;
  isLocal: boolean;
  alive: boolean;
}

export interface RadarSnapshot {
  localX: number;
  localZ: number;
  localYaw: number;
  dots: RadarActorDot[];
  bombPosition: [number, number, number] | null;
  bombState: BombState;
}

export interface RoundEndSummary {
  winner: Team;
  reason: string;
  mvpName: string;
  mvpReason: string;
}

export interface MultiplayerLobbyState {
  connected: boolean;
  inRoom: boolean;
  roomCode: string;
  isHost: boolean;
  fillWithBots: boolean;
  error: string | null;
  players: Array<{ id: string; name: string; team: Team; isHost: boolean }>;
}

export interface GameHUDState {
  screenState: ScreenState;
  isMultiplayer: boolean;
  buyMenuOpen: boolean;
  scoreboardOpen: boolean;

  roundPhase: RoundPhase;
  roundNumber: number;
  maxRounds: number;
  ctScore: number;
  tScore: number;
  phaseTimeRemaining: number; // seconds

  // Player status
  playerTeam: Team;
  playerAlive: boolean;
  playerHp: number;
  playerArmor: number;
  playerHasHelmet: boolean;
  playerHasDefuseKit: boolean;
  playerHasC4: boolean;
  playerMoney: number;
  inBuyZone: boolean;
  activeBombSite: BombSite | null;

  // Equipped weapon & inventory
  activeWeapon: WeaponId;
  ammoMag: number;
  ammoReserve: number;
  isReloading: boolean;
  primaryWeapon: WeaponId | null;
  secondaryWeapon: WeaponId;
  grenades: WeaponId[];
  zoomLevel: number; // 0 = unscoped, 1 = zoom1, 2 = zoom2
  crosshairSpreadPx: number;

  // Bomb status
  bombState: BombState;
  bombSite: BombSite | null;
  bombTimeRemaining: number;
  actionProgress: number; // 0..1 for planting or defusing
  actionLabel: string | null;

  // Combat feedback
  flashAlpha: number; // 0..1 whiteout
  smokeDensity: number; // 0..1 inside smoke cloud
  hitMarker: 'none' | 'normal' | 'headshot';
  damageIndicatorAngle: number | null; // radians relative to player look
  spectatingName: string | null;

  // Lists
  ctAliveCount: number;
  tAliveCount: number;
  killFeed: KillFeedEntry[];
  radioFeed: RadioMessage[];
  scoreboard: ScoreboardPlayer[];
  roundEndSummary: RoundEndSummary | null;
  radar: RadarSnapshot;
  lobby: MultiplayerLobbyState;

  // Actions
  setScreenState: (s: ScreenState) => void;
  setBuyMenuOpen: (open: boolean) => void;
  setScoreboardOpen: (open: boolean) => void;
  updateHUD: (partial: Partial<GameHUDState>) => void;
  pushKillFeed: (entry: KillFeedEntry) => void;
  pushRadio: (msg: RadioMessage) => void;
  setLobbyState: (partial: Partial<MultiplayerLobbyState>) => void;
}

export const useGameStore = create<GameHUDState>()(
  subscribeWithSelector((set) => ({
    screenState: 'title',
    isMultiplayer: false,
    buyMenuOpen: false,
    scoreboardOpen: false,

    roundPhase: 'buy',
    roundNumber: 1,
    maxRounds: 24,
    ctScore: 0,
    tScore: 0,
    phaseTimeRemaining: 15,

    playerTeam: 'CT',
    playerAlive: true,
    playerHp: 100,
    playerArmor: 0,
    playerHasHelmet: false,
    playerHasDefuseKit: false,
    playerHasC4: false,
    playerMoney: 800,
    inBuyZone: true,
    activeBombSite: null,

    activeWeapon: 'usp',
    ammoMag: 12,
    ammoReserve: 36,
    isReloading: false,
    primaryWeapon: null,
    secondaryWeapon: 'usp',
    grenades: [],
    zoomLevel: 0,
    crosshairSpreadPx: 6,

    bombState: 'carried',
    bombSite: null,
    bombTimeRemaining: 40,
    actionProgress: 0,
    actionLabel: null,

    flashAlpha: 0,
    smokeDensity: 0,
    hitMarker: 'none',
    damageIndicatorAngle: null,
    spectatingName: null,

    ctAliveCount: 5,
    tAliveCount: 5,
    killFeed: [],
    radioFeed: [],
    scoreboard: [],
    roundEndSummary: null,
    radar: {
      localX: 0,
      localZ: -37,
      localYaw: Math.PI,
      dots: [],
      bombPosition: null,
      bombState: 'carried',
    },
    lobby: {
      connected: false,
      inRoom: false,
      roomCode: '',
      isHost: false,
      fillWithBots: false,
      error: null,
      players: [],
    },

    setScreenState: (screenState) => {
      if (typeof document !== 'undefined') {
        document.body.dataset.state = screenState;
        if (screenState !== 'playing') {
          exitPointerLockSafe();
        }
      }
      set({ screenState });
    },

    setBuyMenuOpen: (buyMenuOpen) => {
      if (buyMenuOpen) {
        exitPointerLockSafe();
      }
      set({ buyMenuOpen });
    },

    setScoreboardOpen: (scoreboardOpen) => set({ scoreboardOpen }),

    updateHUD: (partial) => set(partial),

    pushKillFeed: (entry) =>
      set((state) => ({
        killFeed: [...state.killFeed.slice(-5), entry],
      })),

    pushRadio: (msg) =>
      set((state) => ({
        radioFeed: [...state.radioFeed.slice(-3), msg],
      })),

    setLobbyState: (partial) =>
      set((state) => ({
        lobby: { ...state.lobby, ...partial },
      })),
  }))
);
