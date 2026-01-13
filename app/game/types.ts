// Card Types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number; // Numeric value for scoring (9 = 0 rule applied at scoring time)
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  roundsWon: number;
}

export type RoundPhase = 'setup' | 'dealing' | 'playing' | 'scoring' | 'finished';

export interface GameState {
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  currentRound: number;
  totalRounds: number; // X selected by user
  cardsPerRound: number; // Current cards to deal this round
  roundPhase: RoundPhase;
  roundDirection: 'decreasing' | 'increasing'; // X -> 2 then 2 -> X
  faceUpCard: Card | null; // Card placed face up after dealing
  gameWinner: Player | null;
}

export interface GameSettings {
  numPlayers: number;
  totalRounds: number; // X value (3-12)
  playerNames: string[];
}
