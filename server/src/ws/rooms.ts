import type { GameState, Player, Card, ServerMessage, RoomSettings } from '../game/types';
import { createGameDeck, shuffle, dealCards, calculateHandScore, getRoundSequence, generatePlayerId } from '../game/logic';

// In-memory game state for each room
const gameStates = new Map<string, GameState>();

// WebSocket connections per room
const roomConnections = new Map<string, Map<string, { ws: unknown; playerId: string }>>();

export function createRoom(roomCode: string, hostName: string, hostSessionId: string, settings: RoomSettings): { playerId: string; state: GameState } {
  const playerId = generatePlayerId();
  
  const state: GameState = {
    roomCode,
    players: [{
      id: playerId,
      name: hostName,
      hand: [],
      roundsWon: 0,
      sessionId: hostSessionId,
      isConnected: true,
    }],
    deck: [],
    discardPile: [],
    currentPlayerIndex: 0,
    currentRound: 0,
    totalRounds: settings.totalRounds,
    cardsPerRound: settings.totalRounds,
    roundPhase: 'waiting',
    turnPhase: 'play',
    lastPlayedCards: [],
    turnsPlayedThisRound: 0,
    lastPlayerWhoPlayed: null,
    gameWinner: null,
  };
  
  gameStates.set(roomCode, state);
  roomConnections.set(roomCode, new Map());
  
  return { playerId, state };
}

export function joinRoom(roomCode: string, playerName: string, sessionId: string): { playerId: string; state: GameState } | null {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  if (state.roundPhase !== 'waiting') return null;
  
  const playerId = generatePlayerId();
  
  state.players.push({
    id: playerId,
    name: playerName,
    hand: [],
    roundsWon: 0,
    sessionId,
    isConnected: true,
  });
  
  return { playerId, state };
}

export function startGame(roomCode: string, callerSessionId: string): GameState | null {
  const state = gameStates.get(roomCode);
  if (!state) return null;
  
  // Only host can start
  const host = state.players.find(p => p.sessionId === callerSessionId);
  if (!host || state.players.indexOf(host) !== 0) return null;
  
  // Need at least 2 players
  if (state.players.length < 2) return null;
  
  // Initialize first round
  const roundSequence = getRoundSequence(state.totalRounds);
  const cardsPerRound = roundSequence[0];
  const deck = shuffle(createGameDeck(state.players.length));
  const { remainingDeck, hands, faceUpCard } = dealCards(deck, state.players.length, cardsPerRound);
  
  state.players.forEach((player, idx) => {
    player.hand = hands[idx];
  });
  
  state.deck = remainingDeck;
  state.discardPile = faceUpCard ? [faceUpCard] : [];
  state.currentRound = 1;
  state.cardsPerRound = cardsPerRound;
  state.roundPhase = 'playing';
  state.turnPhase = 'play';
  state.currentPlayerIndex = 0;
  state.turnsPlayedThisRound = 0;
  state.lastPlayerWhoPlayed = null;
  
  return state;
}

export function playCards(roomCode: string, sessionId: string, cardIds: string[]): GameState | { error: string } {
  const state = gameStates.get(roomCode);
  if (!state) return { error: 'Room not found' };
  
  const player = state.players.find(p => p.sessionId === sessionId);
  if (!player) return { error: 'Player not found' };
  
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== player.id) return { error: 'Not your turn' };
  if (state.turnPhase !== 'play') return { error: 'You must draw a card first' };
  
  const cardsToPlay = player.hand.filter(c => cardIds.includes(c.id));
  if (cardsToPlay.length === 0) return { error: 'Invalid cards' };
  
  // Verify all same rank
  const firstRank = cardsToPlay[0].rank;
  if (!cardsToPlay.every(c => c.rank === firstRank)) {
    return { error: 'All cards must be same rank' };
  }
  
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  state.lastPlayedCards = cardsToPlay;
  state.turnPhase = 'draw';
  
  return state;
}

export function drawCard(roomCode: string, sessionId: string, source: 'deck' | 'discard'): GameState | { error: string } {
  const state = gameStates.get(roomCode);
  if (!state) return { error: 'Room not found' };
  
  const player = state.players.find(p => p.sessionId === sessionId);
  if (!player) return { error: 'Player not found' };
  
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== player.id) return { error: 'Not your turn' };
  if (state.turnPhase !== 'draw') return { error: 'You must play a card first' };
  
  let drawnCard: Card | undefined;
  
  if (source === 'deck') {
    if (state.deck.length === 0) return { error: 'Deck is empty' };
    drawnCard = state.deck.shift();
  } else {
    if (state.discardPile.length === 0) return { error: 'Discard pile is empty' };
    drawnCard = state.discardPile.pop();
  }
  
  if (drawnCard) {
    player.hand.push(drawnCard);
  }
  
  // Add played cards to discard
  state.discardPile.push(...state.lastPlayedCards);
  state.lastPlayedCards = [];
  
  // Next player
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnPhase = 'play';
  state.turnsPlayedThisRound++;
  state.lastPlayerWhoPlayed = player.id;
  
  return state;
}

export function callWin(roomCode: string, sessionId: string): GameState | { error: string } {
  const state = gameStates.get(roomCode);
  if (!state) return { error: 'Room not found' };
  
  const caller = state.players.find(p => p.sessionId === sessionId);
  if (!caller) return { error: 'Player not found' };
  
  // Check win conditions
  if (state.turnsPlayedThisRound < state.players.length) {
    return { error: 'All players must play at least once' };
  }
  if (caller.id === state.lastPlayerWhoPlayed) {
    return { error: 'Cannot call win right after your turn' };
  }
  
  // Calculate scores
  const scores = state.players.map(p => ({
    player: p,
    score: calculateHandScore(p.hand),
  }));
  
  const minScore = Math.min(...scores.map(s => s.score));
  const potentialWinners = scores.filter(s => s.score === minScore);
  
  let roundWinner: Player;
  if (potentialWinners.length === 1) {
    roundWinner = potentialWinners[0].player;
  } else {
    const callerInWinners = potentialWinners.find(s => s.player.id === caller.id);
    roundWinner = callerInWinners ? caller : potentialWinners[0].player;
  }
  
  roundWinner.roundsWon++;
  
  const roundSequence = getRoundSequence(state.totalRounds);
  
  if (state.currentRound >= roundSequence.length) {
    // Game over
    const maxWins = Math.max(...state.players.map(p => p.roundsWon));
    state.gameWinner = state.players.find(p => p.roundsWon === maxWins) || null;
    state.roundPhase = 'finished';
  } else {
    state.roundPhase = 'scoring';
  }
  
  return state;
}

export function nextRound(roomCode: string): GameState | { error: string } {
  const state = gameStates.get(roomCode);
  if (!state) return { error: 'Room not found' };
  if (state.roundPhase !== 'scoring') return { error: 'Not in scoring phase' };
  
  const roundSequence = getRoundSequence(state.totalRounds);
  const nextRoundNum = state.currentRound + 1;
  
  if (nextRoundNum > roundSequence.length) {
    const maxWins = Math.max(...state.players.map(p => p.roundsWon));
    state.gameWinner = state.players.find(p => p.roundsWon === maxWins) || null;
    state.roundPhase = 'finished';
    return state;
  }
  
  const cardsPerRound = roundSequence[nextRoundNum - 1];
  const deck = shuffle(createGameDeck(state.players.length));
  const { remainingDeck, hands, faceUpCard } = dealCards(deck, state.players.length, cardsPerRound);
  
  state.players.forEach((player, idx) => {
    player.hand = hands[idx];
  });
  
  state.deck = remainingDeck;
  state.discardPile = faceUpCard ? [faceUpCard] : [];
  state.currentRound = nextRoundNum;
  state.cardsPerRound = cardsPerRound;
  state.roundPhase = 'playing';
  state.turnPhase = 'play';
  state.currentPlayerIndex = 0;
  state.turnsPlayedThisRound = 0;
  state.lastPlayerWhoPlayed = null;
  state.lastPlayedCards = [];
  
  return state;
}

export function getRoom(roomCode: string): GameState | undefined {
  return gameStates.get(roomCode);
}

export function removePlayer(roomCode: string, sessionId: string): void {
  const state = gameStates.get(roomCode);
  if (!state) return;
  
  const playerIndex = state.players.findIndex(p => p.sessionId === sessionId);
  if (playerIndex !== -1) {
    state.players[playerIndex].isConnected = false;
  }
  
  // If all players disconnected, clean up
  if (state.players.every(p => !p.isConnected)) {
    gameStates.delete(roomCode);
    roomConnections.delete(roomCode);
  }
}

export function addConnection(roomCode: string, sessionId: string, ws: unknown, playerId: string): void {
  const connections = roomConnections.get(roomCode);
  if (connections) {
    connections.set(sessionId, { ws, playerId });
  }
}

export function getConnections(roomCode: string): Map<string, { ws: unknown; playerId: string }> | undefined {
  return roomConnections.get(roomCode);
}

// Helper to get sanitized state for a specific player (hide other players' hands)
export function getSanitizedStateForPlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    deck: [], // Never send deck to client
    players: state.players.map(p => ({
      ...p,
      hand: p.id === playerId ? p.hand : p.hand.map(() => ({ id: 'hidden', suit: 'spades' as const, rank: 'A' as const, value: 0 })),
    })),
  };
}
