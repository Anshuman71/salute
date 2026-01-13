import type { ServerWebSocket } from 'bun';
import type { ClientMessage, ServerMessage } from '../game/types';
import { generateRoomCode } from '../game/logic';
import { checkRateLimit } from './rateLimit';
import {
  createRoom,
  joinRoom,
  startGame,
  playCards,
  drawCard,
  callWin,
  nextRound,
  getRoom,
  removePlayer,
  addConnection,
  getConnections,
  getSanitizedStateForPlayer,
} from './rooms';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

interface WSData {
  sessionId: string;
  ip: string;
  roomCode?: string;
  playerId?: string;
}

export function handleMessage(ws: ServerWebSocket<WSData>, message: string): void {
  let parsed: ClientMessage;
  
  try {
    parsed = JSON.parse(message);
  } catch {
    sendError(ws, 'Invalid JSON');
    return;
  }
  
  const { sessionId, ip } = ws.data;
  
  switch (parsed.type) {
    case 'create_room': {
      const rateCheck = checkRateLimit(ip, 'create_room');
      if (!rateCheck.allowed) {
        sendError(ws, `Rate limited. Try again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 60000)} minutes.`);
        return;
      }
      
      const roomCode = generateRoomCode();
      const result = createRoom(roomCode, parsed.playerName, sessionId, parsed.settings);
      
      // Save to DB
      db.insert(schema.rooms).values({
        code: roomCode,
        hostIp: ip,
        status: 'waiting',
        settings: JSON.stringify(parsed.settings),
        createdAt: new Date(),
      }).run();
      
      ws.data.roomCode = roomCode;
      ws.data.playerId = result.playerId;
      addConnection(roomCode, sessionId, ws, result.playerId);
      
      send(ws, { type: 'room_created', roomCode, playerId: result.playerId });
      break;
    }
    
    case 'join_room': {
      const rateCheck = checkRateLimit(ip, 'join_room');
      if (!rateCheck.allowed) {
        sendError(ws, `Rate limited. Try again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} seconds.`);
        return;
      }
      
      const result = joinRoom(parsed.code.toUpperCase(), parsed.playerName, sessionId);
      if (!result) {
        sendError(ws, 'Room not found or game already started');
        return;
      }
      
      ws.data.roomCode = parsed.code.toUpperCase();
      ws.data.playerId = result.playerId;
      addConnection(parsed.code.toUpperCase(), sessionId, ws, result.playerId);
      
      // Send join confirmation to new player
      send(ws, {
        type: 'room_joined',
        roomCode: parsed.code.toUpperCase(),
        playerId: result.playerId,
        players: result.state.players.map(p => ({ id: p.id, name: p.name, isHost: result.state.players.indexOf(p) === 0 })),
      });
      
      // Notify other players
      broadcastToRoom(parsed.code.toUpperCase(), sessionId, {
        type: 'player_joined',
        player: { id: result.playerId, name: parsed.playerName },
      });
      break;
    }
    
    case 'start_game': {
      const { roomCode } = ws.data;
      if (!roomCode) {
        sendError(ws, 'Not in a room');
        return;
      }
      
      const state = startGame(roomCode, sessionId);
      if (!state) {
        sendError(ws, 'Cannot start game');
        return;
      }
      
      // Update DB
      db.update(schema.rooms)
        .set({ status: 'playing' })
        .where(eq(schema.rooms.code, roomCode))
        .run();
      
      // Broadcast to all players
      broadcastGameState(roomCode);
      break;
    }
    
    case 'play_cards': {
      const { roomCode, playerId } = ws.data;
      if (!roomCode || !playerId) {
        sendError(ws, 'Not in a game');
        return;
      }
      
      const result = playCards(roomCode, sessionId, parsed.cardIds);
      if ('error' in result) {
        sendError(ws, result.error);
        return;
      }
      
      broadcastGameState(roomCode);
      break;
    }
    
    case 'draw_card': {
      const { roomCode, playerId } = ws.data;
      if (!roomCode || !playerId) {
        sendError(ws, 'Not in a game');
        return;
      }
      
      const result = drawCard(roomCode, sessionId, parsed.source);
      if ('error' in result) {
        sendError(ws, result.error);
        return;
      }
      
      broadcastGameState(roomCode);
      break;
    }
    
    case 'call_win': {
      const { roomCode, playerId } = ws.data;
      if (!roomCode || !playerId) {
        sendError(ws, 'Not in a game');
        return;
      }
      
      const result = callWin(roomCode, sessionId);
      if ('error' in result) {
        sendError(ws, result.error);
        return;
      }
      
      broadcastGameState(roomCode);
      
      // If game ended, handle next round after delay
      if (result.roundPhase === 'scoring') {
        setTimeout(() => {
          const nextResult = nextRound(roomCode);
          if (nextResult && !('error' in nextResult)) {
            broadcastGameState(roomCode);
          }
        }, 3000); // 3 second delay before next round
      }
      break;
    }
    
    case 'leave_room': {
      const { roomCode } = ws.data;
      if (roomCode) {
        removePlayer(roomCode, sessionId);
        broadcastToRoom(roomCode, sessionId, {
          type: 'player_left',
          playerId: ws.data.playerId || '',
        });
      }
      ws.data.roomCode = undefined;
      ws.data.playerId = undefined;
      break;
    }
  }
}

export function handleClose(ws: ServerWebSocket<WSData>): void {
  const { roomCode, sessionId } = ws.data;
  if (roomCode) {
    removePlayer(roomCode, sessionId);
    broadcastToRoom(roomCode, sessionId, {
      type: 'player_left',
      playerId: ws.data.playerId || '',
    });
  }
}

function send(ws: ServerWebSocket<WSData>, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

function sendError(ws: ServerWebSocket<WSData>, message: string): void {
  send(ws, { type: 'error', message });
}

function broadcastToRoom(roomCode: string, excludeSessionId: string, message: ServerMessage): void {
  const connections = getConnections(roomCode);
  if (!connections) return;
  
  const msgStr = JSON.stringify(message);
  for (const [sid, { ws }] of connections) {
    if (sid !== excludeSessionId) {
      (ws as ServerWebSocket<WSData>).send(msgStr);
    }
  }
}

function broadcastGameState(roomCode: string): void {
  const state = getRoom(roomCode);
  const connections = getConnections(roomCode);
  if (!state || !connections) return;
  
  for (const [, { ws, playerId }] of connections) {
    const sanitized = getSanitizedStateForPlayer(state, playerId);
    (ws as ServerWebSocket<WSData>).send(JSON.stringify({ type: 'game_state', state: sanitized }));
  }
}
