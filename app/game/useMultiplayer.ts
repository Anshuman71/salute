import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, ClientMessage, ServerMessage, RoomSettings } from './types';
import { useRouter } from 'next/navigation';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useMultiplayer(initialRoomCode?: string) {
  const router = useRouter();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(initialRoomCode || null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<{ id: string; name: string; isHost: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for tracking connection state to avoid stale closures
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Persistent sessionId
    let sid = localStorage.getItem('salute_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem('salute_session_id', sid);
    }

    const wsUrl = `${WS_URL}?sessionId=${sid}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected with sessionId: ${sid}`);
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      console.log('Received message:', message);

      switch (message.type) {
        case 'room_created':
          setRoomCode(message.roomCode);
          setPlayerId(message.playerId);
          setPlayers(message.players);
          router.push(`/${message.roomCode}`);
          break;
        case 'room_joined':
          setRoomCode(message.roomCode);
          setPlayerId(message.playerId);
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
        case 'error':
          console.warn('[WS] Error from server:', message.message);
          setError(message.message);
          break;
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setSocket(null);
    };

    ws.onerror = (e) => {
      console.error('[WS] Connection error:', e);
      setError('Connection error. Is the server running?');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      setError('Not connected to server');
    }
  }, []);

  const createRoom = useCallback((playerName: string, settings: RoomSettings) => {
    send({ type: 'create_room', playerName, settings });
  }, [send]);

  const joinRoom = useCallback((code: string, playerName: string) => {
    send({ type: 'join_room', code, playerName });
  }, [send]);

  const startGame = useCallback(() => {
    send({ type: 'start_game' });
  }, [send]);

  const playCards = useCallback((cardIds: string[]) => {
    send({ type: 'play_cards', cardIds });
  }, [send]);

  const drawCard = useCallback((source: 'deck' | 'discard') => {
    send({ type: 'draw_card', source });
  }, [send]);

  const callWin = useCallback(() => {
    send({ type: 'call_win' });
  }, [send]);

  return {
    gameState,
    roomCode,
    playerId,
    players,
    error,
    isConnected,
    createRoom,
    joinRoom,
    startGame,
    playCards,
    drawCard,
    callWin,
  };
}
