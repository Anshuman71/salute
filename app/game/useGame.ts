'use client';

import { useReducer, useCallback } from 'react';
import { GameState, GameSettings, Player, Card, RoundPhase } from './types';
import { createGameDeck, shuffle, dealCards, calculateHandScore, getRoundSequence } from './deck';

type TurnPhase = 'play' | 'draw'; // Player must play first, then draw

type GameAction =
  | { type: 'START_GAME'; settings: GameSettings }
  | { type: 'DEAL_CARDS' }
  | { type: 'PLAY_CARDS'; cardIds: string[] } // Support multiple cards
  | { type: 'DRAW_FROM_DECK' }
  | { type: 'DRAW_FROM_DISCARD' }
  | { type: 'CALL_WIN'; playerId: string }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET_GAME' };

interface ExtendedGameState extends GameState {
  turnPhase: TurnPhase; // Track whether player should play or draw
  lastPlayedCards: Card[]; // Cards just played (shown before picking)
  turnsPlayedThisRound: number; // How many complete turns have happened this round
  lastPlayerWhoPlayed: string | null; // ID of player who last completed a turn (can't call win immediately after)
}

const initialState: ExtendedGameState = {
  roomCode: '',
  players: [],
  deck: [],
  discardPile: [],
  currentPlayerIndex: 0,
  currentRound: 0,
  totalRounds: 5,
  cardsPerRound: 5,
  roundPhase: 'waiting',
  faceUpCard: null,
  gameWinner: null,
  turnPhase: 'play',
  lastPlayedCards: [],
  turnsPlayedThisRound: 0,
  lastPlayerWhoPlayed: null,
  settings: {
    totalRounds: 5,
    maxPlayers: 4,
  },
};

function gameReducer(state: ExtendedGameState, action: GameAction): ExtendedGameState {
  switch (action.type) {
    case 'START_GAME': {
      const { numPlayers, totalRounds, playerNames } = action.settings;

      const players: Player[] = playerNames.slice(0, numPlayers).map((name, idx) => ({
        id: `player-${idx}`,
        name: name || `Player ${idx + 1}`,
        hand: [],
        roundsWon: 0,
      }));

      const deck = shuffle(createGameDeck(numPlayers));
      const roundSequence = getRoundSequence(totalRounds);
      const cardsPerRound = roundSequence[0];

      const { remainingDeck, hands, faceUpCard } = dealCards(deck, numPlayers, cardsPerRound);

      // Assign hands to players
      const playersWithHands = players.map((player, idx) => ({
        ...player,
        hand: hands[idx],
      }));

      return {
        ...state,
        players: playersWithHands,
        deck: remainingDeck,
        discardPile: faceUpCard ? [faceUpCard] : [],
        currentPlayerIndex: 0,
        currentRound: 1,
        totalRounds,
        cardsPerRound,
        roundPhase: 'playing',
        faceUpCard,
        gameWinner: null,
        turnPhase: 'play',
        lastPlayedCards: [],
        turnsPlayedThisRound: 0,
        lastPlayerWhoPlayed: null,
      };
    }

    case 'PLAY_CARDS': {
      if (state.turnPhase !== 'play') return state;

      const currentPlayer = state.players[state.currentPlayerIndex];
      const cardsToPlay = currentPlayer.hand.filter(c => action.cardIds.includes(c.id));

      if (cardsToPlay.length === 0) return state;

      // Verify all cards have the same rank (for multi-card play)
      const firstRank = cardsToPlay[0].rank;
      if (!cardsToPlay.every(c => c.rank === firstRank)) return state;

      const newHand = currentPlayer.hand.filter(c => !action.cardIds.includes(c.id));

      const updatedPlayers = state.players.map((player, idx) =>
        idx === state.currentPlayerIndex ? { ...player, hand: newHand } : player
      );

      return {
        ...state,
        players: updatedPlayers,
        lastPlayedCards: cardsToPlay,
        turnPhase: 'draw', // Now player must draw
      };
    }

    case 'DRAW_FROM_DECK': {
      if (state.turnPhase !== 'draw') return state;
      if (state.deck.length === 0) return state;

      const [drawnCard, ...remainingDeck] = state.deck;
      const currentPlayer = state.players[state.currentPlayerIndex];

      const updatedPlayers = state.players.map((player, idx) =>
        idx === state.currentPlayerIndex
          ? { ...player, hand: [...player.hand, drawnCard] }
          : player
      );

      // Add played cards to discard pile now
      const newDiscardPile = [...state.discardPile, ...state.lastPlayedCards];

      // Move to next player
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

      return {
        ...state,
        players: updatedPlayers,
        deck: remainingDeck,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextPlayerIndex,
        turnPhase: 'play',
        lastPlayedCards: [],
        turnsPlayedThisRound: state.turnsPlayedThisRound + 1,
        lastPlayerWhoPlayed: currentPlayer.id,
      };
    }

    case 'DRAW_FROM_DISCARD': {
      if (state.turnPhase !== 'draw') return state;
      if (state.discardPile.length === 0) return state;

      const currentPlayer = state.players[state.currentPlayerIndex];

      // Pick the top card from discard (before the just-played cards)
      const drawnCard = state.discardPile[state.discardPile.length - 1];
      const remainingDiscard = state.discardPile.slice(0, -1);

      const updatedPlayers = state.players.map((player, idx) =>
        idx === state.currentPlayerIndex
          ? { ...player, hand: [...player.hand, drawnCard] }
          : player
      );

      // Add played cards to discard pile (replacing the picked card)
      const newDiscardPile = [...remainingDiscard, ...state.lastPlayedCards];

      // Move to next player
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

      return {
        ...state,
        players: updatedPlayers,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextPlayerIndex,
        turnPhase: 'play',
        lastPlayedCards: [],
        turnsPlayedThisRound: state.turnsPlayedThisRound + 1,
        lastPlayerWhoPlayed: currentPlayer.id,
      };
    }

    case 'CALL_WIN': {
      // Calculate scores for all players
      const scoresWithPlayers = state.players.map(player => ({
        player,
        score: calculateHandScore(player.hand),
      }));

      // Find minimum score
      const minScore = Math.min(...scoresWithPlayers.map(s => s.score));

      // Find players with minimum score
      const potentialWinners = scoresWithPlayers.filter(s => s.score === minScore);

      // Caller for this round
      const caller = state.players.find(p => p.id === action.playerId)!;

      let roundWinner: Player;

      if (potentialWinners.length === 1) {
        // Only one player with the lowest score
        roundWinner = potentialWinners[0].player;
      } else {
        // Multiple players tied - the caller wins if they're among them
        const callerInWinners = potentialWinners.find(s => s.player.id === action.playerId);
        roundWinner = callerInWinners ? caller : potentialWinners[0].player;
      }

      // Update player's wins
      const updatedPlayers = state.players.map(player =>
        player.id === roundWinner.id
          ? { ...player, roundsWon: player.roundsWon + 1 }
          : player
      );

      // Check if this was the last round
      const roundSequence = getRoundSequence(state.totalRounds);
      const isLastRound = state.currentRound >= roundSequence.length;

      if (isLastRound) {
        // Find overall winner
        const maxWins = Math.max(...updatedPlayers.map(p => p.roundsWon));
        const gameWinner = updatedPlayers.find(p => p.roundsWon === maxWins)!;

        return {
          ...state,
          players: updatedPlayers,
          roundPhase: 'finished',
          gameWinner,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
        roundPhase: 'scoring',
      };
    }

    case 'NEXT_ROUND': {
      const roundSequence = getRoundSequence(state.totalRounds);
      const nextRound = state.currentRound + 1;

      if (nextRound > roundSequence.length) {
        // Game over
        const maxWins = Math.max(...state.players.map(p => p.roundsWon));
        const gameWinner = state.players.find(p => p.roundsWon === maxWins)!;

        return {
          ...state,
          roundPhase: 'finished',
          gameWinner,
        };
      }

      const cardsPerRound = roundSequence[nextRound - 1];

      // Create fresh deck
      const deck = shuffle(createGameDeck(state.players.length));
      const { remainingDeck, hands, faceUpCard } = dealCards(deck, state.players.length, cardsPerRound);

      // Reset hands for all players
      const playersWithNewHands = state.players.map((player, idx) => ({
        ...player,
        hand: hands[idx],
      }));

      return {
        ...state,
        players: playersWithNewHands,
        deck: remainingDeck,
        discardPile: faceUpCard ? [faceUpCard] : [],
        currentPlayerIndex: 0,
        currentRound: nextRound,
        cardsPerRound,
        roundPhase: 'playing',
        faceUpCard,
        turnPhase: 'play',
        lastPlayedCards: [],
        turnsPlayedThisRound: 0,
        lastPlayerWhoPlayed: null,
      };
    }

    case 'RESET_GAME': {
      return initialState;
    }

    default:
      return state;
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startGame = useCallback((settings: GameSettings) => {
    dispatch({ type: 'START_GAME', settings });
  }, []);

  const playCards = useCallback((cardIds: string[]) => {
    dispatch({ type: 'PLAY_CARDS', cardIds });
  }, []);

  const drawFromDeck = useCallback(() => {
    dispatch({ type: 'DRAW_FROM_DECK' });
  }, []);

  const drawFromDiscard = useCallback(() => {
    dispatch({ type: 'DRAW_FROM_DISCARD' });
  }, []);

  const callWin = useCallback((playerId: string) => {
    dispatch({ type: 'CALL_WIN', playerId });
  }, []);

  const nextRound = useCallback(() => {
    dispatch({ type: 'NEXT_ROUND' });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
  }, []);

  return {
    state,
    startGame,
    playCards,
    drawFromDeck,
    drawFromDiscard,
    callWin,
    nextRound,
    resetGame,
  };
}
