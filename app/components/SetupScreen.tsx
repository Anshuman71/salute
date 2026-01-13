'use client';

import { useState } from 'react';
import { RoomSettings } from '../game/types';

interface SetupScreenProps {
  onCreateRoom: (playerName: string, settings: RoomSettings) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onStartLocalGame?: (numPlayers: number, totalRounds: number, playerNames: string[]) => void;
  isConnected: boolean;
  error?: string | null;
}

export default function SetupScreen({ onCreateRoom, onJoinRoom, onStartLocalGame, isConnected, error }: SetupScreenProps) {
  const [mode, setMode] = useState<'menu' | 'host' | 'join' | 'local'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [totalRounds, setTotalRounds] = useState(5);
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '', '', '', '']);

  const handleCreate = () => {
    if (!playerName) return;
    onCreateRoom(playerName, { totalRounds, maxPlayers: 6 });
  };

  const handleJoin = () => {
    if (!playerName || !roomCode) return;
    onJoinRoom(roomCode.toUpperCase(), playerName);
  };

  const handleStartLocal = () => {
    const names = playerNames.slice(0, numPlayers).map((name, i) => name || `Player ${i + 1}`);
    onStartLocalGame?.(numPlayers, totalRounds, names);
  };

  const updatePlayerName = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
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
            <button
              onClick={() => setMode('local')}
              className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 font-medium text-lg transition-all"
            >
              Play Locally (Hotseat) 📱
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
            {mode === 'host' ? 'Host New Game' : mode === 'join' ? 'Join Game' : 'Local Game'}
          </h2>

          <div className="space-y-6">
            {/* Player Name */}
            {mode !== 'local' && (
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
            )}

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

            {/* Num Players (Local) */}
            {mode === 'local' && (
              <div>
                <label className="block text-white font-medium mb-2">Number of Players</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumPlayers(num)}
                      className={`flex-1 py-3 rounded-xl font-bold ${numPlayers === num ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-300'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Total Rounds */}
            {(mode === 'host' || mode === 'local') && (
              <div>
                <label className="block text-white font-medium mb-2">Initial Cards (X): {totalRounds}</label>
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>
            )}

            {/* Local Player Names */}
            {mode === 'local' && (
              <div className="space-y-2">
                <label className="block text-white font-medium mb-2">Player Names</label>
                {Array.from({ length: numPlayers }, (_, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`Player ${i + 1}`}
                    value={playerNames[i]}
                    onChange={(e) => updatePlayerName(i, e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
                  />
                ))}
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
              onClick={mode === 'host' ? handleCreate : mode === 'join' ? handleJoin : handleStartLocal}
              disabled={(mode !== 'local' && !playerName) || (mode === 'join' && !roomCode)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 text-white font-bold text-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {mode === 'host' ? 'Create Room 🏠' : mode === 'join' ? 'Join Game 🤝' : 'Start Local Game 🎴'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
