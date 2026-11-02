import React from 'react';
import { requestFullscreenSafe } from '../engine/InputManager';
import { WEAPONS_DB } from '../game/WeaponsDB';
import { useGameStore } from '../store/useGameStore';
import {
  CROSSHAIR_COLOR_MAP,
  useSettingsStore,
} from '../store/useSettingsStore';
import {
  DefuseKitIcon,
  FullscreenIcon,
  HealthCrossIcon,
  HelmetIcon,
  KevlarIcon,
  PauseIcon,
  SoundIcon,
  WeaponIcon,
} from './icons';
import { KillFeed } from './KillFeed';
import { Radar } from './Radar';
import { RoundEnd } from './RoundEnd';

function formatTimer(sec: number): string {
  const total = Math.max(0, Math.ceil(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const HUD: React.FC = () => {
  const screenState = useGameStore((s) => s.screenState);
  const setScreenState = useGameStore((s) => s.setScreenState);
  const setBuyMenuOpen = useGameStore((s) => s.setBuyMenuOpen);
  const buyMenuOpen = useGameStore((s) => s.buyMenuOpen);

  const roundPhase = useGameStore((s) => s.roundPhase);
  const roundNumber = useGameStore((s) => s.roundNumber);
  const maxRounds = useGameStore((s) => s.maxRounds);
  const ctScore = useGameStore((s) => s.ctScore);
  const tScore = useGameStore((s) => s.tScore);
  const phaseTimeRemaining = useGameStore((s) => s.phaseTimeRemaining);

  const playerTeam = useGameStore((s) => s.playerTeam);
  const playerAlive = useGameStore((s) => s.playerAlive);
  const playerHp = useGameStore((s) => s.playerHp);
  const playerArmor = useGameStore((s) => s.playerArmor);
  const playerHasHelmet = useGameStore((s) => s.playerHasHelmet);
  const playerHasDefuseKit = useGameStore((s) => s.playerHasDefuseKit);
  const playerHasC4 = useGameStore((s) => s.playerHasC4);
  const playerMoney = useGameStore((s) => s.playerMoney);
  const inBuyZone = useGameStore((s) => s.inBuyZone);
  const activeBombSite = useGameStore((s) => s.activeBombSite);

  const activeWeapon = useGameStore((s) => s.activeWeapon);
  const ammoMag = useGameStore((s) => s.ammoMag);
  const ammoReserve = useGameStore((s) => s.ammoReserve);
  const isReloading = useGameStore((s) => s.isReloading);
  const grenades = useGameStore((s) => s.grenades);
  const zoomLevel = useGameStore((s) => s.zoomLevel);
  const crosshairSpreadPx = useGameStore((s) => s.crosshairSpreadPx);

  const bombState = useGameStore((s) => s.bombState);
  const bombSite = useGameStore((s) => s.bombSite);
  const actionProgress = useGameStore((s) => s.actionProgress);
  const actionLabel = useGameStore((s) => s.actionLabel);

  const flashAlpha = useGameStore((s) => s.flashAlpha);
  const smokeDensity = useGameStore((s) => s.smokeDensity);
  const hitMarker = useGameStore((s) => s.hitMarker);
  const spectatingName = useGameStore((s) => s.spectatingName);
  const ctAliveCount = useGameStore((s) => s.ctAliveCount);
  const tAliveCount = useGameStore((s) => s.tAliveCount);

  const muted = useSettingsStore((s) => s.muted);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const showFps = useSettingsStore((s) => s.showFps);

  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const crosshairSize = useSettingsStore((s) => s.crosshairSize);
  const crosshairGap = useSettingsStore((s) => s.crosshairGap);
  const crosshairThickness = useSettingsStore((s) => s.crosshairThickness);
  const crosshairDot = useSettingsStore((s) => s.crosshairDot);
  const crosshairOutline = useSettingsStore((s) => s.crosshairOutline);
  const crosshairDynamic = useSettingsStore((s) => s.crosshairDynamic);

  if (screenState === 'title') return null;

  const weaponSpec = WEAPONS_DB[activeWeapon] || WEAPONS_DB.ak47;
  const chHex = CROSSHAIR_COLOR_MAP[crosshairColor] || '#22c55e';
  const chShadow = crosshairOutline
    ? '0 0 1px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)'
    : 'none';
  const effectiveGap = crosshairDynamic
    ? crosshairGap + Math.max(0, crosshairSpreadPx - 5)
    : crosshairGap;
  const isDotOnly = crosshairSize === 0 && crosshairDot;

  const leadText =
    ctScore > tScore
      ? 'PROWADZI CT'
      : tScore > ctScore
      ? 'PROWADZI T'
      : 'REMIS';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Subtle cinematic peripheral vignette + low-HP crimson pulse */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            playerHp < 30 && playerAlive
              ? 'radial-gradient(circle, transparent 52%, rgba(185, 28, 28, 0.38) 100%)'
              : 'radial-gradient(circle, transparent 62%, rgba(0, 0, 0, 0.42) 100%)',
        }}
      />

      {/* Dense Volumetric Smoke Screen Overlay when inside smoke cloud */}
      {smokeDensity > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-75"
          style={{
            backgroundColor: 'rgba(165, 172, 180, 0.98)',
            opacity: Math.min(0.98, smokeDensity * 1.08),
            backdropFilter: 'blur(10px)',
          }}
        />
      )}

      {/* Flashbang whiteout overlay */}
      {flashAlpha > 0.01 && (
        <div
          className="fixed inset-0 bg-white pointer-events-none"
          style={{ opacity: flashAlpha }}
        />
      )}

      {/* Sniper Scope Reticle Overlay when zoomed */}
      {zoomLevel > 0 && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none bg-black/55">
          <div className="relative w-[78vh] h-[78vh] rounded-full border-2 border-zinc-600 shadow-[0_0_0_9999px_rgba(0,0,0,0.86)]">
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-zinc-900/90" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-zinc-900/90" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-500" />
          </div>
        </div>
      )}

      {/* Top-Left Radar */}
      <div className="fixed top-4 left-4">
        <Radar />
      </div>

      {/* Top-Center Esports Scoreboard, Round Timer & Alive Elimination Counters */}
      <div className="fixed top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div className="flex items-stretch rounded-[5px] bg-[rgba(11,14,19,0.9)] border border-white/12 shadow-xl overflow-hidden">
          {/* CT Alive Operator Pips Wing */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 border-r border-white/10 bg-sky-500/5">
            <div className="flex items-center gap-1" title="Żywi operatorzy CT">
              {[0, 1, 2, 3, 4].map((idx) => {
                const isAlivePip = idx < ctAliveCount;
                return (
                  <div
                    key={`ct_pip_${idx}`}
                    className={`w-2.5 h-5 rounded-[2px] border transition-all ${
                      isAlivePip
                        ? 'bg-sky-400 border-sky-300 shadow-[0_0_6px_rgba(56,189,248,0.55)]'
                        : 'bg-zinc-900/80 border-white/10 opacity-40'
                    }`}
                  />
                );
              })}
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-sky-300/80 leading-none">
                Żywi CT
              </div>
              <div className="text-sm font-extrabold font-mono-num text-sky-400 leading-tight">
                {ctAliveCount}
              </div>
            </div>
          </div>

          {/* CT Score Box */}
          <div className="flex flex-col items-center justify-center px-3.5 py-1 border-t-2 border-t-sky-400 bg-sky-500/10 min-w-[46px]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-sky-300 leading-none">
              CT
            </span>
            <span className="text-2xl font-extrabold text-sky-400 font-mono-num leading-none mt-0.5">
              {ctScore}
            </span>
          </div>

          {/* Central Round Timer / Bomb Countdown & Match Leader */}
          <div className="px-4 py-1 border-x border-white/10 text-center min-w-[104px] flex flex-col justify-center">
            {bombState === 'planted' ? (
              <div className="flex items-center justify-center gap-1.5 text-red-400 font-extrabold text-xs uppercase tracking-wider animate-pulse">
                <WeaponIcon weaponId="c4" className="w-4 h-4 text-red-500" />
                <span>C4 PODŁOŻONA</span>
                {bombSite && <span className="text-red-300">[{bombSite}]</span>}
              </div>
            ) : (
              <div
                className={`text-xl font-extrabold font-mono-num leading-none ${
                  roundPhase === 'buy' ? 'text-amber-400' : 'text-zinc-100'
                }`}
              >
                {formatTimer(phaseTimeRemaining)}
              </div>
            )}
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-0.5">
              Runda {roundNumber}/{maxRounds} ·{' '}
              <span
                className={
                  ctScore > tScore
                    ? 'text-sky-400'
                    : tScore > ctScore
                    ? 'text-amber-400'
                    : 'text-zinc-300'
                }
              >
                {leadText}
              </span>
            </div>
          </div>

          {/* T Score Box */}
          <div className="flex flex-col items-center justify-center px-3.5 py-1 border-t-2 border-t-amber-500 bg-amber-500/10 min-w-[46px]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300 leading-none">
              T
            </span>
            <span className="text-2xl font-extrabold text-amber-400 font-mono-num leading-none mt-0.5">
              {tScore}
            </span>
          </div>

          {/* T Alive Operator Pips Wing */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 border-l border-white/10 bg-amber-500/5">
            <div className="text-left">
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80 leading-none">
                Żywi T
              </div>
              <div className="text-sm font-extrabold font-mono-num text-amber-400 leading-tight">
                {tAliveCount}
              </div>
            </div>
            <div className="flex items-center gap-1" title="Żywi operatorzy T">
              {[0, 1, 2, 3, 4].map((idx) => {
                const isAlivePip = idx < tAliveCount;
                return (
                  <div
                    key={`t_pip_${idx}`}
                    className={`w-2.5 h-5 rounded-[2px] border transition-all ${
                      isAlivePip
                        ? 'bg-amber-400 border-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.55)]'
                        : 'bg-zinc-900/80 border-white/10 opacity-40'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top-Right Compact Utility Controls (FPS, Buy, Fullscreen, Mute, Pause) */}
      <div
        data-ui-interactive="true"
        className="fixed top-4 right-5 flex items-center gap-2 pointer-events-auto"
      >
        {showFps && (
          <div
            id="hud-fps-counter"
            className="px-2.5 py-1.5 rounded-[4px] bg-[rgba(11,13,16,0.84)] border border-white/10 text-[11px] font-mono-num text-emerald-400 pointer-events-none"
          >
            60 FPS · 16.6 ms
          </div>
        )}
        {roundPhase === 'buy' && inBuyZone && playerAlive && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setBuyMenuOpen(!buyMenuOpen);
            }}
            className="px-3 py-1.5 rounded-[4px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Sklep [B]
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Pełny ekran"
          title="Tryb pełnoekranowy"
          onClick={(e) => {
            e.currentTarget.blur();
            requestFullscreenSafe();
          }}
          className="p-2 rounded-[4px] bg-[rgba(11,13,16,0.84)] hover:bg-zinc-800 border border-white/10 text-zinc-300 transition-colors"
        >
          <FullscreenIcon />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
          onClick={(e) => {
            e.currentTarget.blur();
            setMuted(!muted);
          }}
          className="p-2 rounded-[4px] bg-[rgba(11,13,16,0.84)] hover:bg-zinc-800 border border-white/10 text-zinc-300 transition-colors"
        >
          <SoundIcon muted={muted} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Pauza"
          onClick={(e) => {
            e.currentTarget.blur();
            setScreenState('paused');
          }}
          className="p-2 rounded-[4px] bg-[rgba(11,13,16,0.84)] hover:bg-zinc-800 border border-white/10 text-zinc-300 transition-colors"
        >
          <PauseIcon />
        </button>
      </div>

      {/* Center Customizable Crosshair (Supports 4-Line + Dot OR Dot-Only when crosshairSize === 0) */}
      {zoomLevel === 0 && (
        <div
          id="hud-crosshair"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          {crosshairSize > 0 && (
            <>
              {/* Top line */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  width: `${crosshairThickness}px`,
                  height: `${crosshairSize}px`,
                  bottom: `${effectiveGap}px`,
                  backgroundColor: chHex,
                  boxShadow: chShadow,
                }}
              />
              {/* Bottom line */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  width: `${crosshairThickness}px`,
                  height: `${crosshairSize}px`,
                  top: `${effectiveGap}px`,
                  backgroundColor: chHex,
                  boxShadow: chShadow,
                }}
              />
              {/* Left line */}
              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  height: `${crosshairThickness}px`,
                  width: `${crosshairSize}px`,
                  right: `${effectiveGap}px`,
                  backgroundColor: chHex,
                  boxShadow: chShadow,
                }}
              />
              {/* Right line */}
              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  height: `${crosshairThickness}px`,
                  width: `${crosshairSize}px`,
                  left: `${effectiveGap}px`,
                  backgroundColor: chHex,
                  boxShadow: chShadow,
                }}
              />
            </>
          )}
          {/* Center dot */}
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

          {/* Hitmarker X */}
          {hitMarker !== 'none' && (
            <svg
              viewBox="0 0 24 24"
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 ${
                hitMarker === 'headshot' ? 'text-red-500' : 'text-zinc-100'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="4" y1="4" x2="9" y2="9" />
              <line x1="20" y1="4" x2="15" y2="9" />
              <line x1="4" y1="20" x2="9" y2="15" />
              <line x1="20" y1="20" x2="15" y2="15" />
            </svg>
          )}
        </div>
      )}

      {/* Center Bomb Plant / Defuse Progress Bar */}
      {actionProgress > 0 && actionLabel && (
        <div className="fixed left-1/2 top-[60%] -translate-x-1/2 w-64 px-4 py-2.5 rounded-[5px] bg-[rgba(11,13,16,0.9)] border border-amber-500/40 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
            {actionLabel}
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-none"
              style={{ width: `${Math.min(100, Math.round(actionProgress * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Interactive Zone Hint (Plant C4 / Defuse C4 / Buy Phase Skip) */}
      {roundPhase === 'buy' && playerAlive && !buyMenuOpen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded bg-[rgba(11,13,16,0.85)] border border-amber-500/35 text-xs font-semibold text-amber-300">
          Faza zakupów — ruch zablokowany ({Math.ceil(phaseTimeRemaining)}s) · [B] Zbrojownia · [Enter] Rozpocznij rundę
        </div>
      )}
      {actionProgress === 0 && playerAlive && activeBombSite && playerHasC4 && bombState === 'carried' && (
        <div className="fixed left-1/2 top-[64%] -translate-x-1/2 px-3 py-1 rounded bg-[rgba(11,13,16,0.8)] border border-amber-500/40 text-xs font-semibold text-amber-300">
          Przytrzymaj [E], aby podłożyć ładunek C4 na strefie {activeBombSite}
        </div>
      )}

      {/* Spectating Banner when Local Player is Eliminated */}
      {spectatingName && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-2 rounded-[5px] bg-[rgba(11,13,16,0.88)] border border-white/15 text-center">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">
            Tryb obserwatora [LPM / Spacja — zmiana kamery]
          </div>
          <div className="text-base font-bold text-amber-400">
            {spectatingName}
          </div>
        </div>
      )}

      {/* Bottom-Left: Vitality (HP & Armor) */}
      <div className="fixed bottom-5 left-5 flex items-center gap-5 px-4 py-2.5 rounded-[5px] bg-[rgba(11,13,16,0.84)] border border-white/10">
        <div className="flex items-center gap-2">
          <HealthCrossIcon
            className={`w-5 h-5 ${
              playerHp <= 25 ? 'text-red-500' : 'text-amber-400'
            }`}
          />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 leading-none">
              HP
            </div>
            <div
              className={`text-2xl font-bold font-mono-num leading-tight ${
                playerHp <= 25 ? 'text-red-400' : 'text-zinc-100'
              }`}
            >
              {playerHp}
            </div>
          </div>
        </div>

        <div className="h-7 w-[1px] bg-white/10" />

        <div className="flex items-center gap-2">
          {playerHasHelmet ? (
            <HelmetIcon className="w-5 h-5 text-zinc-300" />
          ) : (
            <KevlarIcon className="w-5 h-5 text-zinc-300" />
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 leading-none">
              Pancerz
            </div>
            <div className="text-2xl font-bold font-mono-num leading-tight text-zinc-100">
              {playerArmor}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Right: Money, Equipment, Grenades, Active Weapon & Ammo */}
      <div className="fixed bottom-5 right-5 flex flex-col items-end gap-2">
        {/* Money & Tactical Kit Row */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-[5px] bg-[rgba(11,13,16,0.84)] border border-white/10">
          {playerHasDefuseKit && (
            <div className="flex items-center gap-1 text-xs text-sky-400 font-semibold">
              <DefuseKitIcon className="w-4 h-4" />
              <span>KIT</span>
            </div>
          )}
          {playerHasC4 && (
            <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
              <WeaponIcon weaponId="c4" className="w-4 h-4" />
              <span>C4</span>
            </div>
          )}
          {grenades.length > 0 && (
            <div className="flex items-center gap-1 text-zinc-300">
              {grenades.map((g, i) => (
                <WeaponIcon key={`${g}_${i}`} weaponId={g} className="w-4 h-4" />
              ))}
            </div>
          )}
          <div className="text-lg font-bold text-amber-400 font-mono-num">
            ${playerMoney}
          </div>
        </div>

        {/* Active Weapon & Ammo Readout */}
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-[5px] bg-[rgba(11,13,16,0.84)] border border-white/10">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              {weaponSpec.shortName}
            </span>
            <WeaponIcon
              weaponId={activeWeapon}
              className="w-16 h-7 text-amber-400 mt-0.5"
            />
          </div>

          {weaponSpec.category !== 'melee' &&
            weaponSpec.category !== 'grenade' && (
              <>
                <div className="h-7 w-[1px] bg-white/10" />
                <div className="flex items-baseline gap-1 font-mono-num">
                  <span className="text-2xl font-bold text-zinc-100">
                    {isReloading ? 'PRZEŁ.' : ammoMag}
                  </span>
                  <span className="text-sm text-zinc-400">/ {ammoReserve}</span>
                </div>
              </>
            )}
        </div>
      </div>

      <KillFeed />
      <RoundEnd />
    </div>
  );
};
