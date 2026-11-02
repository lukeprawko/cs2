import React from 'react';
import { WeaponId } from '../game/WeaponsDB';

interface IconProps {
  className?: string;
  size?: number;
}

export const TitleEmblemSVG: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polygon points="32,4 56,16 56,44 32,60 8,44 8,16" className="stroke-amber-500/80 fill-amber-500/10" />
    <polygon points="32,10 50,19 50,41 32,53 14,41 14,19" className="stroke-zinc-400/40" />
    <circle cx="32" cy="31" r="10" className="stroke-amber-400" />
    <line x1="32" y1="16" x2="32" y2="24" className="stroke-amber-400" />
    <line x1="32" y1="38" x2="32" y2="46" className="stroke-amber-400" />
    <line x1="17" y1="31" x2="25" y2="31" className="stroke-amber-400" />
    <line x1="39" y1="31" x2="47" y2="31" className="stroke-amber-400" />
    <circle cx="32" cy="31" r="2" className="fill-amber-400 stroke-none" />
  </svg>
);

export const WeaponIcon: React.FC<{ weaponId: WeaponId | 'c4'; className?: string }> = ({
  weaponId,
  className = 'w-12 h-6',
}) => {
  switch (weaponId) {
    case 'glock':
    case 'p250':
    case 'cz75':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M14 10h34v7H27l-5 11h-8l4-11h-4z" />
          <line x1="27" y1="17" x2="31" y2="21" />
          <line x1="44" y1="10" x2="44" y2="14" />
        </svg>
      );
    case 'usp':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M8 10h30v7H21l-4 11h-7l3-11H8z" />
          <rect x="38" y="11" width="18" height="4.5" />
          <line x1="21" y1="17" x2="25" y2="21" />
        </svg>
      );
    case 'deagle':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 8h38l-2 8H26l-5 12h-9l4-12h-4z" />
          <line x1="26" y1="16" x2="31" y2="20" />
          <line x1="34" y1="11" x2="45" y2="11" />
        </svg>
      );
    case 'mp9':
    case 'mac10':
    case 'ump45':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M8 12h8v-2h28v6H20l-3 9h-5l2-9H8z" />
          <path d="M31 16l2 11h5l-2-11" />
          <line x1="44" y1="13" x2="54" y2="13" />
        </svg>
      );
    case 'ak47':
    case 'galil':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 14l11-2v5L4 20z" />
          <path d="M15 11h26v6H15z" />
          <path d="M18 17l-3 8h4l3-8" />
          <path d="M29 17c1 5 4 9 8 10l3-2c-3-1-5-4-6-8" />
          <line x1="41" y1="13" x2="60" y2="13" />
          <line x1="41" y1="15" x2="52" y2="15" />
          <line x1="56" y1="9" x2="58" y2="13" />
        </svg>
      );
    case 'm4a1s':
    case 'famas':
    case 'aug':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 11h10v7H4z" />
          <path d="M14 11h26v6H14z" />
          <path d="M20 8h12v3H20z" />
          <path d="M18 17l-2 8h4l2-8" />
          <path d="M29 17l2 9h5l-2-9" />
          <line x1="40" y1="13" x2="50" y2="13" />
          {weaponId === 'm4a1s' ? (
            <rect x="50" y="11.5" width="11" height="3" />
          ) : (
            <line x1="50" y1="13" x2="59" y2="13" />
          )}
        </svg>
      );
    case 'nova':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 16l12-4h20v5H16l-10 4z" />
          <line x1="36" y1="13" x2="60" y2="13" />
          <rect x="38" y="15" width="14" height="3" />
        </svg>
      );
    case 'awp':
    case 'ssg08':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3 13h12v6H3z" />
          <path d="M15 12h24v5H15z" />
          <path d="M18 17l-2 7h4l2-7" />
          <rect x="26" y="17" width="6" height="4" />
          <line x1="39" y1="14" x2="62" y2="14" />
          <path d="M19 7h18l3 2H16z" />
          <line x1="23" y1="9" x2="23" y2="12" />
          <line x1="33" y1="9" x2="33" y2="12" />
        </svg>
      );
    case 'knife':
      return (
        <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="10" y="13" width="14" height="5" rx="1" />
          <line x1="24" y1="9" x2="24" y2="22" />
          <path d="M24 13h26l6 3-8 3H24z" />
        </svg>
      );
    case 'he_grenade':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="10" y="9" width="12" height="16" rx="4" />
          <path d="M13 9V5h6v4" />
          <path d="M19 6h5v8" />
          <line x1="10" y1="14" x2="22" y2="14" />
          <line x1="10" y1="19" x2="22" y2="19" />
        </svg>
      );
    case 'flashbang':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="11" y="8" width="10" height="18" rx="2" />
          <path d="M13 8V4h6v4" />
          <line x1="11" y1="13" x2="21" y2="13" />
          <line x1="11" y1="20" x2="21" y2="20" />
        </svg>
      );
    case 'smoke_grenade':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="10" y="7" width="12" height="19" rx="2" />
          <line x1="10" y1="12" x2="22" y2="12" />
          <line x1="10" y1="21" x2="22" y2="21" />
          <path d="M14 7V4h4v3" />
        </svg>
      );
    case 'c4':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="5" y="8" width="22" height="16" rx="2" />
          <rect x="9" y="11" width="8" height="5" />
          <circle cx="22" cy="13" r="1.5" className="fill-current" />
          <line x1="9" y1="20" x2="23" y2="20" />
        </svg>
      );
  }
};

export const KevlarIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M6 4l3 2h6l3-2 3 4-2 3v9H5v-9L3 8z" />
  </svg>
);

export const HelmetIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 14a8 8 0 0 1 16 0v4H4v-4z" />
    <path d="M8 14h12" />
  </svg>
);

export const DefuseKitIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M7 4l5 6 5-6" />
    <path d="M6 20l6-10 6 10" />
    <circle cx="12" cy="10" r="1.5" />
  </svg>
);

export const SkullIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="9" cy="11" r="1.5" />
    <circle cx="15" cy="11" r="1.5" />
    <path d="M8 19v2h8v-2" />
    <path d="M12 3a8 8 0 0 0-6 13.3V19h12v-2.7A8 8 0 0 0 12 3z" />
  </svg>
);

export const HeadshotIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

export const WallbangIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="10" y1="3" x2="10" y2="21" />
    <line x1="14" y1="3" x2="14" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <polyline points="17,8 21,12 17,16" />
  </svg>
);

export const HealthCrossIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SoundIcon: React.FC<{ muted: boolean; className?: string }> = ({
  muted,
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {muted ? (
      <>
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    ) : (
      <>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    )}
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const FullscreenIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
