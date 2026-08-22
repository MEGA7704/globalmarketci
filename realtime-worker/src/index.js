import { DurableObject } from "cloudflare:workers";

export class RealtimeHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch {}
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/connect') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('WebSocket requis', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const room = request.headers.get('X-Room') || 'global';
      server.serializeAttachment({ room, connectedAt: Date.now() });
      this.ctx.acceptWebSocket(server, [room]);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/publish' && request.method === 'POST') {
      const room = request.headers.get('X-Room') || 'global';
      const payload = await request.text();
      const sockets = this.ctx.getWebSockets(room);
      let delivered = 0;
      for (const ws of sockets) {
        try { ws.send(payload); delivered += 1; } catch {}
      }
      return Response.json({ ok: true, room, delivered });
    }
    if (url.pathname === '/health') return Response.json({ ok: true, sockets: this.ctx.getWebSockets().length });
    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws, message) {
    if (String(message) === 'ping') { try { ws.send('pong'); } catch {} }
  }
  async webSocketClose(ws, code, reason) { try { ws.close(code, reason); } catch {} }
  async webSocketError(ws) { try { ws.close(1011, 'WebSocket error'); } catch {} }
}

export default { fetch() { return new Response('GLOBAL MARKET realtime worker', { status: 200 }); } };
