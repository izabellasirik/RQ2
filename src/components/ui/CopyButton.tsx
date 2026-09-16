import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * The core "copy experience" primitive — every copyable value in the Account Workspace (a single
 * field, a driver/vehicle row, the whole account) renders one of these. Deliberately tiny and
 * consistent: click, brief "Copied" confirmation, no dialog, no navigation away from the page a
 * broker is working on.
 */
export function CopyButton({ text, label = 'Copy', className, iconOnly }: { text: string; label?: string; className?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (very old browser, insecure context) — nothing more we can do here.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  if (iconOnly) {
    return (
      <button
        onClick={copy}
        disabled={!text}
        aria-label={copied ? 'Copied' : label}
        title={copied ? 'Copied' : label}
        className={cn(
          'inline-flex items-center justify-center rounded-md p-1 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer',
          className
        )}
      >
        {copied ? <Check size={13} className="text-[var(--color-success-600)]" /> : <Copy size={13} />}
      </button>
    );
  }

  return (
    <button
      onClick={copy}
      disabled={!text}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer',
        className
      )}
    >
      {copied ? <Check size={13} className="text-[var(--color-success-600)]" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
