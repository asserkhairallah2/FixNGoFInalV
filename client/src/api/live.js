// Live sync: turns server real-time events into fresh React Query data.
// Any `notification`/`push` from the server means "something about you changed"
// (request status, offer, payment, booking, KYC, chat, withdrawal...). We refetch
// the active queries (debounced) so every screen re-renders from real API data.
// A polling fallback lives in hooks.js for active requests in case the socket drops.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { on } from './signalr.js';

const STATIC_KEYS = new Set(['bootstrap']);

export function useLiveSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer = null;
    const refreshAll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({
          predicate: (q) => !STATIC_KEYS.has(String(q.queryKey?.[0] ?? '')),
          refetchType: 'active'
        });
      }, 250);
    };
    const offs = [
      'notification', 'push', 'request.updated', 'offer.new', 'offer.accepted',
      'payment.updated', 'location.updated', 'chat.message', 'notification.new',
      'connection.reconnected'
    ].map((e) => on(e, refreshAll));
    return () => { clearTimeout(timer); offs.forEach((off) => off()); };
  }, [qc]);
}
