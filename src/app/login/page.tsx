'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import styles from './page.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const res = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: '/',
      });

      if (res?.error) {
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#0052CC"/>
              <rect x="6" y="6" width="8" height="12" rx="2" fill="white" opacity="0.9"/>
              <rect x="18" y="6" width="8" height="8" rx="2" fill="white" opacity="0.7"/>
              <rect x="18" y="18" width="8" height="8" rx="2" fill="white" opacity="0.5"/>
            </svg>
          </div>
          <h1>Welcome to Kordit</h1>
          <p>Sign in or create an account</p>
        </div>

        {status === 'success' ? (
          <div className={styles.successMessage}>
            <div className={styles.checkIcon}>✓</div>
            <h3>Check your email!</h3>
            <p>A magic link has been sent to <strong>{email}</strong>. Click the link to sign in securely.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
                className={styles.input}
              />
            </div>

            {status === 'error' && (
              <p className={styles.error}>Something went wrong. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email}
              className={styles.submitBtn}
            >
              {status === 'loading' ? 'Sending link...' : 'Continue with Email'}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  );
}
