/**
 * Minimal Neon wsproxy for LOCAL DEVELOPMENT ONLY.
 *
 * `@neondatabase/serverless` (used by Auth.js) can only speak WebSocket, so it
 * cannot reach a plain local Postgres. This script bridges that gap: it accepts
 * the driver's WebSocket connection and pipes the raw Postgres wire protocol to
 * a local TCP Postgres — the same job as Neon's `wsproxy` service.
 *
 * Usage:
 *   bun scripts/dev/neon-wsproxy.ts            # listens on :5434
 *   WSPROXY_PORT=6000 bun scripts/dev/neon-wsproxy.ts
 *
 * Then set in .env.local:
 *   NEON_LOCAL_WSPROXY=localhost:5434
 *
 * The target Postgres is taken from the `?address=host:port` query param that
 * the neon driver appends (see neonConfig.wsProxy in auth.ts).
 * Never run this in production.
 */

import net from "net";

const PORT = Number(process.env.WSPROXY_PORT ?? 5434);

interface ProxyData {
  socket: net.Socket | null;
  address: string;
}

interface ProxyWebSocket {
  data: ProxyData;
  send(data: Buffer | string): void;
  close(): void;
}

// `Bun` is provided by the Bun runtime; this script is excluded from the
// Next.js build and only ever runs via `bun scripts/dev/neon-wsproxy.ts`.
declare const Bun: {
  serve(options: {
    port: number;
    fetch(req: Request, server: { upgrade(req: Request, opts: { data: ProxyData }): boolean }): Response | undefined;
    websocket: {
      open(ws: ProxyWebSocket): void;
      message(ws: ProxyWebSocket, message: string | Uint8Array): void;
      close(ws: ProxyWebSocket): void;
    };
  }): unknown;
};

Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    const address = url.searchParams.get("address") ?? "127.0.0.1:5432";
    if (server.upgrade(req, { data: { socket: null, address } })) return undefined;
    return new Response("wsproxy: WebSocket upgrade required", { status: 400 });
  },
  websocket: {
    open(ws) {
      const [host, port] = ws.data.address.split(":");
      const socket = net.connect(Number(port ?? 5432), host, () => {
        console.log(`[wsproxy] connected → ${ws.data.address}`);
      });
      socket.on("data", (chunk) => ws.send(chunk));
      socket.on("close", () => ws.close());
      socket.on("error", (err) => {
        console.error(`[wsproxy] tcp error: ${err.message}`);
        ws.close();
      });
      ws.data.socket = socket;
    },
    message(ws, message) {
      const buf =
        typeof message === "string" ? Buffer.from(message) : Buffer.from(message);
      ws.data.socket?.write(buf);
    },
    close(ws) {
      ws.data.socket?.destroy();
    },
  },
});

console.log(`[wsproxy] listening on ws://localhost:${PORT}/v1`);
