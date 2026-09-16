import { TriangleAlert, Info } from 'lucide-react';
import type { ReviewFlag } from '../../services/extraction';

/**
 * Calm, non-alarming presentation of deterministic review flags (see reviewFlags.ts) — every flag
 * is advisory ("worth checking"), never a hard error or an automatic account-invalid state, per the
 * product requirement that e.g. a registration owner differing from the Named Insured is common and
 * legitimate, not necessarily wrong.
 */
export function ReviewFlagsPanel({ flags }: { flags: ReviewFlag[] }) {
  if (flags.length === 0) return null;
  const warnings = flags.filter((f) => f.severity === 'warning');
  const infos = flags.filter((f) => f.severity === 'info');

  return (
    <div className="rounded-lg border border-[var(--color-warning-100)] bg-[var(--color-warning-50)] px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning-700)]">
        <TriangleAlert size={14} />
        Review Needed — {flags.length}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-[var(--color-ink-700)]">
        {warnings.map((f) => (
          <li key={f.id} className="flex items-start gap-2">
            <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[var(--color-warning-600)]" />
            <span>{f.message}</span>
          </li>
        ))}
        {infos.map((f) => (
          <li key={f.id} className="flex items-start gap-2 text-[var(--color-ink-600)]">
            <Info size={13} className="mt-0.5 shrink-0 text-[var(--color-ink-400)]" />
            <span>{f.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
