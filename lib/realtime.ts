/**
 * Hardens the SDK realtime client against socket drops. The installed
 * @recursiv/sdk RealtimeClient has three defects that make a dropped
 * WebSocket unrecoverable (network blip, laptop sleep, mobile backgrounding):
 *
 * 1. connectionPromise is never cleared after a successful connect, so once
 *    the socket dies, realtime.connect() returns the dead socket forever;
 * 2. its connect_error handler tears the socket down and disables
 *    reconnection on ANY error — socket.io fires connect_error for failed
 *    RECONNECT attempts too, so one blip after boot kills realtime for the
 *    rest of the session;
 * 3. reconnect attempts reuse the short-lived WS token fetched at boot, so
 *    even a clean reconnect minutes later is rejected by the server.
 *
 * connectRealtime() works around all three from the app side. Remove once
 * the SDK fixes land (filed under platform asks in audit/ROADMAP.md).
 */

const hardened = new WeakSet<object>();

export async function connectRealtime(sdk: any): Promise<any | null> {
  const rt = sdk?.realtime;
  if (!rt) return null;

  // (1) If the SDK is holding a dead socket that socket.io has given up on,
  // reset it so connect() builds a fresh socket with a fresh token.
  const existing = rt.getSocket?.();
  if (existing && !existing.connected && !existing.active) {
    rt.disconnect();
  }

  const socket = await rt.connect();
  if (socket && !hardened.has(socket)) {
    hardened.add(socket);

    // (2) The initial connect has settled by the time connect() resolves, so
    // the SDK's tear-down-on-any-connect_error handler has done its one job;
    // drop it so socket.io's auto-reconnect survives transient failures.
    socket.off('connect_error');

    // (3) socket.io reads `auth` on every connection attempt; the function
    // form lets each reconnect fetch a fresh WS token instead of replaying
    // the expired boot-time one.
    socket.auth = (cb: (data: Record<string, unknown>) => void) => {
      Promise.resolve(rt.client?.get?.('/realtime/ws-token'))
        .then((res: any) => cb({ token: res?.data?.token }))
        .catch(() => cb({}));
    };
  }
  return socket;
}
