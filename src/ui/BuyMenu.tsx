import React, { useState } from 'react';
import { gameSim } from '../engine/GameLoop';
import { requestPointerLockSafe } from '../engine/InputManager';
import { EQUIPMENT_DB } from '../game/Economy';
import {
  getBuyableWeaponsByCategory,
  WEAPONS_DB,
  WeaponId,
  WeaponSpec,
} from '../game/WeaponsDB';
import { useGameStore } from '../store/useGameStore';
import { DefuseKitIcon, HelmetIcon, KevlarIcon, WeaponIcon } from './icons';

type EquipmentId = 'kevlar' | 'kevlar_helmet' | 'defuse_kit';

export const BuyMenu: React.FC = () => {
  const buyMenuOpen = useGameStore((s) => s.buyMenuOpen);
  const setBuyMenuOpen = useGameStore((s) => s.setBuyMenuOpen);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const playerMoney = useGameStore((s) => s.playerMoney);
  const playerArmor = useGameStore((s) => s.playerArmor);
  const playerHasHelmet = useGameStore((s) => s.playerHasHelmet);
  const playerHasDefuseKit = useGameStore((s) => s.playerHasDefuseKit);
  const primaryWeapon = useGameStore((s) => s.primaryWeapon);
  const secondaryWeapon = useGameStore((s) => s.secondaryWeapon);
  const grenades = useGameStore((s) => s.grenades);
  const phaseTimeRemaining = useGameStore((s) => s.phaseTimeRemaining);

  const [hoveredWeaponId, setHoveredWeaponId] = useState<WeaponId>(
    playerTeam === 'CT' ? 'm4a1s' : 'ak47'
  );

  if (!buyMenuOpen) return null;

  const pistols = getBuyableWeaponsByCategory('pistol', playerTeam);
  const smgsAndHeavy = [
    ...getBuyableWeaponsByCategory('smg', playerTeam),
    ...getBuyableWeaponsByCategory('heavy', playerTeam),
  ];
  const rifles = getBuyableWeaponsByCategory('rifle', playerTeam);
  const grenadeList = getBuyableWeaponsByCategory('grenade', playerTeam);

  const inspected: WeaponSpec = WEAPONS_DB[hoveredWeaponId] || WEAPONS_DB.ak47;

  const renderStatBar = (label: string, ratio: number, valueText?: string) => (
    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {valueText && (
          <span className="font-mono-num text-zinc-200 text-[11px]">{valueText}</span>
        )}
        <div className="w-20 h-1 bg-zinc-800 rounded overflow-hidden">
          <div
            className="h-full bg-amber-500"
            style={{ width: `${Math.max(8, Math.min(100, Math.round(ratio * 100)))}%` }}
          />
        </div>
      </div>
    </div>
  );

  const renderWeaponCard = (w: WeaponSpec, shortcutLabel: string) => {
    const ownedCount = grenades.filter((g) => g === w.id).length;
    const isOwned =
      primaryWeapon === w.id ||
      secondaryWeapon === w.id ||
      (w.slot === 4 &&
        ((w.id === 'flashbang' && ownedCount >= 2) ||
          (w.id !== 'flashbang' && ownedCount >= 1) ||
          grenades.length >= 4));
    const canAfford = playerMoney >= w.price && !isOwned;

    return (
      <button
        key={w.id}
        type="button"
        disabled={!canAfford}
        onMouseEnter={() => setHoveredWeaponId(w.id)}
        onClick={() => gameSim.buyItemForLocalPlayer(w.id)}
        className={`group relative flex flex-col justify-between px-2.5 py-2 rounded-[4px] border text-left transition-all ${
          isOwned
            ? 'border-amber-500/70 bg-amber-500/12 text-zinc-100'
            : canAfford
            ? 'border-white/10 bg-zinc-900/85 hover:border-amber-500/80 hover:bg-zinc-800/90 text-zinc-100'
            : 'border-white/5 bg-zinc-950/60 text-zinc-600 opacity-50 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] font-mono-num uppercase tracking-wider text-zinc-500">
            [{shortcutLabel}]
          </span>
          <span
            className={`text-xs font-bold font-mono-num ${
              isOwned
                ? 'text-amber-400'
                : canAfford
                ? 'text-emerald-400 group-hover:text-amber-300'
                : 'text-zinc-600'
            }`}
          >
            {isOwned ? 'POSIADANE' : `$${w.price}`}
          </span>
        </div>

        <div className="flex items-center justify-center py-1">
          <WeaponIcon
            weaponId={w.id}
            className={`w-16 h-7 transition-transform group-hover:scale-105 ${
              isOwned
                ? 'text-amber-400'
                : canAfford
                ? 'text-zinc-200 group-hover:text-amber-400'
                : 'text-zinc-600'
            }`}
          />
        </div>

        <div className="flex items-center justify-between w-full pt-1 border-t border-white/5">
          <span className="text-[11px] font-bold uppercase tracking-wider truncate">
            {w.name}
          </span>
          {w.slot === 4 && ownedCount > 0 && (
            <span className="text-[10px] font-mono-num text-amber-400">
              {ownedCount}x
            </span>
          )}
        </div>
      </button>
    );
  };

  const equipmentItems: Array<{
    id: EquipmentId;
    name: string;
    price: number;
    owned: boolean;
    subtitle: string;
  }> = [
    {
      id: 'kevlar',
      name: EQUIPMENT_DB.kevlar.name,
      price: EQUIPMENT_DB.kevlar.price,
      owned: playerArmor >= 100,
      subtitle: 'Ochrona tułowia',
    },
    {
      id: 'kevlar_helmet',
      name: EQUIPMENT_DB.kevlar_helmet.name,
      price: playerArmor >= 100 && !playerHasHelmet ? 350 : EQUIPMENT_DB.kevlar_helmet.price,
      owned: playerArmor >= 100 && playerHasHelmet,
      subtitle: 'Głowa + tułów',
    },
    ...(playerTeam === 'CT'
      ? [
          {
            id: 'defuse_kit' as EquipmentId,
            name: EQUIPMENT_DB.defuse_kit.name,
            price: EQUIPMENT_DB.defuse_kit.price,
            owned: playerHasDefuseKit,
            subtitle: 'Rozbrajanie C4 w 5s',
          },
        ]
      : []),
  ];

  return (
    <div
      data-ui-interactive="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(8,10,14,0.86)] p-3 md:p-5 pointer-events-auto"
    >
      <div className="w-full max-w-6xl max-h-[94vh] rounded-[6px] bg-[rgba(14,17,23,0.97)] border border-white/15 shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* Top Bar: Title, Timer, Balance, Close */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10 bg-[rgba(10,12,16,0.75)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-zinc-100 leading-none">
                Zbrojownia Taktyczna · {playerTeam === 'CT' ? 'Antyterroryści (CT)' : 'Terroryści (T)'}
              </h2>
              <span className="text-[11px] text-zinc-400 font-mono-num">
                Wszystkie bronie i wyposażenie na jednym ekranie · Czas zakupów: {Math.ceil(phaseTimeRemaining)}s
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                Kredyty operacyjne
              </div>
              <div className="text-xl font-bold text-amber-400 font-mono-num leading-none">
                ${playerMoney}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setBuyMenuOpen(false);
                requestPointerLockSafe();
              }}
              className="px-3 py-1.5 rounded-[4px] border border-white/15 bg-zinc-800/90 hover:bg-amber-500 hover:text-zinc-950 hover:border-amber-400 text-xs font-bold uppercase tracking-wider text-zinc-200 transition-colors"
            >
              Zamknij [B / Esc]
            </button>
          </div>
        </div>

        {/* Unified 4-Column Valorant / CS2 Style Grid (No Category Tabs) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 px-5 py-3 overflow-y-auto">
          {/* COLUMN 1: SIDEARMS / PISTOLS */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400/90 pb-1 border-b border-white/10 flex justify-between">
              <span>Broń Boczna</span>
              <span className="text-zinc-500 font-mono-num">SLOT 2</span>
            </div>
            {pistols.map((w, idx) => renderWeaponCard(w, `P${idx + 1}`))}
          </div>

          {/* COLUMN 2: SMGs & SHOTGUNS */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400/90 pb-1 border-b border-white/10 flex justify-between">
              <span>PM i Strzelby</span>
              <span className="text-zinc-500 font-mono-num">SLOT 1</span>
            </div>
            {smgsAndHeavy.map((w, idx) => renderWeaponCard(w, `S${idx + 1}`))}
          </div>

          {/* COLUMN 3: RIFLES & SNIPERS */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400/90 pb-1 border-b border-white/10 flex justify-between">
              <span>Karabiny</span>
              <span className="text-zinc-500 font-mono-num">SLOT 1</span>
            </div>
            {rifles.map((w, idx) => renderWeaponCard(w, `R${idx + 1}`))}
          </div>

          {/* COLUMN 4: ARMOR, KIT & GRENADES */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400/90 pb-1 border-b border-white/10 flex justify-between">
              <span>Pancerz i Granaty</span>
              <span className="text-zinc-500 font-mono-num">SPRZĘT</span>
            </div>

            {/* Armor & Defuse Kit */}
            <div className="grid grid-cols-1 gap-2">
              {equipmentItems.map((item, idx) => {
                const canAfford = playerMoney >= item.price && !item.owned;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => gameSim.buyItemForLocalPlayer(item.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-[4px] border text-left transition-all ${
                      item.owned
                        ? 'border-amber-500/70 bg-amber-500/12 text-zinc-100'
                        : canAfford
                        ? 'border-white/10 bg-zinc-900/85 hover:border-amber-500/80 hover:bg-zinc-800/90 text-zinc-100'
                        : 'border-white/5 bg-zinc-950/60 text-zinc-600 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-amber-400">
                        {item.id === 'kevlar' && <KevlarIcon className="w-5 h-5" />}
                        {item.id === 'kevlar_helmet' && (
                          <div className="flex items-center gap-0.5">
                            <KevlarIcon className="w-4 h-4" />
                            <HelmetIcon className="w-4 h-4" />
                          </div>
                        )}
                        {item.id === 'defuse_kit' && <DefuseKitIcon className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider leading-tight">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-zinc-400">{item.subtitle}</div>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold font-mono-num ${
                        item.owned
                          ? 'text-amber-400'
                          : canAfford
                          ? 'text-emerald-400'
                          : 'text-zinc-600'
                      }`}
                    >
                      {item.owned ? 'OK' : `$${item.price}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grenades 3-card row */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {grenadeList.map((g) => {
                const ownedCount = grenades.filter((id) => id === g.id).length;
                const maxAllowed = g.id === 'flashbang' ? 2 : 1;
                const isFull = ownedCount >= maxAllowed || grenades.length >= 4;
                const canAfford = playerMoney >= g.price && !isFull;

                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={!canAfford}
                    onMouseEnter={() => setHoveredWeaponId(g.id)}
                    onClick={() => gameSim.buyItemForLocalPlayer(g.id)}
                    className={`flex flex-col items-center justify-between p-2 rounded-[4px] border text-center transition-all ${
                      ownedCount > 0
                        ? 'border-amber-500/60 bg-amber-500/12 text-zinc-100'
                        : canAfford
                        ? 'border-white/10 bg-zinc-900/85 hover:border-amber-500/80 hover:bg-zinc-800/90 text-zinc-100'
                        : 'border-white/5 bg-zinc-950/60 text-zinc-600 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <WeaponIcon weaponId={g.id} className="w-8 h-6 my-1 text-zinc-200" />
                    <span className="text-[10px] font-bold uppercase truncate w-full">
                      {g.name.replace('Granat ', '')}
                    </span>
                    <span className="text-[11px] font-bold font-mono-num text-emerald-400">
                      {isFull ? `${ownedCount}/${maxAllowed}` : `$${g.price}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Telemetry & Ballistics Inspector Bar */}
        <div className="px-6 py-3 bg-[rgba(9,11,15,0.92)] border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <WeaponIcon weaponId={inspected.id} className="w-16 h-7 text-amber-400" />
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                {inspected.name}{' '}
                <span className="text-xs font-mono-num text-amber-400 ml-2">
                  ${inspected.price}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono-num">
                Głowa: {Math.round(inspected.damage * 4)} HP · Tułów: {inspected.damage} HP · Nogi:{' '}
                {Math.round(inspected.damage * 0.75)} HP
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
            {renderStatBar('Obrażenia', inspected.damage / 115, `${inspected.damage}`)}
            {renderStatBar('Szybkostrzelność', inspected.fireRate / 850, `${inspected.fireRate} RPM`)}
            {renderStatBar('Penetracja', inspected.armorPenetration, `${Math.round(inspected.armorPenetration * 100)}%`)}
            {renderStatBar('Magazynek', inspected.magSize / 35, `${inspected.magSize}/${inspected.reserveAmmo}`)}
          </div>
        </div>
      </div>
    </div>
  );
};
