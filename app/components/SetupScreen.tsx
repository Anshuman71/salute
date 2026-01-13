'use client';

import { useState } from 'react';
import { GameSettings } from '../game/types';

interface SetupScreenProps {
  onStartGame: (settings: GameSettings) => void;
}

export default function SetupScreen({ onStartGame }: SetupScreenProps) {
  const [numPlayers, setNumPlayers] = useState(2);
  const [totalRounds, setTotalRounds] = useState(5);
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '', '', '', '']);

  const handleStart = () => {
    const names = playerNames.slice(0, numPlayers).map((name, i) => name || `Player ${i + 1}`);
    onStartGame({
      numPlayers,
      totalRounds,
      playerNames: names,
    });
  };

  const updatePlayerName = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
            🃏 Salute!
          </h1>
          <p className="text-gray-400">A Card Game of Strategy & Luck</p>
        </div>

        {/* Setup Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20">
          {/* Number of Players */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">
              Number of Players
            </label>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => setNumPlayers(num)}
                  className={`
                    flex-1 py-3 rounded-xl font-bold text-lg transition-all duration-200
                    ${numPlayers === num
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'}
                  `}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Total Rounds (X) */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">
              Initial Cards (X) — from 3 to 12
            </label>
            <input
              type="range"
              min={3}
              max={12}
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>3</span>
              <span className="text-pink-400 font-bold text-xl">{totalRounds}</span>
              <span>12</span>
            </div>
            <p className="text-gray-400 text-sm mt-2 text-center">
              {((totalRounds - 2) * 2 + 1)} total rounds: {totalRounds} → 2 → {totalRounds}
            </p>
          </div>

          {/* Player Names */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">
              Player Names
            </label>
            <div className="space-y-2">
              {Array.from({ length: numPlayers }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Player ${i + 1}`}
                  value={playerNames[i]}
                  onChange={(e) => updatePlayerName(i, e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Game 🎴
          </button>
        </div>

        {/* Rules Preview */}
        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-white font-medium mb-2">Quick Rules</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• Play a card, then draw from deck or discard pile</li>
            <li>• Call "I Win" when you think you have the lowest score</li>
            <li>• 9s count as 0 points!</li>
            <li>• Lowest score wins the round</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
