import { useEffect, useRef } from 'react';
import { normalizeBasePath } from '../utils/basePath';

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_FALLBACK_POLL_MS = 60_000;
const MAX_RECONNECT_MS = 30_000;

export interface WebSocketEvent {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  path: string | null;
  onEvent: (event: WebSocketEvent) => void;
  onFallbackPoll?: () => void;
  heartbeatMs?: number;
  fallbackPollMs?: number;
}

function normalizeWebSocketBaseUrl(baseUrl: string | undefined): string | null {
  const value = baseUrl?.trim();
  if (!value) return null;
  const websocketUrl = value
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://');
  return websocketUrl.endsWith('/') ? websocketUrl : `${websocketUrl}/`;
}

export function buildWebSocketUrl(
  path: string,
  location: Pick<Location, 'protocol' | 'host'> = window.location,
  basePath = import.meta.env.BASE_URL,
  websocketBaseUrl = import.meta.env.VITE_WS_BASE_URL,
): string {
  const relativePath = path.replace(/^\//, '');
  const overrideBaseUrl = normalizeWebSocketBaseUrl(websocketBaseUrl);
  if (overrideBaseUrl) {
    return `${overrideBaseUrl}${relativePath}`;
  }
  // Connect through the page's own origin. In local development the Vite dev
  // server proxies `/ws` (with WebSocket upgrades) to the backend, so the
  // socket stays same-origin and the session cookie is always sent - targeting
  // the backend port directly breaks when the page is opened on a different
  // host alias (`localhost` vs `127.0.0.1`) or over the LAN.
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${normalizeBasePath(basePath)}${relativePath}`;
}

export function reconnectDelay(attempt: number): number {
  return Math.min(1_000 * (2 ** Math.max(0, attempt)), MAX_RECONNECT_MS);
}

/**
 * Maintains one resilient socket and degrades to low-frequency polling while
 * the real-time service is unavailable. Message callbacks never recreate it.
 */
export function useWebSocket({
  path,
  onEvent,
  onFallbackPoll,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  fallbackPollMs = DEFAULT_FALLBACK_POLL_MS,
}: UseWebSocketOptions): void {
  const eventRef = useRef(onEvent);
  const fallbackRef = useRef(onFallbackPoll);
  useEffect(() => {
    eventRef.current = onEvent;
    fallbackRef.current = onFallbackPoll;
  }, [onEvent, onFallbackPoll]);

  useEffect(() => {
    if (!path) return undefined;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let heartbeatTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let attempt = 0;
    let disposed = false;

    const clearTimer = (timer: number | null): void => {
      if (timer !== null) window.clearInterval(timer);
    };
    const startFallback = (): void => {
      if (fallbackTimer !== null || !fallbackRef.current) return;
      fallbackTimer = window.setInterval(() => fallbackRef.current?.(), fallbackPollMs);
    };
    const connect = (): void => {
      if (disposed || (socket && socket.readyState <= WebSocket.OPEN)) return;
      socket = new WebSocket(buildWebSocketUrl(path));
      socket.onopen = () => {
        attempt = 0;
        clearTimer(fallbackTimer);
        fallbackTimer = null;
        heartbeatTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, heartbeatMs);
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as WebSocketEvent;
          if (event.type !== 'pong') eventRef.current(event);
        } catch {
          // Malformed notifications are ignored; REST remains authoritative.
        }
      };
      socket.onclose = () => {
        clearTimer(heartbeatTimer);
        heartbeatTimer = null;
        socket = null;
        if (disposed) return;
        startFallback();
        reconnectTimer = window.setTimeout(connect, reconnectDelay(attempt));
        attempt += 1;
      };
      socket.onerror = () => socket?.close();
    };

    startFallback();
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      clearTimer(heartbeatTimer);
      clearTimer(fallbackTimer);
      socket?.close();
      socket = null;
    };
  }, [fallbackPollMs, heartbeatMs, path]);
}
