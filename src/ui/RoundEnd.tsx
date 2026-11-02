import React from 'react';
import { gameSim } from '../engine/GameLoop';
import { useGameStore } from '../store/useGameStore';

export const RoundEnd: React.FC = () => {
  const screenState = useGameStore((s) => s.screenState);
  const roundEndSummary = useGameStore((s) => s.roundEndSummary);
  const ctScore = useGameStore((s) => s.ctScore);
  const tScore = useGameStore((s) => s.tScore);
  const scoreboard = useGameStore((s) => s.scoreboard);
  const setScreenState = useGameStore((s) => s.setScreenState);

  // Full Match Over Modal (`gameover`)
  if (screenState === 'gameover') {
    const matchWinner =
      ctScore > tScore ? 'CT' : tScore > ctScore ? 'T' : 'REMIS';
    const topPlayer = [...scoreboard].sort((a, b) => b.kills - a.kills)[0];

    return (
      <div
        data-ui-interactive="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,14,0.88)] p-6 pointer-events-auto"
      >
        <div className="w-full max-w-lg rounded-[6px] bg-[rgba(15,18,24,0.98)] border border-white/15 p-8 text-center shadow-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1">
            Koniec Meczu · Dust Alley
          </div>
          <h2 className="text-3xl font-bold uppercase tracking-wider text-zinc-100 mb-6">
            {matchWinner === 'CT'
              ? 'Zwycięstwo Antyterrorystów (CT)'
              : matchWinner === 'T'
              ? 'Zwycięstwo Terrorystów (T)'
              : 'Mecz zakończony remisem'}
          </h2>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded bg-zinc-900/90 border border-white/10">
              <div className="text-[11px] uppercase text-zinc-400">Wynik CT</div>
              <div className="text-2xl font-bold text-sky-400 font-mono-num">
                {ctScore}
              </div>
            </div>
            <div className="p-3 rounded bg-zinc-900/90 border border-white/10">
              <div className="text-[11px] uppercase text-zinc-400">Wynik T</div>
              <div className="text-2xl font-bold text-amber-400 font-mono-num">
                {tScore}
              </div>
            </div>
            <div className="p-3 rounded bg-zinc-900/90 border border-white/10">
              <div className="text-[11px] uppercase text-zinc-400">MVP Meczu</div>
              <div className="text-sm font-bold text-zinc-100 truncate mt-1">
                {topPlayer ? `${topPlayer.name} (${topPlayer.kills} K)` : '-'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={() => gameSim.startOfflineMatch()}
              className="px-6 py-2.5 rounded-[4px] bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold uppercase tracking-wider text-sm transition-colors"
            >
              Zagraj ponownie
            </button>
            <button
              type="button"
              onClick={() => setScreenState('title')}
              className="px-5 py-2.5 rounded-[4px] border border-white/15 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold uppercase tracking-wider text-sm transition-colors"
            >
              Menu główne
            </button>
          </div>
        </div>
      </div>
    );
  }

  // In-game Round End Banner
  if (!roundEndSummary) return null;

  const isCT = roundEndSummary.winner === 'CT';
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="min-w-[360px] px-6 py-4 rounded-[5px] bg-[rgba(12,15,20,0.92)] border border-white/15 text-center shadow-xl">
        <div
          className={`text-lg font-bold uppercase tracking-wider ${
            isCT ? 'text-sky-400' : 'text-amber-400'
          }`}
        >
          {isCT
            ? 'Runda wygrana przez Antyterrorystów (CT)'
            : 'Runda wygrana przez Terrorystów (T)'}
        </div>
        <div className="text-xs text-zinc-300 mt-0.5">
          {roundEndSummary.reason}
        </div>
        <div className="mt-2 pt-2 border-t border-white/10 text-xs text-zinc-400">
          MVP: <span className="text-amber-400 font-bold">{roundEndSummary.mvpName}</span> —{' '}
          {roundEndSummary.mvpReason}
        </div>
      </div>
    </div>
  );
};
