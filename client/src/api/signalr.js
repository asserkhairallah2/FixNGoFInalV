// SignalR client: auto-reconnect + resubscribe, dispatches domain events onto window.
// The server emits: `notification` (persisted in-app notification for the user),
// `push` (fake device push), `chat.typing`; older/extra names are kept for compatibility.
import * as signalR from '@microsoft/signalr';
import { hasToken } from './http.js';

let connection = null;
const handlers = new Map();

export const SERVER_EVENTS = [
  'notification', 'push', 'chat.typing',
  'request.updated', 'offer.new', 'offer.accepted', 'chat.message', 'notification.new',
  'payment.updated', 'location.updated', 'session.revoked', 'sim.event'
];

export function on(event, handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(handler);
  return () => handlers.get(event)?.delete(handler);
}
function emit(event, payload) {
  handlers.get(event)?.forEach((h) => h(payload));
  window.dispatchEvent(new CustomEvent(`fixngo:${event}`, { detail: payload }));
}

export async function connectSignalR() {
  if (!hasToken() || connection) return connection;
  connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/app', { accessTokenFactory: () => sessionStorage.getItem('fixngo.access') || '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  SERVER_EVENTS.forEach((e) => connection.on(e, (payload) => emit(e, payload)));
  connection.onreconnected(() => emit('connection.reconnected', {}));
  connection.onclose(() => emit('connection.closed', {}));
  try { await connection.start(); emit('connection.connected', {}); }
  catch { /* offline banner handles this; reconnect will retry */ }
  return connection;
}

export async function disconnectSignalR() {
  if (connection) { try { await connection.stop(); } catch { /* ignore */ } connection = null; }
}
