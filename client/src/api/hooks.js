// React Query data hooks — every screen reads real API data through these.
// No hard-coded records: lists, counts and details come from the backend.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from './http.js';

const q = (key, path, opts = {}) => useQuery({ queryKey: key, queryFn: () => get(path), ...opts });

export const k = {
  bootstrap: ['bootstrap'], vehicles: ['vehicles'], requests: ['requests'],
  offers: ['offers'], notifications: ['notifications'], unread: ['notifications', 'unread'],
  invoices: ['invoices'], methods: ['payments', 'methods'], wallet: ['payments', 'wallet'],
  earnings: ['payments', 'earnings'], banks: ['payments', 'banks'], withdrawals: ['payments', 'withdrawals'],
  centers: ['centers'], bookings: ['bookings'], threads: ['chat', 'threads'],
  provider: ['provider', 'me'], kyc: ['provider', 'kyc'], providerHistory: ['provider', 'history'],
  reviews: (kind, id) => ['reviews', kind, id], tickets: ['support', 'tickets'], faqs: ['support', 'faqs'],
  sos: ['support', 'sos'], safety: ['support', 'safety'], adminUsers: ['admin', 'users'],
  dashboard: ['admin', 'dashboard'], kycQueue: ['admin', 'kyc'], settings: ['admin', 'settings'],
};

// ---- Bootstrap / reference data ----
export const useBootstrap = () => q(k.bootstrap, '/lookups/bootstrap', { staleTime: 5 * 60_000 });

// ---- Vehicles ----
export const useVehicles = () => q(k.vehicles, '/vehicles');
export const useVehicle = (id) => q(['vehicles', id], `/vehicles/${id}`, { enabled: !!id });
export function useSaveVehicle() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => id ? put(`/vehicles/${id}`, body) : post('/vehicles', body),
    onSuccess: () => c.invalidateQueries({ queryKey: k.vehicles })
  });
}
export function useDeleteVehicle() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (id) => del(`/vehicles/${id}`), onSuccess: () => c.invalidateQueries({ queryKey: k.vehicles }) });
}

// ---- Requests / offers / quotes ----
export const useRequests = () => q(k.requests, '/requests', { refetchInterval: 15_000 });
export const useRequest = (id) => q(['requests', id], `/requests/${id}`, { enabled: !!id });
export const useTimeline = (id) => q(['requests', id, 'timeline'], `/requests/${id}/timeline`, { enabled: !!id });
export const useCandidates = (id) => q(['requests', id, 'candidates'], `/requests/${id}/candidates`, { enabled: !!id });
export const useRequestOffers = (id) => q(['requests', id, 'offers'], `/requests/${id}/offers`, { enabled: !!id });
export const useQuotes = (id) => q(['requests', id, 'quotes'], `/requests/${id}/quotes`, { enabled: !!id });
export const useOffers = () => q(k.offers, '/offers', { refetchInterval: 15_000 });
export function useEstimate() { return useMutation({ mutationFn: (b) => post('/requests/estimate', b) }); }
export function useCreateRequest() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: (b) => post('/requests', b, { idempotencyKey: b.idempotencyKey }),
    onSuccess: () => c.invalidateQueries({ queryKey: k.requests })
  });
}
export function useCancelRequest() {
  const c = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...b }) => post(`/requests/${id}/cancel`, b), onSuccess: () => c.invalidateQueries({ queryKey: k.requests }) });
}
export function useAdvanceStatus() {
  const c = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...b }) => post(`/requests/${id}/status`, b), onSuccess: () => c.invalidateQueries({ queryKey: k.requests }) });
}
export function useSelectProvider(id) {
  const c = useQueryClient();
  return useMutation({ mutationFn: (providerId) => post(`/requests/${id}/offers`, { providerId }), onSuccess: () => c.invalidateQueries({ queryKey: ['requests', id, 'candidates'] }) });
}
export function useAcceptOffer() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (id) => post(`/offers/${id}/accept`, {}), onSuccess: () => c.invalidateQueries({ queryKey: k.requests }) });
}
export function useDeclineOffer() {
  const c = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...b }) => post(`/offers/${id}/decline`, b), onSuccess: () => c.invalidateQueries({ queryKey: k.offers }) });
}
export function useCreateQuote(id) {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post(`/requests/${id}/quotes`, b), onSuccess: () => c.invalidateQueries({ queryKey: ['requests', id, 'quotes'] }) });
}
export function useApproveQuote(id) {
  const c = useQueryClient();
  return useMutation({ mutationFn: (quoteId) => post(`/requests/${id}/quotes/${quoteId}/approve`, {}), onSuccess: () => c.invalidateQueries({ queryKey: k.requests }) });
}
export function useDispute(id) {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post(`/requests/${id}/dispute`, b), onSuccess: () => c.invalidateQueries({ queryKey: k.requests }) });
}

// ---- Payments ----
export const useMethods = () => q(k.methods, '/payments/methods');
export const useInvoices = () => q(k.invoices, '/payments/invoices');
export const useInvoiceForRequest = (id) => q(['invoices', 'request', id], `/payments/invoices/request/${id}`, { enabled: !!id });
export const useWallet = () => q(k.wallet, '/payments/wallet');
export const useEarnings = () => q(k.earnings, '/payments/earnings');
export const useBanks = () => q(k.banks, '/payments/banks');
export const useWithdrawals = () => q(k.withdrawals, '/payments/withdrawals');
export function useAddCard() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post('/payments/methods/card', b), onSuccess: () => c.invalidateQueries({ queryKey: k.methods }) });
}
export function usePay(invoiceId) {
  const c = useQueryClient();
  return useMutation({
    mutationFn: (b) => post(`/payments/invoices/${invoiceId}/pay`, { method: 'Card', ...b, idempotencyKey: b.idempotencyKey || crypto.randomUUID() }),
    onSuccess: () => { c.invalidateQueries({ queryKey: k.invoices }); c.invalidateQueries({ queryKey: k.wallet }); }
  });
}
export function useConfirmCash(invoiceId) {
  const c = useQueryClient();
  return useMutation({ mutationFn: () => post(`/payments/invoices/${invoiceId}/confirm-cash`, {}), onSuccess: () => c.invalidateQueries({ queryKey: k.invoices }) });
}
export function useWithdraw() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post('/payments/withdrawals', b), onSuccess: () => c.invalidateQueries({ queryKey: k.withdrawals }) });
}

// ---- Centers / bookings ----
export const useCenters = () => q(k.centers, '/centers');
export const useCenter = (id) => q(['centers', id], `/centers/${id}`, { enabled: !!id });
export const useCenterServices = (id) => q(['centers', id, 'services'], `/centers/${id}/services`, { enabled: !!id });
export const useAvailability = (id, serviceId, day) => q(['centers', id, 'availability', serviceId, day],
  `/centers/${id}/availability?serviceId=${serviceId}&day=${encodeURIComponent(day || '')}`, { enabled: !!id && !!serviceId && !!day });
export const useBookings = () => q(k.bookings, '/centers/bookings');
export const useBooking = (id) => q(['bookings', id], `/centers/bookings/${id}`, { enabled: !!id });
export const useCenterAdminServices = () => q(['center-admin', 'services'], '/center-admin/services');
export const useCenterBays = () => q(['center-admin', 'bays'], '/center-admin/bays');
export const useTechnicians = () => q(['center-admin', 'technicians'], '/center-admin/technicians');
export const useWorkOrders = () => q(['center-admin', 'work-orders'], '/center-admin/work-orders');
export function useCreateBooking() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post('/centers/bookings', b), onSuccess: () => c.invalidateQueries({ queryKey: k.bookings }) });
}
export function useManageBooking() {
  const c = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }) => post(`/center-admin/bookings/${id}/${action}`, body || {}),
    onSuccess: () => c.invalidateQueries({ queryKey: k.bookings })
  });
}

// ---- Providers ----
export const useProvider = () => q(k.provider, '/providers/me');
export const useKyc = () => q(k.kyc, '/providers/kyc/me');
export const useProviderHistory = () => q(k.providerHistory, '/providers/history');
export function useGoOnline() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post('/providers/online', b), onSuccess: () => c.invalidateQueries({ queryKey: k.provider }) });
}
export function useHeartbeat() { return useMutation({ mutationFn: (b) => post('/providers/heartbeat', b) }); }
export function useSubmitKyc() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (b) => post('/providers/kyc', b), onSuccess: () => c.invalidateQueries({ queryKey: k.kyc }) });
}

// ---- Reviews / notifications / chat ----
export const useReviews = (kind, id) => q(k.reviews(kind, id), `/reviews/${kind}/${id}`, { enabled: !!id });
export const useNotifications = () => q(k.notifications, '/notifications', { refetchInterval: 30_000 });
export const useUnreadCount = () => q(k.unread, '/notifications/unread-count', { refetchInterval: 30_000 });
export function useMarkRead() {
  const c = useQueryClient();
  return useMutation({ mutationFn: (ids) => post('/notifications/read', { ids }), onSuccess: () => { c.invalidateQueries({ queryKey: k.notifications }); c.invalidateQueries({ queryKey: k.unread }); } });
}
export const useThreads = () => q(k.threads, '/chat/threads');
export const useThread = (id) => q(['chat', 'threads', id], `/chat/threads/${id}`, { enabled: !!id });
export function useSendMessage(id) {
  const c = useQueryClient();
  return useMutation({ mutationFn: (text) => post(`/chat/threads/${id}/messages`, { text }, { idempotencyKey: crypto.randomUUID() }), onSuccess: () => c.invalidateQueries({ queryKey: ['chat', 'threads', id] }) });
}

// ---- Support / admin ----
export const useTickets = () => q(k.tickets, '/support/tickets');
export const useFaqs = () => q(k.faqs, '/support/faqs');
export const useSos = () => q(k.sos, '/support/sos');
export const useDashboard = () => q(k.dashboard, '/admin/dashboard');
export const useAdminUsers = () => q(k.adminUsers, '/admin/users');
export const useKycQueue = () => q(k.kycQueue, '/admin/kyc/queue');
export const useAdminSettings = () => q(k.settings, '/admin/settings');
export const useAdminReviews = () => q(['admin', 'reviews'], '/admin/reviews');
export const useAdminTickets = () => q(['admin', 'tickets'], '/admin/tickets');
export const useAdminReports = () => q(['admin', 'reports'], '/admin/reports');
export const useAudit = () => q(['admin', 'audit'], '/admin/audit');
