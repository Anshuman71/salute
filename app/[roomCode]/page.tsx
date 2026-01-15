"use client";

import { use } from "react";
import { useMultiplayer } from "../game/useMultiplayer";
import GameBoard from "../components/GameBoard";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.roomCode.toUpperCase();
  const router = useRouter();

  const [playerName, setPlayerName] = useLocalStorage<string>(
    "salute_player_name",
    ""
  );
  const multiplayerGame = useMultiplayer(roomCode);

  const handleSetIdentity = () => {
    if (!playerName.trim()) return;
    setPlayerName(playerName);
    if (multiplayerGame.isConnected) {
      multiplayerGame.joinRoom(roomCode, playerName);
    }
  };

  const isHost =
    multiplayerGame.players.find((p) => p.id === multiplayerGame.playerId)
      ?.isHost ?? false;

  // 1. Game Active? -> GameBoard
  if (
    multiplayerGame.gameState &&
    multiplayerGame.gameState.roundPhase !== "waiting"
  ) {
    return (
      <GameBoard
        state={multiplayerGame.gameState}
        playCards={multiplayerGame.playCards}
        drawFromDeck={() => multiplayerGame.drawCard("deck")}
        drawFromDiscard={() => multiplayerGame.drawCard("discard")}
        callWin={() => multiplayerGame.callWin()}
        nextRound={() => multiplayerGame.nextRound()}
        resetGame={() => router.push("/")}
        playerId={multiplayerGame.playerId || undefined}
      />
    );
  }

  // 2. 404? -> Error View
  if (
    multiplayerGame.error &&
    multiplayerGame.error.toLowerCase().includes("not found")
  ) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 w-full max-w-md text-center">
          <h2 className="text-3xl font-bold text-rose-400 mb-4">
            Room Not Found
          </h2>
          <p className="text-gray-300 mb-6">
            The room code{" "}
            <span className="font-mono bg-white/10 px-2 py-1 rounded">
              {roomCode}
            </span>{" "}
            is invalid or has expired.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-all"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // 3. No Name? -> Name Input View
  if (!multiplayerGame.players.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">
              Enter Your Name
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-white font-medium mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  onKeyDown={(e) => e.key === "Enter" && handleSetIdentity()}
                />
              </div>
              <button
                onClick={handleSetIdentity}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 text-white font-bold text-xl shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                Join Room 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Lobby? -> Lobby View
  // We are waiting for connection or joined state
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 w-full max-w-md text-center">
        {!multiplayerGame.isConnected ? (
          <p className="text-white animate-pulse">Connecting to server...</p>
        ) : !multiplayerGame.playerId ? (
          <p className="text-white animate-pulse">Joining room...</p>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-white mb-2">Game Lobby</h2>
            <div className="bg-white/5 rounded-2xl py-4 mb-6">
              <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">
                Room Code
              </p>
              <p className="text-5xl font-black text-amber-400 tracking-widest">
                {roomCode}
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <p className="text-white font-medium">
                Players Joined ({multiplayerGame.players.length}/6)
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {multiplayerGame.players.map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-2 bg-white/10 rounded-full text-white border border-white/10 flex items-center gap-2"
                  >
                    {p.name}{" "}
                    {p.isHost && (
                      <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">
                        HOST
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Settings (Host Editable, Joiner Read-only) */}
            <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-white font-bold mb-4">Game Settings</h3>
              <div>
                <div className="flex justify-between text-gray-300 mb-2">
                  <span>Initial Cards (Rounds)</span>
                  <span className="font-mono bg-white/10 px-2 rounded">
                    {multiplayerGame.gameState?.settings?.totalRounds || 5}
                  </span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={3}
                    max={12}
                    value={
                      multiplayerGame.gameState?.settings?.totalRounds || 5
                    }
                    onChange={(e) =>
                      multiplayerGame.updateSettings({
                        ...multiplayerGame.gameState?.settings,
                        totalRounds: Number(e.target.value),
                        maxPlayers: 6,
                      })
                    }
                    className="w-full accent-pink-500"
                  />
                ) : (
                  <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                    <div
                      className="h-full bg-pink-500/50"
                      style={{
                        width: `${
                          (((multiplayerGame.gameState?.settings?.totalRounds ||
                            5) -
                            3) /
                            (12 - 3)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={multiplayerGame.startGame}
                disabled={multiplayerGame.players.length < 2}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {multiplayerGame.players.length < 2
                  ? "Waiting for Players..."
                  : "Start Game 🚀"}
              </button>
            ) : (
              <div className="py-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-gray-400 animate-pulse">
                  Waiting for host to start...
                </p>
              </div>
            )}

            {multiplayerGame.error && (
              <p className="mt-4 text-rose-400 text-sm">
                {multiplayerGame.error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
