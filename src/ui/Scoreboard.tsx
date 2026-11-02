import React from 'react';
import { Team } from '../game/WeaponsDB';
import { ScoreboardPlayer, useGameStore } from '../store/useGameStore';
import { DefuseKitIcon, SkullIcon, WeaponIcon } from './icons';

export const Scoreboard: React.FC = () => {
  const scoreboardOpen = useGameStore((s) => s.scoreboardOpen);
  const scoreboard = useGameStore((s) => s.scoreboard);
  const ctScore = useGameStore((s) => s.ctScore);
  const tScore = useGameStore((s) => s.tScore);
  const roundNumber = useGameStore((s) => s.roundNumber);
  const maxRounds = useGameStore((s) => s.maxRounds);

  if (!scoreboardOpen) return null;

  const ctPlayers = scoreboard
    .filter((p) => p.team === 'CT')
    .sort((a, b) => b.kills - a.kills);
  const tPlayers = scoreboard
    .filter((p) => p.team === 'T')
    .sort((a, b) => b.kills - a.kills);

  const renderTeamTable = (team: Team, players: ScoreboardPlayer[], score: number) => {
    const isCT = team === 'CT';
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold uppercase tracking-wider ${
                isCT ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {isCT ? 'Oddział Antyterrorystów (CT)' : 'Oddział Terrorystów (T)'}
            </span>
          </div>
          <span className="text-xl font-bold font-mono-num text-zinc-100">
            {score}
          </span>
        </div>

        <table className="w-full text-left text-xs font-mono-num">
          <thead>
            <tr className="border-b border-white/10 text-zinc-400 uppercase text-[11px]">
              <th className="py-2 px-4 font-semibold">Operator</th>
              <th className="py-2 px-2 font-semibold">Ekwipunek</th>
              <th className="py-2 px-2 text-right font-semibold">Kasa</th>
              <th className="py-2 px-2 text-center font-semibold">K</th>
              <th className="py-2 px-2 text-center font-semibold">A</th>
              <th className="py-2 px-2 text-center font-semibold">D</th>
              <th className="py-2 px-2 text-center font-semibold">MVP</th>
              <th className="py-2 px-4 text-right font-semibold">Ping</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-white/5 ${
                  p.alive ? 'text-zinc-100' : 'text-zinc-500 bg-black/25'
                }`}
              >
                <td className="py-2 px-4 font-sans font-semibold flex items-center gap-2">
                  {!p.alive && <SkullIcon className="w-3.5 h-3.5 text-zinc-500" />}
                  <span>{p.name}</span>
                  {p.isBot && (
                    <span className="text-[10px] text-zinc-500 uppercase">
                      BOT
                    </span>
                  )}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2 text-zinc-300">
                    {p.primaryWeapon && (
                      <WeaponIcon
                        weaponId={p.primaryWeapon}
                        className="w-8 h-3.5"
                      />
                    )}
                    {p.hasDefuseKit && (
                      <DefuseKitIcon className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    {p.hasC4 && (
                      <WeaponIcon
                        weaponId="c4"
                        className="w-4 h-4 text-amber-400"
                      />
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-amber-400">
                  ${p.money}
                </td>
                <td className="py-2 px-2 text-center font-bold">{p.kills}</td>
                <td className="py-2 px-2 text-center">{p.assists}</td>
                <td className="py-2 px-2 text-center">{p.deaths}</td>
                <td className="py-2 px-2 text-center text-amber-400">
                  {p.mvps > 0 ? p.mvps : '-'}
                </td>
                <td className="py-2 px-4 text-right text-zinc-400">
                  {p.isBot ? 'BOT' : `${p.ping} ms`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(8,10,14,0.72)] p-6 pointer-events-none">
      <div className="w-full max-w-3xl rounded-[5px] bg-[rgba(14,17,22,0.95)] border border-white/15 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Dust Alley · Runda {roundNumber} / {maxRounds}
          </div>
          <div className="text-xs text-zinc-400 font-mono-num">
            CT {ctScore} : {tScore} T
          </div>
        </div>
        <div className="p-4">
          {renderTeamTable('CT', ctPlayers, ctScore)}
          {renderTeamTable('T', tPlayers, tScore)}
        </div>
      </div>
    </div>
  );
};
