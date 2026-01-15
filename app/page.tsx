"use client";

import { useMultiplayer } from "./game/useMultiplayer";
import SetupScreen from "./components/SetupScreen";

export default function Home() {
  const multiplayerGame = useMultiplayer();

  const handleCreateRoom = (playerName: string, settings: any) => {
    multiplayerGame.createRoom(playerName, settings);
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    multiplayerGame.joinRoom(roomCode, playerName);
  };

  return (
    <SetupScreen
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      isConnected={multiplayerGame.isConnected}
      error={multiplayerGame.error}
    />
  );
}
