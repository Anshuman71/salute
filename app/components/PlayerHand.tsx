'use client';

import { Card as CardType } from '../game/types';
import Card from './Card';

interface PlayerHandProps {
  cards: CardType[];
  isCurrentPlayer: boolean;
  selectedCardIds: Set<string>;
  onCardClick: (card: CardType) => void;
  playerName: string;
  score?: number;
  roundsWon: number;
  canInteract: boolean;
  cardsByRank: Map<string, CardType[]>;
}

export default function PlayerHand({
  cards,
  isCurrentPlayer,
  selectedCardIds,
  onCardClick,
  playerName,
  score,
  roundsWon,
  canInteract,
  cardsByRank,
}: PlayerHandProps) {
  // Check if a card has duplicates
  const hasDuplicates = (card: CardType) => {
    return (cardsByRank.get(card.rank)?.length || 0) > 1;
  };

  return (
    <div className={`
      p-4 rounded-2xl
      ${isCurrentPlayer 
        ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-2 border-emerald-400/50' 
        : 'bg-white/5 border border-white/10'}
      backdrop-blur-sm
      transition-all duration-300
    `}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className={`
            w-3 h-3 rounded-full
            ${isCurrentPlayer ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}
          `} />
          <h3 className="font-semibold text-white text-lg">{playerName}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-sm font-medium">
            🏆 {roundsWon}
          </span>
          {score !== undefined && (
            <span className="text-pink-400 text-sm font-medium">
              Score: {score}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 justify-center min-h-[7rem]">
        {cards.length === 0 ? (
          <div className="text-gray-400 italic flex items-center">No cards</div>
        ) : (
          cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              selected={selectedCardIds.has(card.id)}
              onClick={canInteract ? () => onCardClick(card) : undefined}
              showSelectHint={canInteract && hasDuplicates(card)}
            />
          ))
        )}
      </div>
      
      {isCurrentPlayer && canInteract && (
        <p className="text-center text-sm text-emerald-300 mt-2">
          {selectedCardIds.size > 0 
            ? 'Click "Play" or select more cards of the same rank' 
            : 'Click a card to play (select multiple if same rank)'}
        </p>
      )}
    </div>
  );
}
