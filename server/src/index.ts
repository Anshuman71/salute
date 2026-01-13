import { Elysia } from 'elysia';
import { handleMessage, handleClose } from './ws/handlers';
import { cleanupRateLimits } from './ws/rateLimit';

const PORT = process.env.PORT || 3001;

interface WSData {
  sessionId: string;
  ip: string;
  roomCode?: string;
  playerId?: string;
}

const app = new Elysia()
  .get('/', () => ({ status: 'ok', message: 'Salute Game Server' }))
  .get('/health', () => ({ status: 'healthy', timestamp: new Date().toISOString() }))
  .ws('/ws', {
    open(ws) {
      const sessionId = crypto.randomUUID();
      const ip = ws.remoteAddress || 'unknown';
      
      ws.data = { sessionId, ip } as WSData;
      console.log(`[WS] Connected: ${sessionId} from ${ip}`);
    },
    message(ws, message) {
      handleMessage(ws as any, String(message));
    },
    close(ws) {
      handleClose(ws as any);
      console.log(`[WS] Disconnected: ${ws.data?.sessionId}`);
    },
  })
  .listen(PORT);

console.log(`🃏 Salute Server running on port ${PORT}`);
console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
console.log(`   Health:    http://localhost:${PORT}/health`);

// Cleanup rate limits every hour
setInterval(cleanupRateLimits, 60 * 60 * 1000);

export type App = typeof app;
