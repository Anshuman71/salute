'use client';

import { useGame } from './game/useGame';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';

export default function Home() {
  const {
    state,
    startGame,
    playCards,
    drawFromDeck,
    drawFromDiscard,
    callWin,
    nextRound,
    resetGame,
  } = useGame();

  if (state.roundPhase === 'setup') {
    return <SetupScreen onStartGame={startGame} />;
  }

  return (
    <GameBoard
      state={state}
      playCards={playCards}
      drawFromDeck={drawFromDeck}
      drawFromDiscard={drawFromDiscard}
      callWin={callWin}
      nextRound={nextRound}
      resetGame={resetGame}
    />
  );
}
