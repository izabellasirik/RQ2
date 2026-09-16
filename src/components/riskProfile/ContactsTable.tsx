import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Contact } from '../../types';
import { Button, ConfirmDialog, CopyButton } from '../ui';

type Draft = { name: string; role: string; phone: string; email: string };
const EMPTY_DRAFT: Draft = { name: '', role: '', phone: '', email: '' };

function toDraft(c: Contact): Draft {
  return { name: c.name ?? '', role: c.role ?? '', phone: c.phone ?? '', email: c.email ?? '' };
}

function fromDraft(d: Draft): Omit<Contact, 'id'> {
  return { name: d.name.trim() || undefined, role: d.role.trim() || undefined, phone: d.phone.trim() || undefined, email: d.email.trim() || undefined };
}

function contactCopyText(c: Contact): string {
  return [c.name && `Name: ${c.name}`, c.role && `Role: ${c.role}`, c.phone && `Phone: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join('\n');
}

const inputCls = 'w-full rounded-md border border-[var(--color-brand-500)] px-1.5 py-1 text-xs outline-none';

/**
 * People associated with the account who aren't necessarily the Named Insured, an Owner, or a
 * Driver (see types/contact.ts) — e.g. an office manager or safety director. Broker-managed only in
 * this pass; no automatic extraction populates this yet (see reviewFlags.ts/entityAssociation.ts
 * for what IS automated — driver/MVR identity — and the final report's "deliberately not built"
 * list for why contact extraction specifically was left manual).
 */
export function ContactsTable({
  contacts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  contacts: Contact[];
  onAdd: (entry: Omit<Contact, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<Contact>) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setEditingId('new');
  }
  function startEdit(c: Contact) {
    setDraft(toDraft(c));
    setEditingId(c.id);
  }
  function cancel() {
    setEditingId(null);
  }
  function save() {
    if (editingId === 'new') onAdd(fromDraft(draft));
    else if (editingId) onUpdate(editingId, fromDraft(draft));
    setEditingId(null);
  }

  function editRow(c: Contact | null) {
    return (
      <tr key={c?.id ?? 'new'} className="border-b border-[var(--color-ink-100)] bg-[var(--color-brand-50)]/40">
        <td className="py-2 pr-4"><input className={inputCls} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus={c === null} /></td>
        <td className="py-2 pr-4"><input className={inputCls} placeholder="e.g. Safety Director" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></td>
        <td className="py-2 pr-4"><input className={inputCls} placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></td>
        <td className="py-2 pr-4"><input className={inputCls} placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></td>
        <td className="py-2">
          <div className="flex items-center gap-1">
            <button onClick={save} className="rounded-md bg-[var(--color-brand-800)] p-1 text-white cursor-pointer" aria-label="Save contact"><Check size={13} /></button>
            <button onClick={cancel} className="rounded-md bg-[var(--color-ink-100)] p-1 text-[var(--color-ink-500)] cursor-pointer" aria-label="Cancel"><X size={13} /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={startAdd} disabled={editingId !== null}>
          Add contact
        </Button>
      </div>
      {contacts.length === 0 && editingId !== 'new' ? (
        <p className="px-2 py-6 text-center text-sm text-[var(--color-ink-400)]">No contacts added yet. A contact is anyone tied to this account who isn't the Named Insured, an owner, or a driver.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-ink-100)] text-xs text-[var(--color-ink-500)]">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Phone</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {editingId === 'new' && editRow(null)}
            {contacts.map((c) =>
              editingId === c.id ? (
                editRow(c)
              ) : (
                <tr key={c.id} className="border-b border-[var(--color-ink-100)] last:border-0">
                  <td className="py-2.5 pr-4 text-[var(--color-ink-800)]">{c.name ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-ink-800)]">{c.role ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-ink-800)]">{c.phone ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-ink-800)]">{c.email ?? '—'}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1">
                      <CopyButton iconOnly text={contactCopyText(c)} label="Copy contact" />
                      <button onClick={() => startEdit(c)} disabled={editingId !== null} className="rounded-md p-1 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] cursor-pointer disabled:opacity-40" aria-label="Edit contact"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(c)} disabled={editingId !== null} className="rounded-md p-1 text-[var(--color-ink-400)] hover:bg-[var(--color-danger-100)] hover:text-[var(--color-danger-600)] cursor-pointer disabled:opacity-40" aria-label="Delete contact"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete this contact?"
        description={`Remove ${deleteTarget?.name ?? 'this contact'} from the account. This cannot be undone.`}
        confirmLabel="Delete contact"
      />
    </div>
  );
}
