'use client';

import { useState, useEffect, use } from 'react';
import { useMultiplayer } from '../game/useMultiplayer';
import GameBoard from '../components/GameBoard';
import SetupScreen from '../components/SetupScreen';
import { useRouter } from 'next/navigation';

export default function RoomPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.roomCode.toUpperCase();
  const router = useRouter();
  
  const [playerName, setPlayerName] = useState<string | null>(null);
  const multiplayerGame = useMultiplayer(roomCode);

  useEffect(() => {
    console.log(`[RoomPage] Mounted for room: ${roomCode}`);
    const storedName = localStorage.getItem('salute_player_name');
    if (storedName) {
      console.log(`[RoomPage] Found stored name: ${storedName}`);
      setPlayerName(storedName);
    }
  }, [roomCode]);

  // Auto-join if we have a name and are connected
  useEffect(() => {
    if (multiplayerGame.isConnected && roomCode && playerName && !multiplayerGame.playerId) {
      console.log(`[RoomPage] Attempting auto-join for ${playerName} in ${roomCode}`);
      multiplayerGame.joinRoom(roomCode, playerName);
    }
  }, [multiplayerGame.isConnected, roomCode, playerName, multiplayerGame.playerId, multiplayerGame]);

  const handleJoin = (code: string, name: string) => {
    localStorage.setItem('salute_player_name', name);
    setPlayerName(name);
    multiplayerGame.joinRoom(code, name);
  };

  const handleCreate = (name: string, settings: any) => {
    localStorage.setItem('salute_player_name', name);
    setPlayerName(name);
    multiplayerGame.createRoom(name, settings);
  };

  // If game has started, show board
  if (multiplayerGame.gameState && multiplayerGame.gameState.roundPhase !== 'waiting') {
    return (
      <GameBoard
        state={multiplayerGame.gameState as any}
        playCards={multiplayerGame.playCards}
        drawFromDeck={() => multiplayerGame.drawCard('deck')}
        drawFromDiscard={() => multiplayerGame.drawCard('discard')}
        callWin={() => multiplayerGame.callWin()}
        nextRound={() => {}} // Server handles round transitions
        resetGame={() => router.push('/')}
        playerId={multiplayerGame.playerId || undefined}
      />
    );
  }

  // If in a room but game hasn't started (Lobby)
  if (multiplayerGame.roomCode && multiplayerGame.gameState?.roundPhase === 'waiting') {
    const isHost = multiplayerGame.players[0]?.id === multiplayerGame.playerId;
    
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 w-full max-w-md text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Game Lobby</h2>
          <div className="bg-white/5 rounded-2xl py-4 mb-6">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Room Code</p>
            <p className="text-5xl font-black text-amber-400 tracking-widest">{multiplayerGame.roomCode}</p>
          </div>
          
          <div className="space-y-3 mb-8">
            <p className="text-white font-medium">Players Joined ({multiplayerGame.players.length}/6)</p>
            <div className="flex flex-wrap justify-center gap-2">
              {multiplayerGame.players.map(p => (
                <div key={p.id} className="px-4 py-2 bg-white/10 rounded-full text-white border border-white/10 flex items-center gap-2">
                  {p.name} {p.isHost && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">HOST</span>}
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={multiplayerGame.startGame}
              disabled={multiplayerGame.players.length < 2}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              Start Game 🚀
            </button>
          ) : (
            <p className="text-gray-400 animate-pulse">Waiting for host to start...</p>
          )}
          
          {multiplayerGame.error && <p className="mt-4 text-rose-400 text-sm">{multiplayerGame.error}</p>}
        </div>
      </div>
    );
  }

  // If not joined yet or missing name
  return (
    <SetupScreen
      onCreateRoom={handleCreate}
      onJoinRoom={handleJoin}
      isConnected={multiplayerGame.isConnected}
    />
  );
}
