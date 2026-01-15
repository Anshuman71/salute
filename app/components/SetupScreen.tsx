'use client';

import { useState } from 'react';
import { useLocalStorage } from "usehooks-ts";
import { RoomSettings } from '../game/types';

interface SetupScreenProps {
  onCreateRoom: (playerName: string, settings: RoomSettings) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  isConnected: boolean;
  error?: string | null;
}

export default function SetupScreen({ onCreateRoom, onJoinRoom, isConnected, error }: SetupScreenProps) {
  const [mode, setMode] = useState<'menu' | 'host' | 'join'>('menu');
  const [playerName, setPlayerName] = useLocalStorage('salute_player_name', '');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (!playerName) return;
    // Server uses defaults, host configures later
    onCreateRoom(playerName, { totalRounds: 5, maxPlayers: 6 }); 
  };

  const handleJoin = () => {
    if (!playerName || !roomCode) return;
    onJoinRoom(roomCode.toUpperCase(), playerName);
  };

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-6xl font-black bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
              Salute!
            </h1>
            <p className="text-gray-400">Multiplayer Card Game</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode('host')}
              disabled={!isConnected}
              className="w-full py-6 rounded-3xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-2xl transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              Host Game 🏠
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!isConnected}
              className="w-full py-6 rounded-3xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-2xl transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              Join Game 🤝
            </button>
            {!isConnected && (
              <p className="text-rose-400 text-center text-sm font-medium animate-pulse">
                Offline: Could not connect to server
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => setMode('menu')}
          className="mb-6 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          ← Back to Menu
        </button>

        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">
            {mode === 'host' ? 'Host New Game' : 'Join Game'}
          </h2>

          <div className="space-y-6">
            {/* Player Name */}
            <div>
              <label className="block text-white font-medium mb-2">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              />
            </div>

            {/* Room Code */}
            {mode === 'join' && (
              <div>
                <label className="block text-white font-medium mb-2">Room Code</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 tracking-widest text-center font-bold text-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="text-rose-400 text-center text-sm font-medium animate-pulse">
                {error}
              </p>
            )}

            {/* Action Button */}
            <button
              onClick={mode === 'host' ? handleCreate : handleJoin}
              disabled={!playerName || (mode === 'join' && !roomCode)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 text-white font-bold text-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {mode === 'host' ? 'Create Room 🏠' : 'Join Game 🤝'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
