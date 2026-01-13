'use client';

import { useState } from 'react';
import { useGame } from './game/useGame';
import { useMultiplayer } from './game/useMultiplayer';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';

export default function Home() {
  const multiplayerGame = useMultiplayer();

  const handleCreateRoom = (playerName: string, settings: any) => {
    localStorage.setItem('salute_player_name', playerName);
    multiplayerGame.createRoom(playerName, settings);
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    localStorage.setItem('salute_player_name', playerName);
    multiplayerGame.joinRoom(roomCode, playerName);
  };

  const handleStartLocalGame = () => {
    // Local game can also just be a "special" room or we keep it here.
    // Given the user wants room based routing, let's keep it simple for now.
    alert('Local game is being migrated. Try hosting a multiplayer game!');
  };

  return (
    <SetupScreen
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onStartLocalGame={handleStartLocalGame}
      isConnected={multiplayerGame.isConnected}
      error={multiplayerGame.error}
    />
  );
}
