"use client";

import { useState, useMemo, useEffect } from "react";
import { GameState, Card as CardType } from "../game/types";
import { calculateHandScore, getRoundSequence } from "../game/deck";
import { soundManager } from "../game/sounds";
import Card from "./Card";
import PlayerHand from "./PlayerHand";

interface ExtendedGameState extends GameState {
  turnPhase: "play" | "draw";
  lastPlayedCards: CardType[];
  turnsPlayedThisRound: number;
  lastPlayerWhoPlayed: string | null;
}

interface GameBoardProps {
  state: ExtendedGameState;
  playCards: (cardIds: string[]) => void;
  drawFromDeck: () => void;
  drawFromDiscard: () => void;
  callWin: (playerId: string) => void;
  nextRound: () => void;
  resetGame: () => void;
  playerId?: string;
}

export default function GameBoard({
  state,
  playCards,
  drawFromDeck,
  drawFromDiscard,
  callWin,
  nextRound,
  resetGame,
  playerId,
}: GameBoardProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set()
  );

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = playerId ? currentPlayer?.id === playerId : true;
  const roundSequence = getRoundSequence(state.totalRounds);
  const isPlayPhase = state.turnPhase === "play";
  const isDrawPhase = state.turnPhase === "draw";

  // Check if all players have played at least once AND current player didn't just play
  const canDeclareWin =
    state.turnsPlayedThisRound >= state.players.length &&
    currentPlayer?.id !== state.lastPlayerWhoPlayed &&
    isMyTurn;

  // Get last 3 cards from discard pile for stacked display
  const stackedDiscardCards = state.discardPile.slice(-3);

  // Group cards by rank to determine if multi-select is needed
  const cardsByRank = useMemo(() => {
    if (!currentPlayer) return new Map<string, CardType[]>();
    const map = new Map<string, CardType[]>();
    currentPlayer.hand.forEach((card) => {
      const existing = map.get(card.rank) || [];
      map.set(card.rank, [...existing, card]);
    });
    return map;
  }, [currentPlayer]);

  // Check if a card has duplicates (same rank)
  const hasDuplicates = (card: CardType) => {
    return (cardsByRank.get(card.rank)?.length || 0) > 1;
  };

  const handleCardClick = (card: CardType) => {
    if (!isPlayPhase) return;

    soundManager.playSelect();

    // If card has no duplicates, play immediately
    if (!hasDuplicates(card)) {
      soundManager.playThrow();
      playCards([card.id]);
      setSelectedCardIds(new Set());
      return;
    }

    // Toggle selection for cards with duplicates
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(card.id)) {
        next.delete(card.id);
      } else {
        // Only allow selecting cards of the same rank
        const sameRankCards = cardsByRank.get(card.rank) || [];

        // If selecting a different rank, clear previous selection
        const currentSelection = Array.from(next);
        if (currentSelection.length > 0) {
          const firstSelectedCard = currentPlayer.hand.find(
            (c) => c.id === currentSelection[0]
          );
          if (firstSelectedCard && firstSelectedCard.rank !== card.rank) {
            next.clear();
          }
        }

        next.add(card.id);
      }
      return next;
    });
  };

  const handlePlaySelected = () => {
    if (selectedCardIds.size > 0) {
      soundManager.playThrow();
      playCards(Array.from(selectedCardIds));
      setSelectedCardIds(new Set());
    }
  };

  const handleDraw = (fromDeck: boolean) => {
    if (isDrawPhase && isMyTurn) {
      soundManager.playDraw();
      if (fromDeck) {
        drawFromDeck();
      } else {
        drawFromDiscard();
      }
    }
  };

  const handleCallWin = () => {
    if (canDeclareWin && isMyTurn) {
      soundManager.playWin();
      callWin(currentPlayer.id);
    }
  };

  // Scoring phase
  if (state.roundPhase === "scoring") {
    const scores = state.players.map((p) => ({
      player: p,
      score: calculateHandScore(p.hand),
    }));
    const minScore = Math.min(...scores.map((s) => s.score));

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex flex-col items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-2xl w-full border border-white/20">
          <h2 className="text-3xl font-bold text-center text-white mb-6">
            Round {state.currentRound} Complete! 🎉
          </h2>

          <div className="space-y-4 mb-6">
            {scores
              .sort((a, b) => a.score - b.score)
              .map(({ player, score }) => (
                <div
                  key={player.id}
                  className={`
                  p-4 rounded-xl flex justify-between items-center
                  ${
                    score === minScore
                      ? "bg-emerald-500/30 border-2 border-emerald-400"
                      : "bg-white/5"
                  }
                `}
                >
                  <div className="flex items-center gap-3">
                    {score === minScore && <span className="text-2xl">👑</span>}
                    <span className="text-white font-medium">
                      {player.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                      {player.hand.map((card) => (
                        <Card key={card.id} card={card} small />
                      ))}
                    </div>
                    <span
                      className={`text-xl font-bold ${
                        score === minScore
                          ? "text-emerald-400"
                          : "text-gray-300"
                      }`}
                    >
                      {score} pts
                    </span>
                  </div>
                </div>
              ))}
          </div>
          {playerId === state.hostPlayerId && (
            <button
              onClick={nextRound}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {state.currentRound < roundSequence.length
                ? "Next Round →"
                : "See Final Results"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Game finished
  if (state.roundPhase === "finished" && state.gameWinner) {
    const sortedPlayers = [...state.players].sort(
      (a, b) => b.roundsWon - a.roundsWon
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex flex-col items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-lg w-full border border-white/20 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-pink-500 mb-2">
            Game Finished!
          </h2>
          <p className="text-2xl text-white mb-6">
            {state.gameWinner.name} wins with {state.gameWinner.roundsWon}{" "}
            rounds!
          </p>

          <div className="space-y-2 mb-8">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className={`
                  p-3 rounded-xl flex justify-between items-center
                  ${
                    idx === 0
                      ? "bg-amber-500/30"
                      : idx === 1
                      ? "bg-gray-400/20"
                      : idx === 2
                      ? "bg-orange-700/20"
                      : "bg-white/5"
                  }
                `}
              >
                <span className="text-white">
                  {idx === 0
                    ? "🥇"
                    : idx === 1
                    ? "🥈"
                    : idx === 2
                    ? "🥉"
                    : `${idx + 1}.`}{" "}
                  {player.name}
                </span>
                <span className="text-amber-400 font-bold">
                  {player.roundsWon} rounds
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Play Again 🎴
          </button>
        </div>
      </div>
    );
  }

  // Playing phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🃏 Salute!</h1>
          <p className="text-gray-400 text-sm">
            Round {state.currentRound}/{roundSequence.length} •{" "}
            {state.cardsPerRound} cards
          </p>
        </div>
        <button
          onClick={handleCallWin}
          disabled={!canDeclareWin}
          className={`
            px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300
            ${
              canDeclareWin
                ? "bg-gradient-to-r from-amber-500 to-pink-500 text-white hover:shadow-xl hover:scale-105"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }
          `}
          title={
            !canDeclareWin
              ? "All players must play at least one card first"
              : "Declare victory!"
          }
        >
          🎯 I Win!
        </button>
      </div>

      {/* Turn Indicator */}
      <div className="mb-4 p-3 rounded-xl bg-white/10 border border-white/20 text-center">
        <span className="text-white font-medium">
          {currentPlayer?.name}&apos;s turn —
          {isPlayPhase ? (
            <span className="text-amber-400"> Play a card</span>
          ) : (
            <span className="text-emerald-400">
              {" "}
              Pick a card from deck or discard
            </span>
          )}
        </span>
      </div>

      {/* Game Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Deck, Last Played, and Discard */}
        <div className="lg:col-span-1 flex lg:flex-col gap-6 justify-center items-center bg-white/5 rounded-2xl p-4 border border-white/10">
          {/* Deck */}
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">
              Deck ({state.deck.length})
            </p>
            <div
              className={`transition-all duration-200 ${
                isDrawPhase
                  ? "cursor-pointer hover:scale-105 ring-2 ring-emerald-400/50 rounded-lg"
                  : "opacity-60 cursor-not-allowed"
              }`}
              onClick={() => handleDraw(true)}
            >
              <Card
                card={{ id: "deck", suit: "spades", rank: "A", value: 1 }}
                faceDown
              />
            </div>
          </div>

          {/* Last Played Cards (shown during draw phase) */}
          {isDrawPhase && state.lastPlayedCards.length > 0 && (
            <div className="text-center">
              <p className="text-pink-400 text-sm mb-2">Just played</p>
              <div className="flex gap-1 justify-center">
                {state.lastPlayedCards.map((card) => (
                  <Card key={card.id} card={card} small />
                ))}
              </div>
            </div>
          )}

          {/* Discard Pile - Stacked with rotation */}
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">
              Discard ({state.discardPile.length})
            </p>
            {stackedDiscardCards.length > 0 ? (
              <div
                className={`relative w-24 h-32 transition-all duration-200 ${
                  isDrawPhase ? "cursor-pointer" : "cursor-not-allowed"
                }`}
                onClick={() => handleDraw(false)}
              >
                {stackedDiscardCards.map((card, index) => {
                  const isTop = index === stackedDiscardCards.length - 1;
                  const rotation = index * 15; // -15, 0, 15 degrees
                  const zIndex = index;

                  return (
                    <div
                      key={card.id}
                      className={`absolute left-1/2 top-0 -translate-x-1/2 transition-all duration-200 ${
                        isTop && isDrawPhase
                          ? "ring-2 ring-emerald-400/50 rounded-lg hover:scale-105"
                          : ""
                      }`}
                      style={{
                        transform: `translateX(-50%) rotate(${rotation}deg)`,
                        zIndex,
                      }}
                    >
                      <Card card={card} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-20 h-28 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-600">
                Empty
              </div>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="lg:col-span-2 space-y-4">
          {state.players.map((player, idx) => {
            const isMe = playerId
              ? player.id === playerId
              : idx === state.currentPlayerIndex;
            return (
              <PlayerHand
                key={player.id}
                cards={player.hand}
                isCurrentPlayer={idx === state.currentPlayerIndex}
                selectedCardIds={
                  idx === state.currentPlayerIndex && isMyTurn
                    ? selectedCardIds
                    : new Set()
                }
                onCardClick={handleCardClick}
                playerName={
                  player.name +
                  (playerId && player.id === playerId ? " (You)" : "")
                }
                roundsWon={player.roundsWon}
                canInteract={
                  idx === state.currentPlayerIndex && isPlayPhase && isMyTurn
                }
                cardsByRank={
                  idx === state.currentPlayerIndex && isMyTurn
                    ? cardsByRank
                    : new Map()
                }
              />
            );
          })}
        </div>
      </div>

      {/* Play Selected Button (only when multiple cards selected) */}
      {selectedCardIds.size > 0 && isPlayPhase && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handlePlaySelected}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg shadow-2xl hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Play {selectedCardIds.size} Card
            {selectedCardIds.size > 1 ? "s" : ""} 🎴
          </button>
        </div>
      )}
    </div>
  );
}
