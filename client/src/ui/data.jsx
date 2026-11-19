// Reusable data-bound primitives used by every ported screen.
// They render real API values, designed empty states and loading/error states.
import React from 'react';
import { usePrefs } from '../app/stores.jsx';
import { Card, StatusBadge, useColors, EmptyState, Skeleton, ErrorState } from './kit.jsx';

export function useT() {
  const { isAr } = usePrefs();
  return (en, ar) => (isAr ? ar : en);
}

export function ScreenBody({ query, children, emptyTitle, emptyMessage }) {
  if (query?.isLoading) return <Skeleton />;
  if (query?.isError) return <ErrorState error={query.error} retry={query.refetch} />;
  const data = query ? query.data : undefined;
  if (query && (!data || (Array.isArray(data) && data.length === 0)))
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return children(data);
}

export function SectionTitle({ children, action }) {
  const c = useColors();
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className={`text-xs font-extrabold uppercase tracking-wide ${c.text}`}>{children}</h2>
      {action}
    </div>
  );
}

export function Kpi({ label, value, icon: Icon, tone = 'red' }) {
  const c = useColors();
  const tones = { red: 'text-[#E51C23] bg-[#E51C23]/10', green: 'text-emerald-400 bg-emerald-500/10', amber: 'text-amber-400 bg-amber-500/10', sky: 'text-sky-400 bg-sky-500/10' };
  return (
    <Card className="!p-3 flex items-center gap-3">
      {Icon && <div className={`w-10 h-10 rounded-xl grid place-items-center ${tones[tone]}`}><Icon size={18} /></div>}
      <div>
        <p className={`text-lg font-extrabold ${c.text}`}>{value ?? '—'}</p>
        <p className={`text-[10px] ${c.secondaryText}`}>{label}</p>
      </div>
    </Card>
  );
}

export function InfoRow({ label, value, mono, status }) {
  const c = useColors();
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-200/60 dark:border-slate-700/50 last:border-0">
      <span className={`text-[11px] ${c.secondaryText}`}>{label}</span>
      <span className={`text-xs font-semibold ${c.text} ${mono ? 'font-mono' : ''} text-end`}>
        {status !== undefined ? <StatusBadge status={status} /> : (value ?? '—')}
      </span>
    </div>
  );
}

export function ListRow({ title, subtitle, badge, right, onClick, icon: Icon, testId }) {
  const c = useColors();
  return (
    <button onClick={onClick} data-testid={testId}
      className={`w-full rounded-2xl border ${c.border} ${c.surface} p-3 flex items-center gap-3 text-start hover:opacity-90 transition`}>
      {Icon && <div className={`w-10 h-10 rounded-xl ${c.elevated} grid place-items-center shrink-0 ${c.text}`}><Icon size={18} /></div>}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold truncate ${c.text}`}>{title}</p>
        {subtitle && <p className={`text-[10px] truncate ${c.secondaryText}`}>{subtitle}</p>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {badge !== undefined && badge !== null && <StatusBadge status={badge} />}
        {right && <span className={`text-[11px] font-bold ${c.text}`}>{right}</span>}
      </div>
    </button>
  );
}

export function EmptyAction({ label, onClick }) {
  return <button onClick={onClick} className="px-4 py-2 rounded-xl bg-[#E51C23] text-white text-xs font-bold">{label}</button>;
}
