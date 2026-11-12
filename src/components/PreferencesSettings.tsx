'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

type Preferences = {
  assignments: boolean;
  comments: boolean;
  mentions: boolean;
  invitations: boolean;
  dueSoon: boolean;
  browser: boolean;
  email: boolean;
};

const rows: Array<{ key: keyof Preferences; label: string; hint: string }> = [
  { key: 'assignments', label: 'Card assignments', hint: 'When someone assigns you to a card.' },
  { key: 'comments', label: 'Comments', hint: 'New comments on cards assigned to you.' },
  { key: 'mentions', label: 'Mentions', hint: 'When someone uses your @username in a comment.' },
  { key: 'invitations', label: 'Invitations', hint: 'Board and workspace invitations.' },
  { key: 'dueSoon', label: 'Due soon', hint: 'Assigned cards that are overdue or due within two days.' },
  { key: 'browser', label: 'Browser reminders', hint: 'Allow local browser reminder delivery.' },
];

const defaultPreferences: Preferences = {
  assignments: true,
  comments: true,
  mentions: true,
  invitations: true,
  dueSoon: true,
  browser: true,
  email: false,
};

export default function PreferencesSettings() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<keyof Preferences | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/notification-preferences', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not sync notification settings');
      const value = await response.json() as Preferences;
      setPreferences(value);
      localStorage.setItem('kordit-browser-notifications', String(value.browser));
      localStorage.setItem('kordit-due-soon-notifications', String(value.dueSoon));
    } catch {
      setError("Couldn't connect to notification settings. The rest of Preferences is still available.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadPreferences, 0);
    return () => window.clearTimeout(timer);
  }, [loadPreferences]);

  async function toggle(key: keyof Preferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next); setSaving(key); setError('');
    if (key === 'browser') localStorage.setItem('kordit-browser-notifications', String(next.browser));
    if (key === 'dueSoon') localStorage.setItem('kordit-due-soon-notifications', String(next.dueSoon));
    try {
      const response = await fetch('/api/notification-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('Save failed');
    } catch {
      setPreferences(preferences);
      if (key === 'browser') localStorage.setItem('kordit-browser-notifications', String(preferences.browser));
      if (key === 'dueSoon') localStorage.setItem('kordit-due-soon-notifications', String(preferences.dueSoon));
      setError("Couldn't save that setting. Please retry when the connection is available.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 20 }}>Notifications</h2>
      <p style={{ margin: '6px 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>Choose which collaboration events appear in your inbox.</p>
      {error && <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255, 86, 48, 0.09)', color: '#C9372C', fontSize: 12 }}><AlertCircle size={15} /><span style={{ flex: 1 }}>{error}</span><button className="btn btn-ghost btn-sm" onClick={loadPreferences}><RefreshCw size={13} /> Retry</button></div>}
      <div style={{ position: 'relative', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', opacity: loading ? 0.65 : 1 }}>
          {loading && <span style={{ position: 'absolute', right: 12, top: 12, zIndex: 1 }}><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /></span>}
          {rows.map((row) => <button key={row.key} type="button" aria-pressed={preferences[row.key]} disabled={loading || saving !== null} onClick={() => toggle(row.key)} style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '13px 14px', border: 0, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', textAlign: 'left', cursor: loading || saving !== null ? 'wait' : 'pointer' }}><span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 13 }}>{row.label}</b><small style={{ color: 'var(--text-muted)' }}>{row.hint}</small></span><span style={{ width: 38, height: 22, padding: 3, borderRadius: 20, background: preferences[row.key] ? 'var(--accent)' : 'var(--bg-hover)', display: 'flex', justifyContent: preferences[row.key] ? 'flex-end' : 'flex-start' }}><i style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'block' }} /></span>{saving === row.key && <Loader2 size={13} />}</button>)}
      </div>

    </div>
  );
}
