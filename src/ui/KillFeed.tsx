import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { HeadshotIcon, SkullIcon, WallbangIcon, WeaponIcon } from './icons';

export const KillFeed: React.FC = () => {
  const killFeed = useGameStore((s) => s.killFeed);
  const radioFeed = useGameStore((s) => s.radioFeed);

  return (
    <>
      {/* Top-Right Kill Feed */}
      <div className="fixed top-14 right-5 z-20 flex flex-col items-end gap-1.5 pointer-events-none">
        {killFeed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 px-2.5 py-1 rounded bg-[rgba(11,13,16,0.82)] border border-white/10 text-xs font-semibold tracking-wide"
          >
            <span
              className={
                entry.killerTeam === 'CT' ? 'text-sky-400' : 'text-amber-400'
              }
            >
              {entry.killerName}
            </span>
            <WeaponIcon
              weaponId={entry.weaponId}
              className="w-9 h-4 text-zinc-200"
            />
            {entry.isWallbang && (
              <WallbangIcon className="w-3.5 h-3.5 text-zinc-400" />
            )}
            {entry.isHeadshot && (
              <HeadshotIcon className="w-3.5 h-3.5 text-amber-400" />
            )}
            <SkullIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span
              className={
                entry.victimTeam === 'CT' ? 'text-sky-400' : 'text-amber-400'
              }
            >
              {entry.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom-Left Radio Callouts Feed (above HP bar) */}
      {radioFeed.length > 0 && (
        <div className="fixed bottom-24 left-5 z-20 flex flex-col gap-1 pointer-events-none max-w-xs">
          {radioFeed.map((msg) => (
            <div
              key={msg.id}
              className="px-2.5 py-1 rounded bg-[rgba(11,13,16,0.78)] border border-white/10 text-xs"
            >
              <span className="font-bold text-amber-400 mr-1.5">
                [{msg.senderName}]
              </span>
              <span className="text-zinc-200">{msg.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
