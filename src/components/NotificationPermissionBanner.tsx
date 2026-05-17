'use client';
import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import styles from './NotificationPermissionBanner.module.css';

export default function NotificationPermissionBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    // Only show if permission is 'default' (not yet asked) and user has set a reminder
    const hasReminder = localStorage.getItem('kordit-has-reminder');
    if (Notification.permission === 'default' && hasReminder === 'true') {
      setShow(true);
    }
  }, []);

  async function handleEnable() {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('🔔 Kordit Reminders Enabled', {
        body: "You'll get notified when tasks are due.",
        icon: '/icon-192.png',
      });
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <Bell size={18} className={styles.icon} />
        <div>
          <div className={styles.title}>Enable push notifications?</div>
          <div className={styles.desc}>Get reminded when your tasks are due, even when the tab is in the background.</div>
        </div>
      </div>
      <div className={styles.actions}>
        <button className="btn btn-primary btn-sm" onClick={handleEnable}>Enable</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShow(false)}>Not now</button>
      </div>
      <button className={styles.closeBtn} onClick={() => setShow(false)}>
        <X size={14} />
      </button>
    </div>
  );
}
