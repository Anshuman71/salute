import { Elysia } from 'elysia';
import { handleMessage, handleClose } from './ws/handlers';
import { cleanupRateLimits } from './ws/rateLimit';
import { cleanupRooms } from './ws/rooms';
import { db } from './db';

const PORT = process.env.PORT || 3001;

interface WSData {
  ip: string;
}

const app = new Elysia()
  .get('/', () => ({ status: 'ok', message: 'Salute Game Server' }))
  .get('/health', () => ({ status: 'healthy', timestamp: new Date().toISOString() }))
  .ws('/ws', {
    open(ws: any) {
      const playerId = ws.data.query.playerId;
      const ip = ws.remoteAddress || 'unknown';
      ws.data.ip = ip;
      ws.data.playerId = playerId;
      console.log(`[WS] Connected: ${playerId} from ${ip}`);
    },
    message(ws, message) {
      handleMessage(ws as any, message);
    },
    close(ws: any) {
      handleClose(ws as any);
      console.log(`[WS] Disconnected: ${ws.data.playerId}`);
    },
  })
  .listen(PORT);

console.log(`🃏 Salute Server running on port ${PORT}`);
console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
console.log(`   Health:    http://localhost:${PORT}/health`);

// Cleanup rate limits every hour
const hour = 60 * 60 * 1000;
const day = 24 * hour;

setInterval(cleanupRateLimits, hour);

setInterval(cleanupRooms, day);

process.on("SIGTERM", () => {
  console.log("Received SIGTERM");
  db.$client.close();
  process.exit(0);
});

export type App = typeof app;

