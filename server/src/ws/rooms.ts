import type { GameState, Player, Card, ServerMessage, RoomSettings } from '../game/types';
import { createGameDeck, shuffle, dealCards, calculateHandScore, getRoundSequence } from '../game/logic';
import { db, schema } from '../db';
import { eq, lt } from 'drizzle-orm';

// WebSocket connections per room
const roomConnections = new Map<string, Map<string, { ws: unknown; playerId: string }>>();

export function createRoom(roomCode: string, hostName: string, playerId: string, settings: RoomSettings): { playerId: string; state: GameState } {
  const state: GameState = {
    roomCode,
    players: [{
      id: playerId,
      name: hostName,
      hand: [],
      roundsWon: 0,
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
    settings,
    hostPlayerId: playerId,
  };

  roomConnections.set(roomCode, new Map());

  return { playerId, state };
}

export function updateRoomSettings(roomCode: string, playerId: string, newSettings: RoomSettings): GameState | { error: string } {
  const state = getRoom(roomCode);
  if (!state) return { error: 'Room not found' };

  const host = state.players.find(p => p.id === state.hostPlayerId);
  if (!host || host.id !== playerId) return { error: 'Only host can update settings' };

  if (state.roundPhase !== 'waiting') return { error: 'Cannot update settings after game started' };

  state.settings = newSettings;
  state.totalRounds = newSettings.totalRounds;
  state.cardsPerRound = newSettings.totalRounds; // Initialize first round card count

  saveGameState(state);

  return state;
}

export function joinRoom(roomCode: string, playerName: string, playerId: string): { playerId: string; state: GameState } | null {
  const state = getRoom(roomCode);

  if (!state) return null;

  // Check if player already exists with this sessionId (for re-joins)
  const existingPlayer = state.players.find(p => p.id === playerId);

  if (existingPlayer) {
    existingPlayer.isConnected = true;
    existingPlayer.name = playerName;
    state.players = state.players.map(p => p.id === playerId ? existingPlayer : p);
    saveGameState(state);
    return { playerId: existingPlayer.id, state };
  }

  // Only allow new joins if game hasn't started
  if (state.roundPhase !== 'waiting') return null;

  state.players.push({
    id: playerId,
    name: playerName,
    hand: [],
    roundsWon: 0,
    isConnected: true,
  });

  saveGameState(state);
  return { playerId, state };
}

export function startGame(roomCode: string, playerId: string): GameState | null {
  const state = getRoom(roomCode);
  if (!state) return null;

  // Only host can start
  const host = state.players.find(p => p.id === playerId);
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

  state.lastPlayerWhoPlayed = null;

  saveGameState(state);

  return state;
}

export function playCards(roomCode: string, playerId: string, cardIds: string[]): GameState | { error: string } {
  const state = getRoom(roomCode);
  if (!state) return { error: 'Room not found' };

  const player = state.players.find(p => p.id === playerId);
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

  saveGameState(state);
  return state;
}

export function drawCard(roomCode: string, playerId: string, source: 'deck' | 'discard'): GameState | { error: string } {
  const state = getRoom(roomCode);
  if (!state) return { error: 'Room not found' };

  const player = state.players.find(p => p.id === playerId);
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

  saveGameState(state);
  return state;
}

export function callWin(roomCode: string, playerId: string): GameState | { error: string } {
  const state = getRoom(roomCode);
  if (!state) return { error: 'Room not found' };

  const caller = state.players.find(p => p.id === playerId);
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
    // if scores tie than make the other player winner
    roundWinner = potentialWinners.find(s => s.player.id !== caller.id)?.player || potentialWinners[0].player;
  }

  roundWinner.roundsWon++;

  // Record round in DB
  const dbRoom = db.select().from(schema.rooms).where(eq(schema.rooms.code, roomCode)).get();

  if (dbRoom) {
    const scoresMap = state.players.reduce((acc, p) => {
      acc[p.name] = calculateHandScore(p.hand);
      return acc;
    }, {} as Record<string, number>);

    // Get DB player ID for the winner
    const dbWinner = db.select().from(schema.roomPlayers).where(eq(schema.roomPlayers.playerId, roundWinner.id)).get();

    if (dbWinner) {
      db.insert(schema.gameRounds).values({
        roomId: dbRoom.id,
        roundNumber: state.currentRound,
        winnerId: dbWinner.playerId,
        scores: JSON.stringify(scoresMap),
      }).run();
    }
  }

  const roundSequence = getRoundSequence(state.totalRounds);

  if (state.currentRound >= roundSequence.length) {
    // Game over
    const maxWins = Math.max(...state.players.map(p => p.roundsWon));
    state.gameWinner = state.players.find(p => p.roundsWon === maxWins) || null;
    state.roundPhase = 'finished';

    // Update DB with final winner and status
    if (state.gameWinner) {
      const dbWinner = db.select({ id: schema.roomPlayers.playerId }).from(schema.roomPlayers).where(eq(schema.roomPlayers.playerId, state.gameWinner.id)).get();

      db.update(schema.rooms)
        .set({
          status: 'finished',
          winnerId: dbWinner?.id,
        })
        .where(eq(schema.rooms.code, roomCode))
        .run();
    }
  } else {
    state.roundPhase = 'scoring';
  }

  saveGameState(state);
  return state;
}

export function nextRound(roomCode: string): GameState | { error: string } {
  const state = getRoom(roomCode);
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

  // DB update handled by saveGameState
  saveGameState(state);

  return state;
}

// Helper to save state persistence
function saveGameState(state: GameState): void {
  try {
    db.update(schema.rooms)
      .set({
        gameState: JSON.stringify(state),
        settings: JSON.stringify(state.settings),
        currentRound: state.currentRound,
        status: state.roundPhase === 'finished' ? 'finished' : (state.roundPhase === 'waiting' ? 'waiting' : 'playing')
      })
      .where(eq(schema.rooms.code, state.roomCode))
      .run();
  } catch (err) {
    console.error(`[DB] Failed to save game state for ${state.roomCode}:`, err);
  }
}


export function getRoom(roomCode: string): GameState | undefined {
  // Try hydration from DB
  try {
    const room = db.select().from(schema.rooms).where(eq(schema.rooms.code, roomCode)).get();

    if (room && room.gameState) {
      const state = JSON.parse(room.gameState) as GameState;
      // Re-init connection map if needed
      if (!roomConnections.has(roomCode)) {
        roomConnections.set(roomCode, new Map());
      }
      console.log(`[Room] Hydrated ${roomCode} from DB`);
      return state;
    }
  } catch (err) {
    console.error(`[DB] Failed to hydrate room ${roomCode}:`, err);
  }

  return undefined;
}

export function removePlayer(roomCode: string, playerId: string): void {
  const state = getRoom(roomCode);
  if (!state) return;

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex !== -1) {
    state.players[playerIndex].isConnected = false;
    console.log(`[Room] Player ${state.players[playerIndex].name} disconnected from ${roomCode}`);
  }
}

export function addConnection(roomCode: string, playerId: string, ws: unknown): void {
  const connections = roomConnections.get(roomCode);
  if (connections) {
    connections.set(playerId, { ws, playerId });
  }
}

export function getConnections(roomCode: string): Map<string, { ws: unknown; playerId: string }> | undefined {
  return roomConnections.get(roomCode);
}

// Helper to get sanitized state for a specific player (hide other players' hands)
export function getSanitizedStateForPlayer(state: GameState, playerId: string): GameState {
  const showAllHands = state.roundPhase === 'scoring' || state.roundPhase === 'finished';

  return {
    ...state,
    // Send dummy cards for deck so client knows the count
    deck: state.deck.map((_, i) => ({
      id: `deck-hidden-${i}`,
      suit: 'spades' as const,
      rank: 'A' as const,
      value: 0
    })),
    players: state.players.map(p => ({
      ...p,
      hand: (p.id === playerId || showAllHands) ? p.hand : p.hand.map((_, i) => ({
        id: `hidden-${p.id}-${i}`,
        suit: 'spades' as const,
        rank: 'A' as const,
        value: 0
      })),
    })),
  };
}


export function cleanupRooms() {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  db.delete(schema.rooms)
    .where(lt(schema.rooms.createdAt, new Date(oneDayAgo)))
    .run();
}