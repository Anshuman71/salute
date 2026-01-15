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
  updateRoomSettings,
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
      console.error(`[WS] Invalid JSON from ${ws.data.playerId}:`, message);
      sendError(ws, 'Invalid JSON');
      return;
    }
  }

  const { ip } = ws.data;
  const { playerId, roomCode, } = parsed;

  console.log(`[WS] Message from ${playerId} (${roomCode || 'no room'}):`, parsed.type);

  try {

    switch (parsed.type) {
      case 'create_room': {
        console.log(`[Room] create_room hit for session ${playerId}`);
        const rateCheck = checkRateLimit(ip, 'create_room');
        if (!rateCheck.allowed) {
          sendError(ws, `Rate limited. Try again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 60000)} minutes.`);
          return;
        }

        if (!playerId) {
          sendError(ws, 'Invalid player ID');
          return;
        }

        const roomCode = generateRoomCode();
        // Use provided settings or defaults
        const settings = parsed.settings || { totalRounds: 5, maxPlayers: 6 };
        // Use provided name or default "Host"
        const playerName = parsed.playerName || 'Host';

        const result = createRoom(roomCode, playerName, playerId, settings);

        console.log(`[Room] Logic created room ${roomCode}, saving to DB...`);

        // Save to DB
        try {
          const dbRoom = db.insert(schema.rooms).values({
            code: roomCode,
            hostIp: ip,
            status: 'waiting',
            settings: JSON.stringify(settings),
            gameState: JSON.stringify(result.state),
            createdAt: new Date(),
          }).returning({ id: schema.rooms.id }).get();

          if (dbRoom) {
            db.insert(schema.roomPlayers).values({
              roomId: dbRoom.id,
              name: parsed.playerName,
              playerId,
              isHost: true,
            }).run();
          }
        } catch (dbErr) {
          console.error(`[DB] Error creating room/player:`, dbErr);
          // We continue anyway so the game works in-memory
        }

        ws.data.roomCode = roomCode;
        addConnection(roomCode, playerId, ws);

        console.log(`[Room] Created ${roomCode} by ${parsed.playerName} (${playerId}). Sending response.`);

        send(ws, {
          type: 'room_created',
          roomCode,
          playerId,
          players: [{ id: playerId, name: parsed.playerName, isHost: true }]
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

        if (!playerId || !roomCode) {
          sendError(ws, 'Invalid payload');
          return;
        }

        const result = joinRoom(roomCode, parsed.playerName, playerId);

        if (!result) {
          console.warn(`[Room] Join failed for ${roomCode}: Room not found or in-progress`);
          sendError(ws, 'Room not found or game already started');
          return;
        }

        ws.data.roomCode = roomCode;
        addConnection(roomCode, playerId, ws);

        console.log(`[Room] ${parsed.playerName} joined ${roomCode} (${playerId})`);

        // Save player to DB
        try {
          const dbRoom = db.select().from(schema.rooms).where(eq(schema.rooms.code, parsed.code.toUpperCase())).get();
          if (dbRoom) {
            db.insert(schema.roomPlayers).values({
              roomId: dbRoom.id,
              name: parsed.playerName,
              playerId,
              isHost: false,
            }).onConflictDoUpdate({ target: schema.roomPlayers.playerId, set: { name: parsed.playerName } }).run();
          }
        } catch (dbErr) {
          console.error(`[DB] Error saving player join:`, dbErr);
        }

        // Send join confirmation to new player
        send(ws, {
          type: 'room_joined',
          roomCode,
          playerId,
          players: result.state.players.map(p => ({ id: p.id, name: p.name, isHost: playerId === result.state.hostPlayerId })),
          settings: result.state.settings,
        });

        // Notify other players
        broadcastToRoom(roomCode, playerId, {
          type: 'player_joined',
          player: { id: result.playerId, name: parsed.playerName },
        });

        broadcastGameState(roomCode);
        break;
      }

      case 'start_game': {
        if (!roomCode || !playerId) {
          sendError(ws, 'Not in a room');
          return;
        }

        const state = startGame(roomCode, playerId);
        console.log(`[Room] ${playerId} started game in ${roomCode}`);
        if (!state) {
          sendError(ws, 'Cannot start game');
          return;
        }

        // Broadcast to all players
        broadcastGameState(roomCode);
        break;
      }

      case 'play_cards': {
        if (!roomCode || !playerId) {
          sendError(ws, 'Not in a game');
          return;
        }

        const result = playCards(roomCode, playerId, parsed.cardIds);
        if ('error' in result) {
          sendError(ws, result.error);
          return;
        }

        broadcastGameState(roomCode);
        break;
      }

      case 'draw_card': {
        if (!roomCode || !playerId) {
          sendError(ws, 'Not in a game');
          return;
        }

        const result = drawCard(roomCode, playerId, parsed.source);
        if ('error' in result) {
          sendError(ws, result.error);
          return;
        }

        broadcastGameState(roomCode);
        break;
      }

      case 'call_win': {
        if (!roomCode || !playerId) {
          sendError(ws, 'Not in a game');
          return;
        }

        const result = callWin(roomCode, playerId);
        if ('error' in result) {
          sendError(ws, result.error);
          return;
        }

        broadcastGameState(roomCode);
        break;
      }

      case 'update_settings': {
        if (!roomCode) {
          sendError(ws, 'Not in a room');
          return;
        }

        const result = updateRoomSettings(roomCode, playerId, parsed.settings);
        if ('error' in result) {
          sendError(ws, result.error);
          return;
        }

        broadcastGameState(result.roomCode)
        break;
      }

      case 'leave_room': {
        if (roomCode) {
          removePlayer(roomCode, playerId);
          broadcastToRoom(roomCode, playerId, {
            type: 'player_left',
            playerId: ws.data.playerId || '',
          });
        }
        ws.data.roomCode = undefined;
        ws.data.playerId = undefined;
        break;
      }

      case 'next_round': {
        if (!roomCode || !playerId) {
          sendError(ws, 'Not in a game');
          return;
        }

        const state = getRoom(roomCode)

        if (!state) {
          sendError(ws, 'Room not found');
          return;
        }

        if (state.roundPhase === 'scoring') {
          const nextResult = nextRound(roomCode);
          if (nextResult && !('error' in nextResult)) {
            broadcastGameState(roomCode);
          }
        }
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

function broadcastToRoom(roomCode: string, excludePlayerId: string, message: ServerMessage): void {
  const connections = getConnections(roomCode);
  if (!connections) return;

  const msgStr = JSON.stringify(message);
  for (const [sid, { ws }] of connections) {
    if (sid !== excludePlayerId) {
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
    console.log(`[Room] Broadcasting game state to ${playerId} in ${roomCode}`);
    (ws as ServerWebSocket<WSData>).send(JSON.stringify({ type: 'game_state', state: sanitized }));
  }
}
