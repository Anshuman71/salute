import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, ClientMessage, ServerMessage, RoomSettings } from './types';
import { useRouter } from 'next/navigation';
import { usePlayerId } from './usePlayerId';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useMultiplayer(initialRoomCode?: string) {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(initialRoomCode || null);
  const playerId = usePlayerId();
  const [players, setPlayers] = useState<{ id: string; name: string; isHost: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for tracking connection state to avoid stale closures
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      const url = new URL(WS_URL);
      url.searchParams.set('playerId', playerId);
      ws = new WebSocket(url.toString());
      socketRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connected with playerId: ${playerId}`);
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        console.log('Message age:', Date.now() - message.timestamp);

        switch (message.type) {
          case 'room_created':
            setRoomCode(message.roomCode);
            setPlayers(message.players);
            router.push(`/${message.roomCode}`);
            break;
          case 'room_joined':
            setRoomCode(message.roomCode);
            setPlayers(message.players);
            if (window.location.pathname !== `/${message.roomCode}`) {
              router.push(`/${message.roomCode}`);
            }
            break;
          case 'player_joined':
            setPlayers((prev) => [...prev, { ...message.player, isHost: false }]);
            break;
          case 'player_left':
            setPlayers((prev) => prev.filter((p) => p.id !== message.playerId));
            break;
          case 'game_state':
            setGameState(message.state);
            setPlayers(message.state.players.map((p, idx) => ({
              id: p.id,
              name: p.name,
              isHost: idx === 0
            })));
            break;
          case 'room_updated':
            // Update local game state settings if waiting
            if (gameState && gameState.roundPhase === 'waiting') {
              setGameState({ ...gameState, settings: message.settings, totalRounds: message.settings.totalRounds });
            }
            break;
          case 'error':
            console.warn('[WS] Error from server:', message.message);
            setError(message.message);
            break;
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from server, attempting reconnect in 3s...');
        setIsConnected(false);
        // Auto reconnect
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (e) => {
        console.log('[WS] Connection error:', e);
        // Don't set error state immediately on connection error during reconnect
        // setError('Connection error. Is the server running?');
      };
    };

    if (playerId) {
      connect();
    }

    return () => {
      if (ws) { ws.close(); }
      clearTimeout(reconnectTimer);
    };
  }, [playerId]);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      setError('Not connected to server');
    }
  }, []);

  const createRoom = useCallback((playerName: string, settings?: RoomSettings) => {
    // Default settings if not provided
    const finalSettings = settings || { totalRounds: 5, maxPlayers: 6 };
    send({ type: 'create_room', playerName, settings: finalSettings, playerId, roomCode });
  }, [send, playerId, roomCode]);

  const updateSettings = useCallback((settings: RoomSettings) => {
    send({ type: 'update_settings', settings, playerId, roomCode });
  }, [send, playerId, roomCode]);

  const joinRoom = useCallback((code: string, playerName: string) => {
    send({ type: 'join_room', code, playerName, playerId, roomCode });
  }, [send, playerId, roomCode]);

  const startGame = useCallback(() => {
    send({ type: 'start_game', roomCode: roomCode!, playerId });
  }, [send, playerId, roomCode]);

  const playCards = useCallback((cardIds: string[]) => {
    send({ type: 'play_cards', cardIds, playerId, roomCode });
  }, [send, playerId, roomCode]);

  const drawCard = useCallback((source: 'deck' | 'discard') => {
    send({ type: 'draw_card', source, playerId, roomCode });
  }, [send, playerId, roomCode]);

  const callWin = useCallback(() => {
    send({ type: 'call_win', playerId, roomCode });
  }, [send, playerId, roomCode]);

  const nextRound = useCallback(() => {
    send({ type: 'next_round', playerId, roomCode });
  }, [send, playerId, roomCode]);

  return {
    gameState,
    roomCode,
    playerId,
    players,
    error,
    isConnected,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    playCards,
    drawCard,
    callWin,
    nextRound,
  };
}
