import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { buildWebSocketUrl, reconnectDelay, useWebSocket } from './useWebSocket';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('builds secure, base-path-aware endpoints', () => {
    expect(buildWebSocketUrl(
      '/ws/public-crops/1/discussions/',
      { protocol: 'https:', host: 'example.test' },
      '/openfarmplanner/',
      undefined,
    )).toBe('wss://example.test/openfarmplanner/ws/public-crops/1/discussions/');
  });

  it('stays on the page origin so the Vite dev proxy handles local development', () => {
    expect(buildWebSocketUrl(
      'ws/notifications/',
      { protocol: 'http:', host: 'localhost:5173' },
      '/',
      undefined,
    )).toBe('ws://localhost:5173/ws/notifications/');
  });

  it('allows production-preview tests to target the ASGI backend directly', () => {
    expect(buildWebSocketUrl(
      'ws/notifications/',
      { protocol: 'http:', host: '127.0.0.1:4173' },
      '/',
      'http://127.0.0.1:8000',
    )).toBe('ws://127.0.0.1:8000/ws/notifications/');
  });

  it('uses bounded exponential reconnect delays', () => {
    expect(reconnectDelay(0)).toBe(1_000);
    expect(reconnectDelay(3)).toBe(8_000);
    expect(reconnectDelay(20)).toBe(30_000);
  });

  it('does not duplicate a connection and cleans up timers and sockets', () => {
    const fallbackPoll = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onEvent }) => useWebSocket({
        path: 'ws/resource/', onEvent, onFallbackPoll: fallbackPoll,
      }),
      { initialProps: { onEvent: vi.fn() } },
    );
    expect(MockWebSocket.instances).toHaveLength(1);
    rerender({ onEvent: vi.fn() });
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => MockWebSocket.instances[0]?.open());
    act(() => vi.advanceTimersByTime(60_000));
    expect(fallbackPoll).not.toHaveBeenCalled();
    unmount();
    expect(MockWebSocket.instances[0]?.readyState).toBe(MockWebSocket.CLOSED);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('polls while disconnected and reconnects after a bounded delay', () => {
    const fallbackPoll = vi.fn();
    renderHook(() => useWebSocket({
      path: 'ws/resource/', onEvent: vi.fn(), onFallbackPoll: fallbackPoll,
    }));

    act(() => MockWebSocket.instances[0]?.close());
    act(() => vi.advanceTimersByTime(1_000));
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(59_000));
    expect(fallbackPoll).toHaveBeenCalledTimes(1);
  });
});
