import { Card, Suit, Rank } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Numeric values for each rank
const RANK_VALUES: Record<Rank, number> = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
};

/**
 * Creates a standard 52-card deck.
 */
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

/**
 * Creates a game deck based on number of players.
 * - 2 players: 52 cards
 * - For each additional player: add 26 random cards
 */
export function createGameDeck(numPlayers: number): Card[] {
  let deck = createStandardDeck('deck1-');
  
  if (numPlayers > 2) {
    const extraDecksNeeded = numPlayers - 2;
    for (let i = 0; i < extraDecksNeeded; i++) {
      // Create another deck and pick 26 random cards from it
      const extraDeck = createStandardDeck(`extra${i + 1}-`);
      const shuffledExtra = shuffle([...extraDeck]);
      deck = [...deck, ...shuffledExtra.slice(0, 26)];
    }
  }
  
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal cards from deck to players
 * Returns updated deck and player hands
 */
export function dealCards(
  deck: Card[],
  numPlayers: number,
  cardsPerPlayer: number
): { remainingDeck: Card[]; hands: Card[][]; faceUpCard: Card | null } {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let deckCopy = [...deck];
  
  // Deal cards one at a time to each player
  for (let cardNum = 0; cardNum < cardsPerPlayer; cardNum++) {
    for (let playerIdx = 0; playerIdx < numPlayers; playerIdx++) {
      if (deckCopy.length > 0) {
        hands[playerIdx].push(deckCopy.shift()!);
      }
    }
  }
  
  // Place one card face up (the first card after dealing)
  const faceUpCard = deckCopy.length > 0 ? deckCopy.shift()! : null;
  
  return { remainingDeck: deckCopy, hands, faceUpCard };
}

/**
 * Calculate score for a hand.
 * 9s count as 0.
 */
export function calculateHandScore(hand: Card[]): number {
  return hand.reduce((sum, card) => {
    // 9s count as 0
    if (card.rank === '9') return sum;
    return sum + card.value;
  }, 0);
}

/**
 * Determine the round sequence (cards per round).
 * Goes from X down to 2, then back up to X.
 */
export function getRoundSequence(totalRounds: number): number[] {
  const sequence: number[] = [];
  
  // Phase 1: Decreasing from X to 2
  for (let cards = totalRounds; cards >= 2; cards--) {
    sequence.push(cards);
  }
  
  // Phase 2: Increasing from 3 back to X
  for (let cards = 3; cards <= totalRounds; cards++) {
    sequence.push(cards);
  }
  
  return sequence;
}
