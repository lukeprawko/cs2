import React, { useEffect, useState } from 'react';
import { audioEngine } from '../engine/AudioEngine';
import { gameSim } from '../engine/GameLoop';
import {
  requestFullscreenSafe,
  requestPointerLockSafe,
} from '../engine/InputManager';
import { multiplayerClient } from '../game/MultiplayerClient';
import { Team } from '../game/WeaponsDB';
import { useGameStore } from '../store/useGameStore';
import {
  BotDifficulty,
  CROSSHAIR_COLOR_MAP,
  CrosshairColor,
  GraphicsQuality,
  MatchLength,
  useSettingsStore,
} from '../store/useSettingsStore';
import { TitleEmblemSVG } from './icons';

export const Menu: React.FC = () => {
  const screenState = useGameStore((s) => s.screenState);
  const setScreenState = useGameStore((s) => s.setScreenState);
  const lobby = useGameStore((s) => s.lobby);

  const playerName = useSettingsStore((s) => s.playerName);
  const preferredTeam = useSettingsStore((s) => s.preferredTeam);
  const botDifficulty = useSettingsStore((s) => s.botDifficulty);
  const matchLength = useSettingsStore((s) => s.matchLength);
  const mouseSensitivity = useSettingsStore((s) => s.mouseSensitivity);
  const volume = useSettingsStore((s) => s.volume);
  const fov = useSettingsStore((s) => s.fov);
  const graphicsQuality = useSettingsStore((s) => s.graphicsQuality);
  const renderScale = useSettingsStore((s) => s.renderScale);
  const shadowsEnabled = useSettingsStore((s) => s.shadowsEnabled);
  const dynamicLights = useSettingsStore((s) => s.dynamicLights);
  const exposure = useSettingsStore((s) => s.exposure);
  const showFps = useSettingsStore((s) => s.showFps);
  const serverUrl = useSettingsStore((s) => s.serverUrl);

  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const crosshairSize = useSettingsStore((s) => s.crosshairSize);
  const crosshairGap = useSettingsStore((s) => s.crosshairGap);
  const crosshairThickness = useSettingsStore((s) => s.crosshairThickness);
  const crosshairDot = useSettingsStore((s) => s.crosshairDot);
  const crosshairOutline = useSettingsStore((s) => s.crosshairOutline);
  const crosshairDynamic = useSettingsStore((s) => s.crosshairDynamic);

  const setPlayerName = useSettingsStore((s) => s.setPlayerName);
  const setPreferredTeam = useSettingsStore((s) => s.setPreferredTeam);
  const setBotDifficulty = useSettingsStore((s) => s.setBotDifficulty);
  const setMatchLength = useSettingsStore((s) => s.setMatchLength);
  const setMouseSensitivity = useSettingsStore((s) => s.setMouseSensitivity);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setFov = useSettingsStore((s) => s.setFov);
  const setGraphicsQuality = useSettingsStore((s) => s.setGraphicsQuality);
  const setRenderScale = useSettingsStore((s) => s.setRenderScale);
  const setShadowsEnabled = useSettingsStore((s) => s.setShadowsEnabled);
  const setDynamicLights = useSettingsStore((s) => s.setDynamicLights);
  const setExposure = useSettingsStore((s) => s.setExposure);
  const setShowFps = useSettingsStore((s) => s.setShowFps);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);

  const setCrosshairColor = useSettingsStore((s) => s.setCrosshairColor);
  const setCrosshairSize = useSettingsStore((s) => s.setCrosshairSize);
  const setCrosshairGap = useSettingsStore((s) => s.setCrosshairGap);
  const setCrosshairThickness = useSettingsStore((s) => s.setCrosshairThickness);
  const setCrosshairDot = useSettingsStore((s) => s.setCrosshairDot);
  const setCrosshairOutline = useSettingsStore((s) => s.setCrosshairOutline);
  const setCrosshairDynamic = useSettingsStore((s) => s.setCrosshairDynamic);

  const [modeTab, setModeTab] = useState<'offline' | 'online' | 'settings'>('offline');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [createWithBots, setCreateWithBots] = useState(false);

  // Bind Enter / Space on title screen to start offline match (unless typing in input or inside lobby room)
  useEffect(() => {
    if (screenState !== 'title') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (
        (e.code === 'Enter' || e.code === 'Space') &&
        modeTab === 'offline' &&
        !lobby.inRoom
      ) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        requestFullscreenSafe();
        gameSim.startOfflineMatch();
        requestPointerLockSafe();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenState, modeTab, lobby.inRoom]);

  // Attempt connection when user enters online tab
  useEffect(() => {
    if (modeTab === 'online') {
      multiplayerClient.connect();
    }
  }, [modeTab, serverUrl]);

  const isDotOnly = crosshairSize === 0 && crosshairDot;

  const renderCrosshairControls = () => {
    const chHex = CROSSHAIR_COLOR_MAP[crosshairColor] || '#22c55e';
    const chShadow = crosshairOutline
      ? '0 0 1px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)'
      : 'none';

    return (
      <div className="p-3.5 rounded-[4px] bg-[rgba(12,15,20,0.88)] border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
              Celownik
            </span>
            <div className="flex gap-2">
              {(
                [
                  { id: 'green', label: 'Zielony' },
                  { id: 'amber', label: 'Bursztyn' },
                  { id: 'cyan', label: 'Cyjan' },
                  { id: 'white', label: 'Biały' },
                  { id: 'red', label: 'Czerwony' },
                ] as Array<{ id: CrosshairColor; label: string }>
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setCrosshairColor(c.id)}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    crosshairColor === c.id
                      ? 'border-white scale-125 shadow-sm'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: CROSSHAIR_COLOR_MAP[c.id] }}
                />
              ))}
            </div>
          </div>

          {/* Live Crosshair Preview Box */}
          <div className="relative w-16 h-10 rounded-[3px] bg-zinc-900/90 border border-white/10 flex items-center justify-center overflow-hidden">
            <div className="relative">
              {crosshairSize > 0 && (
                <>
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{
                      width: `${crosshairThickness}px`,
                      height: `${crosshairSize}px`,
                      bottom: `${crosshairGap}px`,
                      backgroundColor: chHex,
                      boxShadow: chShadow,
                    }}
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{
                      width: `${crosshairThickness}px`,
                      height: `${crosshairSize}px`,
                      top: `${crosshairGap}px`,
                      backgroundColor: chHex,
                      boxShadow: chShadow,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      height: `${crosshairThickness}px`,
                      width: `${crosshairSize}px`,
                      right: `${crosshairGap}px`,
                      backgroundColor: chHex,
                      boxShadow: chShadow,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      height: `${crosshairThickness}px`,
                      width: `${crosshairSize}px`,
                      left: `${crosshairGap}px`,
                      backgroundColor: chHex,
                      boxShadow: chShadow,
                    }}
                  />
                </>
              )}
              {crosshairDot && (
                <div
                  className="rounded-full"
                  style={{
                    width: `${Math.max(2, crosshairThickness + (isDotOnly ? 1 : 0))}px`,
                    height: `${Math.max(2, crosshairThickness + (isDotOnly ? 1 : 0))}px`,
                    backgroundColor: chHex,
                    boxShadow: chShadow,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              <span>Rozmiar</span>
              <span className="font-mono-num text-amber-400">{crosshairSize}px</span>
            </label>
            <input
              type="range"
              min={0}
              max={16}
              step={1}
              value={crosshairSize}
              onChange={(e) => setCrosshairSize(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-1.5"
            />
          </div>

          <div>
            <label className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              <span>Odstęp</span>
              <span className="font-mono-num text-amber-400">{crosshairGap}px</span>
            </label>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={crosshairGap}
              onChange={(e) => setCrosshairGap(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-1.5"
            />
          </div>

          <div>
            <label className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              <span>Grubość</span>
              <span className="font-mono-num text-amber-400">{crosshairThickness}px</span>
            </label>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={crosshairThickness}
              onChange={(e) => setCrosshairThickness(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              if (isDotOnly) {
                setCrosshairSize(7);
                setCrosshairDot(true);
              } else {
                setCrosshairSize(0);
                setCrosshairDot(true);
              }
            }}
            className={`py-1 px-2 rounded-[3px] border text-[11px] font-bold uppercase transition-colors ${
              isDotOnly
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-white/10 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isDotOnly ? 'Styl: Sama kropka' : 'Styl: Krzyżyk'}
          </button>
          <button
            type="button"
            onClick={() => setCrosshairOutline(!crosshairOutline)}
            className={`py-1 px-2 rounded-[3px] border text-[11px] font-bold uppercase transition-colors ${
              crosshairOutline
                ? 'border-amber-500/70 bg-amber-500/15 text-amber-300'
                : 'border-white/10 bg-zinc-900/80 text-zinc-400'
            }`}
          >
            Obrys: {crosshairOutline ? 'WŁ.' : 'WYŁ.'}
          </button>
          <button
            type="button"
            onClick={() => setCrosshairDynamic(!crosshairDynamic)}
            className={`py-1 px-2 rounded-[3px] border text-[11px] font-bold uppercase transition-colors ${
              crosshairDynamic
                ? 'border-amber-500/70 bg-amber-500/15 text-amber-300'
                : 'border-white/10 bg-zinc-900/80 text-zinc-400'
            }`}
          >
            Rozrzut: {crosshairDynamic ? 'DYN.' : 'STAŁY'}
          </button>
        </div>
      </div>
    );
  };

  const renderGraphicsControls = () => (
    <div className="p-3.5 rounded-[4px] bg-[rgba(12,15,20,0.88)] border border-white/10 space-y-3">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
          Grafika i Wydajność
        </span>
        <div className="flex gap-1.5">
          {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setGraphicsQuality(q)}
              className={`py-1 px-2 rounded-[3px] border text-[10px] font-bold uppercase transition-colors ${
                graphicsQuality === q
                  ? 'border-amber-500 bg-amber-500/25 text-amber-300'
                  : 'border-white/10 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {q === 'low'
                ? 'Niska'
                : q === 'medium'
                ? 'Średnia'
                : q === 'high'
                ? 'Wysoka'
                : 'Ultra'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            <span>Skala renderu</span>
            <span className="font-mono-num text-amber-400">
              {Math.round(renderScale * 100)}%
            </span>
          </label>
          <input
            type="range"
            min={0.5}
            max={1.25}
            step={0.05}
            value={renderScale}
            onChange={(e) => setRenderScale(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1.5"
          />
        </div>

        <div>
          <label className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            <span>Jasność</span>
            <span className="font-mono-num text-amber-400">
              {Math.round(exposure * 100)}%
            </span>
          </label>
          <input
            type="range"
            min={0.75}
            max={1.55}
            step={0.05}
            value={exposure}
            onChange={(e) => setExposure(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={() => setShadowsEnabled(!shadowsEnabled)}
          className={`py-1 px-2 rounded-[3px] border text-[11px] font-bold uppercase transition-colors ${
            shadowsEnabled
              ? 'border-amber-500/70 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-zinc-900/80 text-zinc-400'
          }`}
        >
          Cienie: {shadowsEnabled ? 'WŁ.' : 'WYŁ.'}
        </button>
        <button
          type="button"
          onClick={() => setDynamicLights(!dynamicLights)}
          className={`py-1 px-2 rounded-[3px] border text-[11px] font-bold uppercase transition-colors ${
            dynamicLights
              ? 'border-amber-500/70 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-zinc-900/80 text-zinc-400'
          }`}
        >
          Światła: {dynamicLights ? 'WŁ.' : 'WYŁ.'}
        </button>
        <button
          type="button"
          onClick={() => setShowFps(!showFps)}
          className={`py-1 px-2 rounded-[3px] border text-[11px] font-bold uppercase transition-colors ${
            showFps
              ? 'border-amber-500/70 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-zinc-900/80 text-zinc-400'
          }`}
        >
          FPS: {showFps ? 'WŁ.' : 'WYŁ.'}
        </button>
      </div>
    </div>
  );

  // PAUSE MODAL (`paused`)
  if (screenState === 'paused') {
    return (
      <div
        data-ui-interactive="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,14,0.84)] p-6 pointer-events-auto"
      >
        <div className="w-full max-w-lg rounded-[6px] bg-[rgba(15,18,24,0.97)] border border-white/15 p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold uppercase tracking-wider text-zinc-100">
              Mecz wstrzymany · Ustawienia
            </h2>
            <button
              type="button"
              onClick={() => requestFullscreenSafe()}
              className="px-2.5 py-1 rounded-[4px] border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider hover:bg-amber-500/25"
            >
              Pełny ekran
            </button>
          </div>

          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="flex justify-between text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  <span>Czułość</span>
                  <span className="font-mono-num text-amber-400">
                    {mouseSensitivity.toFixed(1)}
                  </span>
                </label>
                <input
                  type="range"
                  min={0.3}
                  max={5.0}
                  step={0.1}
                  value={mouseSensitivity}
                  onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  <span>Głośność</span>
                  <span className="font-mono-num text-amber-400">
                    {Math.round(volume * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  <span>FOV</span>
                  <span className="font-mono-num text-amber-400">{fov}°</span>
                </label>
                <input
                  type="range"
                  min={60}
                  max={110}
                  step={1}
                  value={fov}
                  onChange={(e) => setFov(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            {renderCrosshairControls()}
            {renderGraphicsControls()}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                audioEngine.playUIClick(false);
                requestFullscreenSafe();
                setScreenState('playing');
                requestPointerLockSafe();
              }}
              className="py-2.5 rounded-[4px] bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold uppercase tracking-wider text-xs transition-colors"
            >
              Wznów grę [Esc]
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUIClick(false);
                requestFullscreenSafe();
                gameSim.startOfflineMatch();
                requestPointerLockSafe();
              }}
              className="py-2.5 rounded-[4px] border border-white/15 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold uppercase tracking-wider text-xs transition-colors"
            >
              Restartuj mecz
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUIClick(false);
                multiplayerClient.leaveRoom();
                setScreenState('title');
              }}
              className="py-2.5 rounded-[4px] border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold uppercase tracking-wider text-xs transition-colors"
            >
              Menu główne
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screenState !== 'title') return null;

  // WHEN IN MULTIPLAYER ROOM (`lobby.inRoom === true`):
  // Render the exact centered Lobby Modal matching the user's reference screenshot (`POKÓJ VK6LS`)
  if (lobby.inRoom) {
    const ctPlayers = lobby.players.filter((p) => p.team === 'CT');
    const tPlayers = lobby.players.filter((p) => p.team === 'T');

    return (
      <div
        data-ui-interactive="true"
        className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,16,0.92)] p-6 pointer-events-auto"
      >
        <div className="w-full max-w-[740px] rounded-[2px] bg-[#14181f] border border-white/10 px-10 py-8 shadow-2xl">
          {/* Header: POKÓJ [VK6LS] */}
          <div className="flex items-center justify-center gap-4 mb-7">
            <h2 className="text-3xl font-extrabold uppercase tracking-[0.14em] text-zinc-100">
              POKÓJ
            </h2>
            <div className="px-4 py-1.5 bg-[#0c0f14] border border-white/5 rounded-[2px]">
              <span className="text-2xl font-extrabold font-mono-num tracking-[0.26em] text-amber-400">
                {lobby.roomCode}
              </span>
            </div>
          </div>

          {/* Two Team Columns: CT (Blue) & T (Orange) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* CT Column */}
            <div className="flex flex-col justify-between bg-[#181d26] border border-white/5 border-t-[3px] border-t-sky-400 p-4 min-h-[235px]">
              <div>
                <div className="text-lg font-extrabold uppercase tracking-wider text-sky-400 mb-3">
                  CT
                </div>
                <div className="space-y-2">
                  {ctPlayers.length === 0 ? (
                    <div className="px-3.5 py-2.5 bg-[#12161d] text-zinc-600 font-bold text-sm">
                      —
                    </div>
                  ) : (
                    ctPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#12161d] text-zinc-100 font-bold text-sm"
                      >
                        <span>{p.name}</span>
                        {p.isHost && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider rounded-[2px]">
                            HOST
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUIClick(false);
                  multiplayerClient.switchTeam('CT');
                }}
                className="mt-6 w-full py-2.5 bg-[#232934] hover:bg-[#2c3442] border border-white/10 text-zinc-100 font-bold uppercase tracking-wider text-xs transition-colors"
                style={{ transform: 'skewX(-12deg)' }}
              >
                <span className="inline-block" style={{ transform: 'skewX(12deg)' }}>
                  DOŁĄCZ DO CT
                </span>
              </button>
            </div>

            {/* T Column */}
            <div className="flex flex-col justify-between bg-[#181d26] border border-white/5 border-t-[3px] border-t-amber-500 p-4 min-h-[235px]">
              <div>
                <div className="text-lg font-extrabold uppercase tracking-wider text-amber-500 mb-3">
                  T
                </div>
                <div className="space-y-2">
                  {tPlayers.length === 0 ? (
                    <div className="px-3.5 py-2.5 bg-[#12161d] text-zinc-600 font-bold text-sm">
                      —
                    </div>
                  ) : (
                    tPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#12161d] text-zinc-100 font-bold text-sm"
                      >
                        <span>{p.name}</span>
                        {p.isHost && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider rounded-[2px]">
                            HOST
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUIClick(false);
                  multiplayerClient.switchTeam('T');
                }}
                className="mt-6 w-full py-2.5 bg-[#232934] hover:bg-[#2c3442] border border-white/10 text-zinc-100 font-bold uppercase tracking-wider text-xs transition-colors"
                style={{ transform: 'skewX(-12deg)' }}
              >
                <span className="inline-block" style={{ transform: 'skewX(12deg)' }}>
                  DOŁĄCZ DO T
                </span>
              </button>
            </div>
          </div>

          {/* Bot Fill Checkbox + Difficulty Select Row */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lobby.fillWithBots}
                disabled={!lobby.isHost}
                onChange={(e) =>
                  multiplayerClient.setFillWithBots(e.target.checked)
                }
                className="w-4 h-4 accent-amber-500 rounded-[2px] cursor-pointer"
              />
              <span className="text-sm font-bold text-zinc-100">
                Dopełnij botami
              </span>
            </label>

            <select
              aria-label="Poziom trudności botów w pokoju"
              value={botDifficulty}
              onChange={(e) =>
                setBotDifficulty(e.target.value as BotDifficulty)
              }
              className="px-3.5 py-1.5 bg-[#0e1217] border border-white/15 rounded-[2px] text-sm font-bold text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="easy">Łatwi</option>
              <option value="medium">Normalni</option>
              <option value="hard">Trudni</option>
              <option value="expert">Ekspert</option>
            </select>
          </div>

          {/* Action Buttons: START MECZU & WYJDŹ */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {lobby.isHost ? (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  audioEngine.playUIClick(true);
                  requestFullscreenSafe();
                  multiplayerClient.startMatch(lobby.fillWithBots);
                  requestPointerLockSafe();
                }}
                className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold uppercase tracking-wider text-sm transition-colors shadow-lg"
                style={{ transform: 'skewX(-12deg)' }}
              >
                <span className="inline-block" style={{ transform: 'skewX(12deg)' }}>
                  START MECZU
                </span>
              </button>
            ) : (
              <div className="px-6 py-3 bg-zinc-900 border border-white/10 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Oczekiwanie na start przez hosta...
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                audioEngine.playUIClick(false);
                multiplayerClient.leaveRoom();
              }}
              className="px-6 py-3 bg-[#28161b] hover:bg-[#381d24] border border-red-500/35 text-red-200 font-bold uppercase tracking-wider text-sm transition-colors"
              style={{ transform: 'skewX(-12deg)' }}
            >
              <span className="inline-block" style={{ transform: 'skewX(12deg)' }}>
                WYJDŹ
              </span>
            </button>
          </div>

          {/* Footer Info */}
          <div className="text-center text-xs font-semibold text-zinc-400 tracking-wide">
            Podaj kod {lobby.roomCode} znajomym. Graczy: {lobby.players.length} / 10.
          </div>
        </div>
      </div>
    );
  }

  // MAIN TITLE SCREEN (`title`) — Asymmetric Left Third Panel over Live 3D Dust Alley Tour
  return (
    <div
      data-ui-interactive="true"
      className="fixed inset-0 z-30 flex flex-col justify-between p-6 md:p-10 pointer-events-none select-none"
    >
      {/* Cinematic Ambient Vignette Overlay */}
      <div className="pointer-events-none fixed inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)] z-10" />

      {/* Top Tactical Status Ticker */}
      <div className="relative z-30 flex items-center justify-between text-[11px] font-mono-num font-semibold uppercase tracking-widest text-zinc-400 border-b border-white/10 pb-2 mb-4 bg-zinc-950/60 backdrop-blur-md px-4 py-2 rounded">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-200">DUST ALLEY · SECTOR 07</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400">TRYB: 5V5 PLANT / DEFUSE</span>
          <button
            type="button"
            onClick={() => requestFullscreenSafe()}
            className="pointer-events-auto px-2 py-0.5 rounded border border-white/20 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px] hover:border-amber-400 transition-colors"
          >
            Pełny ekran
          </button>
        </div>
      </div>

      <div
        className="relative z-30 w-full max-w-[460px] rounded-[6px] bg-[rgba(10,13,18,0.94)] border border-white/15 p-6 shadow-2xl pointer-events-auto backdrop-blur-md"
      >
        {/* Custom Inline SVG Title Lockup */}
        <div className="flex items-center justify-between gap-3.5 pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <TitleEmblemSVG className="w-10 h-10 shrink-0" />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wider text-zinc-100 leading-none">
                Dust Alley
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-amber-400 mt-1 font-semibold">
                Taktyczna Strzelanka 5v5 · Silnik PBR 3D
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider rounded">
              Wersja 2.0 HD
            </span>
          </div>
        </div>

        {/* Navigation Tabs (3 Clean Tabs) */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-[4px] bg-zinc-950/90 border border-white/10 mb-5">
          <button
            type="button"
            onClick={() => {
              audioEngine.playUIClick(false);
              setModeTab('offline');
            }}
            className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-[3px] transition-colors ${
              modeTab === 'offline'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mecz 5v5
          </button>
          <button
            type="button"
            onClick={() => {
              audioEngine.playUIClick(false);
              setModeTab('online');
            }}
            className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-[3px] transition-colors ${
              modeTab === 'online'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Multi
          </button>
          <button
            type="button"
            onClick={() => {
              audioEngine.playUIClick(false);
              setModeTab('settings');
            }}
            className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-[3px] transition-colors ${
              modeTab === 'settings'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Opcje
          </button>
        </div>

        {/* TAB 1: OFFLINE 5v5 MATCH (DEFAULT) */}
        {modeTab === 'offline' && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="operator-nick"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1"
              >
                Nick operatora
              </label>
              <input
                id="operator-nick"
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 rounded-[4px] bg-zinc-900 border border-white/15 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Wybór strony startowej
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['CT', 'T'] as Team[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPreferredTeam(t)}
                    className={`py-2 px-3 rounded-[4px] border text-xs font-bold uppercase tracking-wider transition-colors ${
                      preferredTeam === t
                        ? t === 'CT'
                          ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                          : 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-white/10 bg-zinc-900/70 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t === 'CT' ? 'CT · Antyterroryści' : 'T · Terroryści'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="bot-difficulty"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                >
                  Poziom botów
                </label>
                <select
                  id="bot-difficulty"
                  value={botDifficulty}
                  onChange={(e) =>
                    setBotDifficulty(e.target.value as BotDifficulty)
                  }
                  className="w-full px-2.5 py-2 rounded-[4px] bg-zinc-900 border border-white/15 text-xs font-semibold uppercase text-zinc-100"
                >
                  <option value="easy">Łatwy</option>
                  <option value="medium">Normalny</option>
                  <option value="hard">Trudny</option>
                  <option value="expert">Ekspert</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="match-format"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                >
                  Długość meczu
                </label>
                <select
                  id="match-format"
                  value={matchLength}
                  onChange={(e) =>
                    setMatchLength(e.target.value as MatchLength)
                  }
                  className="w-full px-2.5 py-2 rounded-[4px] bg-zinc-900 border border-white/15 text-xs font-semibold uppercase text-zinc-100"
                >
                  <option value="MR12">MR12 (do 13 wygranych)</option>
                  <option value="MR15">MR15 (do 16 wygranych)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                audioEngine.playUIClick(true);
                requestFullscreenSafe();
                gameSim.startOfflineMatch();
                requestPointerLockSafe();
              }}
              className="w-full py-3 mt-2 rounded-[4px] bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold uppercase tracking-wider text-sm transition-colors shadow-lg"
            >
              Kliknij, aby grać (Pełny Ekran 5v5)
            </button>
          </div>
        )}

        {/* TAB 2: MULTIPLAYER ONLINE LOBBY SETUP */}
        {modeTab === 'online' && (
          <div className="space-y-3.5">
            {/* Minimalistyczny status połączenia */}
            {!lobby.connected ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-red-950/50 border border-red-500/35 text-xs font-semibold text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Brak połączenia z serwerem</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-emerald-950/50 border border-emerald-500/35 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Połączono z serwerem</span>
              </div>
            )}

            <div>
              <label
                htmlFor="mp-nick"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1"
              >
                Twój nick w lobby
              </label>
              <input
                id="mp-nick"
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 rounded-[4px] bg-zinc-900 border border-white/15 text-sm text-zinc-100"
              />
            </div>

            {/* Bot Toggle Before Room Creation (Default OFF) */}
            <div className="flex items-center justify-between p-2.5 rounded-[4px] bg-zinc-900/80 border border-white/10">
              <div>
                <div className="text-xs font-bold uppercase text-zinc-200">
                  Dopełnij botami
                </div>
                <div className="text-[11px] text-zinc-400">
                  {createWithBots
                    ? 'Włączone — boty uzupełniają wolne miejsca'
                    : 'Wyłączone — domyślnie bez botów'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateWithBots(!createWithBots)}
                className={`px-3 py-1.5 rounded-[4px] border text-xs font-bold uppercase transition-colors ${
                  createWithBots
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-white/15 bg-zinc-800 text-zinc-300'
                }`}
              >
                Boty: {createWithBots ? 'WŁ.' : 'WYŁ.'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!lobby.connected) {
                  audioEngine.playUIClick(false);
                  useGameStore.getState().setLobbyState({
                    error: 'Brak połączenia z serwerem',
                  });
                  return;
                }
                multiplayerClient.createRoom(
                  playerName,
                  preferredTeam,
                  createWithBots
                );
              }}
              className="w-full py-2.5 rounded-[4px] bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold uppercase tracking-wider text-xs transition-colors"
            >
              Utwórz nowy pokój (Host)
            </button>

            <div className="pt-3 border-t border-white/10">
              <label
                htmlFor="room-code-input"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1"
              >
                Lub dołącz kodem pokoju
              </label>
              <div className="flex gap-2">
                <input
                  id="room-code-input"
                  type="text"
                  maxLength={5}
                  placeholder="NP. VK6LS"
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(e.target.value.toUpperCase())
                  }
                  className="flex-1 px-3 py-2 rounded-[4px] bg-zinc-900 border border-white/15 text-sm font-mono-num uppercase text-zinc-100"
                />
                <button
                  type="button"
                  disabled={joinCodeInput.trim().length < 4}
                  onClick={() => {
                    if (!lobby.connected) {
                      audioEngine.playUIClick(false);
                      useGameStore.getState().setLobbyState({
                        error: 'Brak połączenia z serwerem',
                      });
                      return;
                    }
                    multiplayerClient.joinRoom(
                      joinCodeInput,
                      playerName,
                      preferredTeam
                    );
                  }}
                  className="px-4 py-2 rounded-[4px] bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-white/15 text-xs font-bold uppercase tracking-wider text-zinc-100"
                >
                  Dołącz
                </button>
              </div>
            </div>
          </div>
        )}



        {/* TAB 3: SETTINGS */}
        {modeTab === 'settings' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="flex justify-between text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  <span>Czułość</span>
                  <span className="font-mono-num text-amber-400">
                    {mouseSensitivity.toFixed(1)}
                  </span>
                </label>
                <input
                  type="range"
                  min={0.3}
                  max={5.0}
                  step={0.1}
                  value={mouseSensitivity}
                  onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  <span>Głośność</span>
                  <span className="font-mono-num text-amber-400">
                    {Math.round(volume * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs uppercase tracking-wider text-zinc-400 mb-1">
                  <span>FOV</span>
                  <span className="font-mono-num text-amber-400">{fov}°</span>
                </label>
                <input
                  type="range"
                  min={60}
                  max={110}
                  step={1}
                  value={fov}
                  onChange={(e) => setFov(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            {renderCrosshairControls()}
            {renderGraphicsControls()}
          </div>
        )}
      </div>

      {/* High-Contrast Control Hint Line in Bottom Safe Margin */}
      <div className="w-fit rounded-[4px] bg-[rgba(11,13,16,0.84)] border border-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-zinc-200 shadow-lg">
        WASD Ruch · Shift Chód · Ctrl Kucanie · LPM Strzał · PPM Luneta · R Przeładowanie · B Zakupy · E Plant/Defuse · Tab Wyniki · Esc Pauza
      </div>
    </div>
  );
};
