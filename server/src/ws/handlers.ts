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

export function handleMessage(ws: ServerWebSocket<WSData>, message: any): void {
  let parsed: ClientMessage;
  
  if (typeof message === 'object' && message !== null && !Buffer.isBuffer(message) && !(message instanceof Uint8Array)) {
    parsed = message;
  } else {
    try {
      const str = typeof message === 'string' ? message : Buffer.from(message).toString();
      parsed = JSON.parse(str);
    } catch {
      console.error(`[WS] Invalid JSON from ${ws.data.sessionId}:`, message);
      sendError(ws, 'Invalid JSON');
      return;
    }
  }
  
  console.log(`[WS] Message from ${ws.data.sessionId} (${ws.data.roomCode || 'no room'}):`, parsed.type);
  
  try {
    const { sessionId, ip } = ws.data;
    
    switch (parsed.type) {
      case 'create_room': {
        console.log(`[Room] create_room hit for session ${sessionId}`);
        const rateCheck = checkRateLimit(ip, 'create_room');
        if (!rateCheck.allowed) {
          sendError(ws, `Rate limited. Try again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 60000)} minutes.`);
          return;
        }
        
        const roomCode = generateRoomCode();
        const result = createRoom(roomCode, parsed.playerName, sessionId, parsed.settings);
        
        console.log(`[Room] Logic created room ${roomCode}, saving to DB...`);

        // Save to DB
        try {
          const dbRoom = db.insert(schema.rooms).values({
            code: roomCode,
            hostIp: ip,
            status: 'waiting',
            settings: JSON.stringify(parsed.settings),
            createdAt: new Date(),
          }).returning({ id: schema.rooms.id }).get();
          
          if (dbRoom) {
            db.insert(schema.players).values({
              roomId: dbRoom.id,
              name: parsed.playerName,
              sessionId: sessionId,
              isHost: true,
            }).run();
          }
        } catch (dbErr) {
          console.error(`[DB] Error creating room/player:`, dbErr);
          // We continue anyway so the game works in-memory
        }
        
        ws.data.roomCode = roomCode;
        ws.data.playerId = result.playerId;
        addConnection(roomCode, sessionId, ws, result.playerId);
        
        console.log(`[Room] Created ${roomCode} by ${parsed.playerName} (${sessionId}). Sending response.`);
        
        send(ws, { 
          type: 'room_created', 
          roomCode, 
          playerId: result.playerId,
          players: [{ id: result.playerId, name: parsed.playerName, isHost: true }]
        });
        broadcastGameState(roomCode);
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
          console.warn(`[Room] Join failed for ${parsed.code.toUpperCase()}: Room not found or in-progress`);
          sendError(ws, 'Room not found or game already started');
          return;
        }
        
        ws.data.roomCode = parsed.code.toUpperCase();
        ws.data.playerId = result.playerId;
        addConnection(parsed.code.toUpperCase(), sessionId, ws, result.playerId);

        console.log(`[Room] ${parsed.playerName} joined ${parsed.code.toUpperCase()} (${sessionId})`);

        // Save player to DB
        try {
          const dbRoom = db.select().from(schema.rooms).where(eq(schema.rooms.code, parsed.code.toUpperCase())).get();
          if (dbRoom) {
            db.insert(schema.players).values({
              roomId: dbRoom.id,
              name: parsed.playerName,
              sessionId: sessionId,
              isHost: false,
            }).run();
          }
        } catch (dbErr) {
          console.error(`[DB] Error saving player join:`, dbErr);
        }
        
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
  } catch (err) {
    console.error(`[WS] Unexpected error handling ${parsed.type}:`, err);
    sendError(ws, 'Internal server error');
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
  console.warn(`[WS] Sending error to ${ws.data.sessionId}: ${message}`);
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
