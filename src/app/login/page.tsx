'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LayoutTemplate, Users, CheckCircle2, Navigation } from 'lucide-react';
import styles from './page.module.css';

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [method, setMethod] = useState<'magic' | 'password'>('magic');
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
      
      {/* ─── LEFT SIDE - BRANDING ─── */}
      <div className={styles.brandingSection}>
        <div className={styles.brandingHeader}>
          <img src="/kordit-logo.svg" alt="Kordit" width={36} height={36} />
          <span className={styles.brandingLogoText}>Kordit</span>
        </div>
        
        <div className={styles.brandingContent}>
          <h1>Work moves better on visual boards.</h1>
          <p>Track tasks, approvals, requests, and workflows from one simple workspace.</p>
          
          <div className={styles.mockBoardWrapper}>
            {/* Floating Decorations */}
            <div className={`${styles.mockFloatingElement} ${styles.floatingTopRight}`}>
              <Users size={28} color="#4A89DF" />
            </div>
            <div className={`${styles.mockFloatingElement} ${styles.floatingBottomLeft}`}>
              <CheckCircle2 size={24} />
            </div>
            <div className={`${styles.mockFloatingElement} ${styles.floatingBottomRight}`}>
              <LayoutTemplate size={24} />
            </div>

            {/* The Kanban Board */}
            <div className={styles.mockBoard}>
              <div className={styles.mockColumn}>
                <div className={styles.mockColHeader}>
                  <div className={styles.mockColTitle}>
                    <div className={styles.mockColDot} style={{ background: '#3B82F6' }} />
                    To Do
                  </div>
                  <div className={styles.mockColCount}>4</div>
                </div>
                
                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Review design system updates</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#DBEAFE', color: '#1E40AF' }}>Design</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=1" alt="avatar" /></div>
                  </div>
                </div>

                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Collect feedback on landing page</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#E0E7FF', color: '#4338CA' }}>Marketing</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=2" alt="avatar" /></div>
                  </div>
                </div>

                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Onboard new team member</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#D1FAE5', color: '#065F46' }}>HR</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=3" alt="avatar" /></div>
                  </div>
                </div>
              </div>

              <div className={styles.mockColumn}>
                <div className={styles.mockColHeader}>
                  <div className={styles.mockColTitle}>
                    <div className={styles.mockColDot} style={{ background: '#F59E0B' }} />
                    In Progress
                  </div>
                  <div className={styles.mockColCount}>3</div>
                </div>
                
                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Build user dashboard</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#E0F2FE', color: '#0369A1' }}>Engineering</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=4" alt="avatar" /></div>
                  </div>
                </div>

                {/* Simulated dragging card */}
                <div className={styles.mockCard} style={{ opacity: 0.95, transform: 'rotate(-3deg) scale(1.03)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}>
                  <div className={styles.mockCardTitle}>Review API integration</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#EDE9FE', color: '#5B21B6' }}>Engineering</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=5" alt="avatar" /></div>
                  </div>
                  <Navigation className={styles.dragCursor} size={22} color="#172B4D" style={{ transform: 'rotate(-45deg)', fill: '#172B4D' }} />
                </div>
                
                <div className={styles.mockCard} style={{ border: '2px dashed #CBD5E1', background: 'transparent', boxShadow: 'none', minHeight: '60px' }}>
                </div>
                
                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Prepare release notes</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#FEF3C7', color: '#92400E' }}>Product</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=6" alt="avatar" /></div>
                  </div>
                </div>
              </div>

              <div className={styles.mockColumn}>
                <div className={styles.mockColHeader}>
                  <div className={styles.mockColTitle}>
                    <div className={styles.mockColDot} style={{ background: '#10B981' }} />
                    Done
                  </div>
                  <div className={styles.mockColCount}>2</div>
                </div>
                
                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Update documentation</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#D1FAE5', color: '#065F46' }}>Docs</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=7" alt="avatar" /></div>
                  </div>
                </div>

                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Fix notification bug</div>
                  <div className={styles.mockCardFooter}>
                    <div className={styles.mockTag} style={{ background: '#FCE7F3', color: '#9D174D' }}>Engineering</div>
                    <div className={styles.mockAvatar}><img src="https://i.pravatar.cc/100?img=8" alt="avatar" /></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>


      {/* ─── RIGHT SIDE - LOGIN ─── */}
      <div className={styles.loginSection}>
        <div className={styles.card}>
          <div className={styles.loginHeader}>
            <h2>Welcome back</h2>
            <p>Log in to manage your boards, tasks, and workflows.</p>
          </div>

          {status === 'success' && method === 'magic' ? (
            <div className={styles.successMessage}>
              <div className={styles.checkIcon}>✓</div>
              <h3>Check your email!</h3>
              <p>A magic link has been sent to <strong>{identifier}</strong>. Click the link to sign in securely.</p>
            </div>
          ) : (
            <>
              <div className={styles.toggleContainer}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${method === 'magic' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setMethod('magic')}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${method === 'password' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setMethod('password')}
                >
                  Login
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="identifier">
                    {method === 'magic' ? 'Email address' : 'Email or Username'}
                  </label>
                  <input
                    id="identifier"
                    type={method === 'magic' ? 'email' : 'text'}
                    placeholder="you@company.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className={styles.input}
                    autoComplete={method === 'magic' ? 'email' : 'username'}
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
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#97A0AF',
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
                      ? 'Log In' 
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

    </div>
  );
}
