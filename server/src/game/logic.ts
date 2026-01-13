import type { Card, Suit, Rank } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const RANK_VALUES: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
};

function createStandardDeck(idPrefix: string = ''): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${idPrefix}${suit}-${rank}`,
        suit,
        rank,
        value: RANK_VALUES[rank],
      });
    }
  }
  return deck;
}

export function createGameDeck(numPlayers: number): Card[] {
  let deck = createStandardDeck('deck1-');
  
  if (numPlayers > 2) {
    const extraDecksNeeded = numPlayers - 2;
    for (let i = 0; i < extraDecksNeeded; i++) {
      const extraDeck = createStandardDeck(`extra${i + 1}-`);
      const shuffled = shuffle([...extraDeck]);
      deck = [...deck, ...shuffled.slice(0, 26)];
    }
  }
  
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(
  deck: Card[],
  numPlayers: number,
  cardsPerPlayer: number
): { remainingDeck: Card[]; hands: Card[][]; faceUpCard: Card | null } {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let deckCopy = [...deck];
  
  for (let cardNum = 0; cardNum < cardsPerPlayer; cardNum++) {
    for (let playerIdx = 0; playerIdx < numPlayers; playerIdx++) {
      if (deckCopy.length > 0) {
        hands[playerIdx].push(deckCopy.shift()!);
      }
    }
  }
  
  const faceUpCard = deckCopy.length > 0 ? deckCopy.shift()! : null;
  
  return { remainingDeck: deckCopy, hands, faceUpCard };
}

export function calculateHandScore(hand: Card[]): number {
  return hand.reduce((sum, card) => {
    if (card.rank === '9') return sum;
    return sum + card.value;
  }, 0);
}

export function getRoundSequence(totalRounds: number): number[] {
  const sequence: number[] = [];
  for (let cards = totalRounds; cards >= 2; cards--) {
    sequence.push(cards);
  }
  for (let cards = 3; cards <= totalRounds; cards++) {
    sequence.push(cards);
  }
  return sequence;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
