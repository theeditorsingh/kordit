'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Appearance, useTheme } from '@/context/ThemeContext';

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

const appearances: Array<{ id: Appearance; name: string; hint: string; colors: string[] }> = [
  { id: 'kordit', name: 'Kordit', hint: 'Focused blue with balanced corners.', colors: ['#0052CC', '#36B37E', '#FF991F'] },
  { id: 'classic', name: 'Classic Kanban', hint: 'Denser controls and compact cards.', colors: ['#0079BF', '#EBECF0', '#61BD4F'] },
  { id: 'material', name: 'Material', hint: 'Softer surfaces and rounded controls.', colors: ['#1A73E8', '#F1F3F4', '#34A853'] },
];

export default function PreferencesSettings() {
  const { appearance, setAppearance } = useTheme();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState<keyof Preferences | null>(null);

  useEffect(() => {
    fetch('/api/notification-preferences').then((response) => response.json()).then((value: Preferences) => {
      setPreferences(value);
      localStorage.setItem('kordit-browser-notifications', String(value.browser));
      localStorage.setItem('kordit-due-soon-notifications', String(value.dueSoon));
    });
  }, []);

  async function toggle(key: keyof Preferences) {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next); setSaving(key);
    if (key === 'browser') localStorage.setItem('kordit-browser-notifications', String(next.browser));
    if (key === 'dueSoon') localStorage.setItem('kordit-due-soon-notifications', String(next.dueSoon));
    const response = await fetch('/api/notification-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    if (!response.ok) setPreferences(preferences);
    setSaving(null);
  }

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 20 }}>Notifications</h2>
      <p style={{ margin: '6px 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>Choose which collaboration events appear in your inbox.</p>
      {!preferences ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
          {rows.map((row) => <button key={row.key} onClick={() => toggle(row.key)} style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '13px 14px', border: 0, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}><span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 13 }}>{row.label}</b><small style={{ color: 'var(--text-muted)' }}>{row.hint}</small></span><span style={{ width: 38, height: 22, padding: 3, borderRadius: 20, background: preferences[row.key] ? 'var(--accent)' : 'var(--bg-hover)', display: 'flex', justifyContent: preferences[row.key] ? 'flex-end' : 'flex-start' }}><i style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'block' }} /></span>{saving === row.key && <Loader2 size={13} />}</button>)}
        </div>
      )}

      <h2 style={{ margin: '28px 0 0', fontSize: 20 }}>Appearance</h2>
      <p style={{ margin: '6px 0 14px', color: 'var(--text-muted)', fontSize: 13 }}>Light and dark mode still work with every style.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
        {appearances.map((item) => <button key={item.id} onClick={() => setAppearance(item.id)} style={{ border: `2px solid ${appearance === item.id ? 'var(--accent)' : 'var(--border-subtle)'}`, borderRadius: item.id === 'classic' ? 6 : item.id === 'material' ? 18 : 12, padding: 12, background: 'var(--bg-surface)', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}><span style={{ display: 'flex', gap: 4, marginBottom: 10 }}>{item.colors.map((color) => <i key={color} style={{ display: 'block', width: 24, height: 16, borderRadius: 4, background: color }} />)}{appearance === item.id && <Check size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}</span><b style={{ display: 'block', fontSize: 13 }}>{item.name}</b><small style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)' }}>{item.hint}</small></button>)}
      </div>
    </div>
  );
}
