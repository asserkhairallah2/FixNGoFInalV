// SignalR client: auto-reconnect + resubscribe, dispatches domain events onto window.
// The server emits: `notification` (persisted in-app notification for the user),
// `push` (fake device push), `chat.typing`; older/extra names are kept for compatibility.
import * as signalR from '@microsoft/signalr';
import { hasToken } from './http.js';

let connection = null;
let connectedToken = null;
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
  const currentToken = sessionStorage.getItem('fixngo.access') || '';
  if (!hasToken() || !currentToken) return null;
  if (connection && connectedToken === currentToken) return connection;
  if (connection) {
    try { await connection.stop(); } catch { /* ignore */ }
    connection = null;
    connectedToken = null;
  }
  const activeConn = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/app', { accessTokenFactory: () => sessionStorage.getItem('fixngo.access') || '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();
  connection = activeConn;
  connectedToken = currentToken;

  SERVER_EVENTS.forEach((e) => activeConn.on(e, (payload) => emit(e, payload)));
  activeConn.onreconnected(() => emit('connection.reconnected', {}));
  activeConn.onclose(() => emit('connection.closed', {}));
  try { await activeConn.start(); emit('connection.connected', {}); }
  catch { /* offline banner handles this; reconnect will retry */ }
  return activeConn;
}

export async function disconnectSignalR() {
  if (connection) {
    const prev = connection;
    connection = null;
    connectedToken = null;
    try { await prev.stop(); } catch { /* ignore */ }
  }
}
