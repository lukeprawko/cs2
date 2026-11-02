import { create } from 'zustand';
import { Team } from '../game/WeaponsDB';

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type MatchLength = 'MR12' | 'MR15';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export type CrosshairColor = 'amber' | 'green' | 'cyan' | 'white' | 'red';

export const CROSSHAIR_COLOR_MAP: Record<CrosshairColor, string> = {
  amber: '#fbbf24',
  green: '#22c55e',
  cyan: '#06b6d4',
  white: '#f8fafc',
  red: '#ef4444',
};

export interface SettingsState {
  playerName: string;
  preferredTeam: Team;
  botDifficulty: BotDifficulty;
  matchLength: MatchLength;
  mouseSensitivity: number;
  volume: number;
  muted: boolean;
  fov: number;
  graphicsQuality: GraphicsQuality;
  renderScale: number;
  shadowsEnabled: boolean;
  dynamicLights: boolean;
  exposure: number;
  showFps: boolean;
  serverUrl: string;

  // Crosshair customization
  crosshairColor: CrosshairColor;
  crosshairSize: number; // line length px (2..18)
  crosshairGap: number; // center gap px (0..14)
  crosshairThickness: number; // line thickness px (1..4)
  crosshairDot: boolean;
  crosshairOutline: boolean;
  crosshairDynamic: boolean;

  setPlayerName: (name: string) => void;
  setPreferredTeam: (team: Team) => void;
  setBotDifficulty: (diff: BotDifficulty) => void;
  setMatchLength: (len: MatchLength) => void;
  setMouseSensitivity: (sens: number) => void;
  setVolume: (vol: number) => void;
  setMuted: (muted: boolean) => void;
  setFov: (fov: number) => void;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  setRenderScale: (scale: number) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  setDynamicLights: (enabled: boolean) => void;
  setExposure: (exp: number) => void;
  setShowFps: (show: boolean) => void;
  setServerUrl: (url: string) => void;

  setCrosshairColor: (c: CrosshairColor) => void;
  setCrosshairSize: (size: number) => void;
  setCrosshairGap: (gap: number) => void;
  setCrosshairThickness: (thick: number) => void;
  setCrosshairDot: (dot: boolean) => void;
  setCrosshairOutline: (outline: boolean) => void;
  setCrosshairDynamic: (dyn: boolean) => void;
}

const STORAGE_KEY = 'dust_alley_settings_v2';

interface StoredSettings {
  playerName: string;
  preferredTeam: Team;
  botDifficulty: BotDifficulty;
  matchLength: MatchLength;
  mouseSensitivity: number;
  volume: number;
  muted: boolean;
  fov: number;
  graphicsQuality: GraphicsQuality;
  renderScale: number;
  shadowsEnabled: boolean;
  dynamicLights: boolean;
  exposure: number;
  showFps: boolean;
  serverUrl?: string;
  crosshairColor: CrosshairColor;
  crosshairSize: number;
  crosshairGap: number;
  crosshairThickness: number;
  crosshairDot: boolean;
  crosshairOutline: boolean;
  crosshairDynamic: boolean;
}

function loadSettings(): Partial<StoredSettings> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<StoredSettings>;
  } catch {
    return {};
  }
}

function saveSettings(state: StoredSettings): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

const initial = loadSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  playerName: initial.playerName || 'Operator_01',
  preferredTeam: initial.preferredTeam || 'CT',
  botDifficulty: initial.botDifficulty || 'medium',
  matchLength: initial.matchLength || 'MR12',
  mouseSensitivity: initial.mouseSensitivity ?? 1.8,
  volume: initial.volume ?? 0.7,
  muted: initial.muted ?? false,
  fov: initial.fov ?? 90,
  graphicsQuality: initial.graphicsQuality || 'high',
  renderScale: initial.renderScale ?? 1.0,
  shadowsEnabled: initial.shadowsEnabled ?? true,
  dynamicLights: initial.dynamicLights ?? true,
  exposure: initial.exposure ?? 0.85,
  showFps: initial.showFps ?? true,
  serverUrl: initial.serverUrl ?? '',

  crosshairColor: initial.crosshairColor || 'green',
  crosshairSize: initial.crosshairSize ?? 7,
  crosshairGap: initial.crosshairGap ?? 4,
  crosshairThickness: initial.crosshairThickness ?? 2,
  crosshairDot: initial.crosshairDot ?? true,
  crosshairOutline: initial.crosshairOutline ?? true,
  crosshairDynamic: initial.crosshairDynamic ?? true,

  setPlayerName: (playerName) => {
    set({ playerName });
    saveSettings(get());
  },
  setPreferredTeam: (preferredTeam) => {
    set({ preferredTeam });
    saveSettings(get());
  },
  setBotDifficulty: (botDifficulty) => {
    set({ botDifficulty });
    saveSettings(get());
  },
  setMatchLength: (matchLength) => {
    set({ matchLength });
    saveSettings(get());
  },
  setMouseSensitivity: (mouseSensitivity) => {
    set({ mouseSensitivity: Math.max(0.2, Math.min(6.0, mouseSensitivity)) });
    saveSettings(get());
  },
  setVolume: (volume) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
    saveSettings(get());
  },
  setMuted: (muted) => {
    set({ muted });
    saveSettings(get());
  },
  setFov: (fov) => {
    set({ fov: Math.max(60, Math.min(110, Math.round(fov))) });
    saveSettings(get());
  },
  setGraphicsQuality: (graphicsQuality) => {
    const presetMap: Record<
      GraphicsQuality,
      { renderScale: number; shadowsEnabled: boolean; dynamicLights: boolean }
    > = {
      low: { renderScale: 0.65, shadowsEnabled: false, dynamicLights: false },
      medium: { renderScale: 0.85, shadowsEnabled: true, dynamicLights: false },
      high: { renderScale: 1.0, shadowsEnabled: true, dynamicLights: true },
      ultra: { renderScale: 1.25, shadowsEnabled: true, dynamicLights: true },
    };
    const p = presetMap[graphicsQuality];
    set({
      graphicsQuality,
      renderScale: p.renderScale,
      shadowsEnabled: p.shadowsEnabled,
      dynamicLights: p.dynamicLights,
    });
    saveSettings(get());
  },
  setRenderScale: (renderScale) => {
    set({ renderScale: Math.max(0.5, Math.min(1.25, renderScale)) });
    saveSettings(get());
  },
  setShadowsEnabled: (shadowsEnabled) => {
    set({ shadowsEnabled });
    saveSettings(get());
  },
  setDynamicLights: (dynamicLights) => {
    set({ dynamicLights });
    saveSettings(get());
  },
  setExposure: (exposure) => {
    set({ exposure: Math.max(0.7, Math.min(1.6, exposure)) });
    saveSettings(get());
  },
  setShowFps: (showFps) => {
    set({ showFps });
    saveSettings(get());
  },
  setServerUrl: (serverUrl) => {
    set({ serverUrl });
    saveSettings(get());
  },

  setCrosshairColor: (crosshairColor) => {
    set({ crosshairColor });
    saveSettings(get());
  },
  setCrosshairSize: (crosshairSize) => {
    set({ crosshairSize: Math.max(0, Math.min(18, Math.round(crosshairSize))) });
    saveSettings(get());
  },
  setCrosshairGap: (crosshairGap) => {
    set({ crosshairGap: Math.max(0, Math.min(14, Math.round(crosshairGap))) });
    saveSettings(get());
  },
  setCrosshairThickness: (crosshairThickness) => {
    set({ crosshairThickness: Math.max(1, Math.min(4, Math.round(crosshairThickness))) });
    saveSettings(get());
  },
  setCrosshairDot: (crosshairDot) => {
    set({ crosshairDot });
    saveSettings(get());
  },
  setCrosshairOutline: (crosshairOutline) => {
    set({ crosshairOutline });
    saveSettings(get());
  },
  setCrosshairDynamic: (crosshairDynamic) => {
    set({ crosshairDynamic });
    saveSettings(get());
  },
}));
