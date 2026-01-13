// Shared game types (mirrors server types)

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  roundsWon: number;
  sessionId?: string;
  isConnected?: boolean;
}

export type RoundPhase = 'waiting' | 'dealing' | 'playing' | 'scoring' | 'finished';
export type TurnPhase = 'play' | 'draw';

export interface GameState {
  roomCode: string;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  currentRound: number;
  totalRounds: number;
  cardsPerRound: number;
  roundPhase: RoundPhase;
  turnPhase: TurnPhase;
  lastPlayedCards: Card[];
  turnsPlayedThisRound: number;
  lastPlayerWhoPlayed: string | null;
  faceUpCard: Card | null;
  gameWinner: Player | null;
}

export interface RoomSettings {
  totalRounds: number;
  maxPlayers: number;
}

export interface GameSettings {
  numPlayers: number;
  totalRounds: number;
  playerNames: string[];
}

// WebSocket message types
export type ClientMessage =
  | { type: 'create_room'; playerName: string; settings: RoomSettings }
  | { type: 'join_room'; code: string; playerName: string }
  | { type: 'start_game' }
  | { type: 'play_cards'; cardIds: string[] }
  | { type: 'draw_card'; source: 'deck' | 'discard' }
  | { type: 'call_win' }
  | { type: 'leave_room' };

export type ServerMessage =
  | { type: 'room_created'; roomCode: string; playerId: string; players: { id: string; name: string; isHost: boolean }[] }
  | { type: 'room_joined'; roomCode: string; playerId: string; players: { id: string; name: string; isHost: boolean }[] }
  | { type: 'player_joined'; player: { id: string; name: string } }
  | { type: 'player_left'; playerId: string }
  | { type: 'game_started' }
  | { type: 'game_state'; state: GameState }
  | { type: 'round_ended'; scores: { playerId: string; score: number }[]; winnerId: string }
  | { type: 'game_ended'; winnerId: string; leaderboard: { playerId: string; name: string; roundsWon: number }[] }
  | { type: 'error'; message: string };
