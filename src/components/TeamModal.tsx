'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Trash2, UserPlus, Users, X } from 'lucide-react';
import styles from './WorkspaceModal.module.css';

type TeamData = {
  workspace: { id: string; name: string };
  role: string;
  members: Array<{ id: string; role: string; createdAt: string; user: { id: string; name: string | null; username: string | null; email: string | null; image: string | null } }>;
  invites: Array<{ id: string; email: string; role: string; status: string; createdAt: string }>;
};

export default function TeamModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => fetch('/api/team', { cache: 'no-store' }).then((response) => response.json()).then(setData), []);
  useEffect(() => { load(); }, [load]);
  const canManage = data?.role === 'Owner' || data?.role === 'Admin';

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setError(result.error || 'Could not send invitation');
    setEmail(''); await load();
  }

  async function mutate(method: 'PATCH' | 'DELETE', body: Record<string, string>) {
    const response = await fetch('/api/team', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (response.ok) await load();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${styles.modal}`} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div><h2><Users size={20} /> {data?.workspace.name || 'Your workspace'}</h2><p>Manage teammates and invitation status in one place.</p></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close team management"><X size={18} /></button>
        </header>
        {!data ? <div className={styles.loading}><Loader2 className={styles.spin} /> Preparing workspace…</div> : (
          <div className={styles.content}>
            {canManage && (
              <section className={styles.section} style={{ marginTop: 0 }}>
                <h3>Invite a teammate</h3>
                <form className={styles.form} onSubmit={invite}>
                  <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" />
                  <select className="input" value={role} onChange={(event) => setRole(event.target.value)}><option>Member</option><option>Admin</option></select>
                  <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={14} className={styles.spin} /> : <UserPlus size={14} />} Invite</button>
                </form>
                {error && <p className={styles.error}>{error}</p>}
              </section>
            )}

            <section className={styles.section}>
              <h3>Members ({data.members.length})</h3>
              <div className={styles.memberList}>
                {data.members.map((member) => (
                  <div className={styles.member} key={member.id}>
                    <span className="avatar avatar-sm">{(member.user.name || member.user.email || '?').slice(0, 1).toUpperCase()}</span>
                    <div className={styles.memberInfo}><b>{member.user.name || member.user.username || 'Unnamed member'}</b><span>{member.user.email || `@${member.user.username}`}</span></div>
                    {canManage && member.role !== 'Owner' ? (
                      <select className="input" style={{ width: 110 }} value={member.role} onChange={(event) => mutate('PATCH', { memberId: member.id, role: event.target.value })}><option>Member</option><option>Admin</option></select>
                    ) : <span className={styles.pill}>{member.role}</span>}
                    {canManage && member.role !== 'Owner' && <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove member" onClick={() => mutate('DELETE', { memberId: member.id })}><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </section>

            {canManage && <section className={styles.section}>
              <h3>Invitations</h3>
              <div className={styles.memberList}>
                {data.invites.map((invite) => <div className={styles.member} key={invite.id}><Mail size={17} /><div className={styles.memberInfo}><b>{invite.email}</b><span>Invited {new Date(invite.createdAt).toLocaleDateString()}</span></div><span className={styles.pill}>{invite.status}</span>{invite.status === 'Pending' && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => mutate('DELETE', { inviteId: invite.id })}><Trash2 size={14} /></button>}</div>)}
                {!data.invites.length && <p className={styles.empty}>No invitations yet.</p>}
              </div>
            </section>}
          </div>
        )}
      </div>
    </div>
  );
}
