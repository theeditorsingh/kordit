'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Mascot from '@/components/Mascot';
import styles from './page.module.css';

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [method, setMethod] = useState<'magic' | 'password'>('magic');
  const [loginType, setLoginType] = useState<'email' | 'username'>('email');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('Something went wrong. Please try again.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;
    if (method === 'password' && !password) return;

    setStatus('loading');
    
    try {
      if (method === 'magic') {
        const res = await signIn('email', {
          email: identifier,
          redirect: false,
          callbackUrl: '/',
        });

        if (res?.error) {
          setErrorMessage('Failed to send magic link. Please try again.');
          setStatus('error');
        } else {
          setStatus('success');
        }
      } else {
        const res = await signIn('credentials', {
          identifier,
          password,
          redirect: false,
          callbackUrl: '/',
        });

        if (res?.error) {
          setErrorMessage('Invalid credentials.');
          setStatus('error');
        } else {
          router.push('/');
          router.refresh();
        }
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred.');
      setStatus('error');
    }
  };

  return (
    <div className={styles.container}>
      <Mascot />
      <div className={styles.card} style={{ position: 'relative' }}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <img src="/kordit-logo.svg" alt="Kordit" width={32} height={32} />
          </div>
          <h1>Welcome to Kordit</h1>
          <p>Sign in or create an account</p>
        </div>

        {status === 'success' && method === 'magic' ? (
          <div className={styles.successMessage}>
            <div className={styles.checkIcon}>✓</div>
            <h3>Check your email!</h3>
            <p>A magic link has been sent to <strong>{identifier}</strong>. Click the link to sign in securely.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button
                type="button"
                className={styles.submitBtn}
                style={{ 
                  flex: 1, 
                  background: method === 'magic' ? 'var(--bg-hover)' : 'transparent',
                  color: method === 'magic' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'none'
                }}
                onClick={() => {
                  setMethod('magic');
                  setLoginType('email'); // Magic link requires email
                }}
              >
                Magic Link
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                style={{ 
                  flex: 1, 
                  background: method === 'password' ? 'var(--bg-hover)' : 'transparent',
                  color: method === 'password' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'none'
                }}
                onClick={() => setMethod('password')}
              >
                Login
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              
              {method === 'password' && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="loginType" 
                      checked={loginType === 'email'} 
                      onChange={() => setLoginType('email')}
                    />
                    Email
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="loginType" 
                      checked={loginType === 'username'} 
                      onChange={() => setLoginType('username')}
                    />
                    Username
                  </label>
                </div>
              )}

              <div className={styles.inputGroup}>
                <label htmlFor="identifier">
                  {method === 'magic' ? 'Email address' : (loginType === 'email' ? 'Email address' : 'Username')}
                </label>
                <input
                  id="identifier"
                  type={loginType === 'email' ? 'email' : 'text'}
                  placeholder={loginType === 'email' ? "you@company.com" : "e.g., johndoe"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={status === 'loading'}
                  className={styles.input}
                  autoComplete={loginType === 'email' ? 'email' : 'username'}
                />
              </div>

              {method === 'password' && (
                <div className={styles.inputGroup}>
                  <label htmlFor="password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={status === 'loading'}
                      className={styles.input}
                      style={{ paddingRight: '40px' }}
                      autoComplete="current-password"
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
              )}

              {status === 'error' && (
                <p className={styles.error}>{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !identifier || (method === 'password' && !password)}
                className={styles.submitBtn}
              >
                {status === 'loading' 
                  ? 'Signing in...' 
                  : method === 'password' 
                    ? 'Sign In' 
                    : 'Send Magic Link'}
              </button>
            </form>
          </>
        )}

        <div className={styles.footer}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  );
}
