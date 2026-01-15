'use client';

import { Card as CardType } from '../game/types';

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  showSelectHint?: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: '#e53e3e',
  diamonds: '#e53e3e',
  clubs: '#1a1a2e',
  spades: '#1a1a2e',
};

export default function Card({ card, faceDown = false, selected = false, onClick, small = false, showSelectHint = false }: CardProps) {
  const isHidden = card.id.startsWith('hidden');
  const showFaceDown = faceDown || isHidden;

  if (showFaceDown) {
    return (
      <div
        className={`
          ${small ? 'w-12 h-16' : 'w-20 h-28'}
          rounded-lg
          bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500
          border-2 border-white/20
          shadow-lg
          flex items-center justify-center
          cursor-default
          transition-all duration-200
        `}
      >
        <div className="w-full h-full rounded-md bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCAwTDQwIDQwTTQwIDBMMCANDBIIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] opacity-30" />
      </div>
    );
  }

  const symbol = suitSymbols[card.suit];
  const color = suitColors[card.suit];

  return (
    <div
      className={`
        ${small ? 'w-12 h-16 text-xs' : 'w-20 h-28 text-sm'}
        rounded-lg
        bg-white
        border-2
        ${selected ? 'border-yellow-400 ring-2 ring-yellow-400 -translate-y-2' : 'border-gray-200'}
        shadow-lg
        flex flex-col
        cursor-pointer
        transition-all duration-200
        hover:scale-105 hover:shadow-xl
        ${onClick ? 'hover:-translate-y-1' : ''}
        select-none
        relative
        overflow-hidden
      `}
      style={{ color }}
      onClick={onClick}
    >
      {/* Top left corner */}
      <div className={`absolute ${small ? 'top-0.5 left-1' : 'top-1 left-2'} flex flex-col items-center leading-none`}>
        <span className={`font-bold ${small ? 'text-xs' : 'text-base'}`}>{card.rank}</span>
        <span className={small ? 'text-sm' : 'text-lg'}>{symbol}</span>
      </div>

      {/* Center symbol */}
      <div className="flex-1 flex items-center justify-center">
        <span className={`${small ? 'text-2xl' : 'text-4xl'}`}>{symbol}</span>
      </div>

      {/* Bottom right corner (rotated) */}
      <div className={`absolute ${small ? 'bottom-0.5 right-1' : 'bottom-1 right-2'} flex flex-col items-center leading-none rotate-180`}>
        <span className={`font-bold ${small ? 'text-xs' : 'text-base'}`}>{card.rank}</span>
        <span className={small ? 'text-sm' : 'text-lg'}>{symbol}</span>
      </div>

      {/* Multi-select hint */}
      {showSelectHint && !small && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
          +
        </div>
      )}
    </div>
  );
}
