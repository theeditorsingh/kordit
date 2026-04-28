'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Eye, EyeOff } from 'lucide-react';
import styles from '../login/page.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading') {
    return <div className={styles.container}>Loading...</div>;
  }

  // If they somehow get here but aren't logged in, send them to login
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  // If they already have a username, they shouldn't be here
  if (session?.user?.username) {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (password) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password ? password : undefined 
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Something went wrong');
      }

      // Force session update so the client knows we have a username now
      await update({ username: username.trim() });
      
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <img src="/kordit-logo.svg" alt="Kordit" width={32} height={32} />
          </div>
          <h1>Complete Your Profile</h1>
          <p>
            Setting up account for <strong>{session?.user?.email}</strong>
          </p>
          <p style={{ marginTop: '8px', fontSize: '13px' }}>
            Set a username for your custom URLs. You can also add a password for easier logins next time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="username">Username (required)</label>
            <input
              id="username"
              type="text"
              placeholder="e.g., johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              disabled={isSubmitting}
              className={styles.input}
              autoComplete="off"
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Only lowercase letters, numbers, and hyphens allowed.
            </p>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password (optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Set a password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className={styles.input}
                style={{ paddingRight: '40px' }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {password && (
            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!!password}
                disabled={isSubmitting}
                className={styles.input}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <p className={styles.error}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !username}
            className={styles.submitBtn}
          >
            {isSubmitting ? 'Saving...' : 'Complete Setup'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => {
                import('next-auth/react').then((m) => m.signOut({ callbackUrl: '/login' }));
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Sign out and start over
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
