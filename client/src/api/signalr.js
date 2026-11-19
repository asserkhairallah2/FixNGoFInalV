// SignalR client: auto-reconnect + resubscribe, dispatches domain events onto window.
import * as signalR from '@microsoft/signalr';
import { hasToken } from './http.js';

let connection = null;
const handlers = new Map();

export function on(event, handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(handler);
  return () => handlers.get(event)?.delete(handler);
}
function emit(event, payload) { handlers.get(event)?.forEach((h) => h(payload)); window.dispatchEvent(new CustomEvent(`fixngo:${event}`, { detail: payload })); }

export async function connectSignalR() {
  if (!hasToken() || connection) return connection;
  connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/app', { accessTokenFactory: () => sessionStorage.getItem('fixngo.access') || '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  const events = ['request.updated', 'offer.new', 'offer.accepted', 'chat.message', 'notification.new', 'payment.updated', 'location.updated', 'session.revoked', 'sim.event'];
  events.forEach((e) => connection.on(e, (payload) => emit(e, payload)));
  connection.onreconnected(() => emit('connection.reconnected', {}));
  connection.onclose(() => emit('connection.closed', {}));
  try { await connection.start(); emit('connection.connected', {}); }
  catch { /* offline banner handles this; reconnect will retry */ }
  return connection;
}

export async function disconnectSignalR() {
  if (connection) { try { await connection.stop(); } catch { /* ignore */ } connection = null; }
}
