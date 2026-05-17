'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import {
  X, User, Lock, Trash2, Camera, Check, AlertCircle, Loader2,
  ShieldCheck, Calendar, LayoutGrid, MessageSquare, LogOut, ChevronRight, Eye, EyeOff, Mail, KeyRound
} from 'lucide-react';
import { updateProfileAction, changePasswordAction, deleteAccountAction, getCurrentUserAction, sendPasswordResetEmailAction } from '@/actions/userActions';
import styles from './ProfileModal.module.css';

type Tab = 'profile' | 'security' | 'danger';

interface UserData {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  workspaceRole: string;
  hasPassword: boolean;
  _count: { ownedBoards: number; comments: number };
}

function getInitials(name?: string | null, email?: string | null) {
  const src = name || email || '?';
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function avatarColor(id: string) {
  const palette = ['#0052CC', '#36B37E', '#FF5630', '#6554C0', '#FF991F', '#00B8D9'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { data: session, update: updateSession } = useSession();
  const [tab, setTab] = useState<Tab>('profile');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPendingProfile, startProfile] = useTransition();

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPendingPw, startPw] = useTransition();

  // Danger zone
  const [confirmText, setConfirmText] = useState('');
  const [dangerMsg, setDangerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPendingDanger, startDanger] = useTransition();

  // Password reset link
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [isPendingReset, startReset] = useTransition();
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load user data
  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (u) {
        setUserData(u as UserData);
        setName(u.name ?? '');
        setUsername(u.username ?? '');
        setAvatarUrl(u.image ?? '');
      }
      setLoading(false);
    });
  }, []);

  function handleProfileSave() {
    setProfileMsg(null);
    startProfile(async () => {
      try {
        await updateProfileAction({ name, username, image: avatarUrl });
        await updateSession(); // refresh session
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        // Refresh local user data
        const u = await getCurrentUserAction();
        if (u) setUserData(u as UserData);
      } catch (e: any) {
        setProfileMsg({ type: 'error', text: e.message ?? 'Failed to update profile' });
      }
    });
  }

  function handlePasswordChange() {
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    startPw(async () => {
      try {
        await changePasswordAction(currentPw, newPw);
        setPwMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        // Refresh user data so hasPassword updates
        const u = await getCurrentUserAction();
        if (u) setUserData(u as UserData);
      } catch (e: any) {
        setPwMsg({ type: 'error', text: e.message ?? 'Failed to change password' });
      }
    });
  }

  function handleSendResetLink() {
    setResetMsg(null);
    startReset(async () => {
      try {
        await sendPasswordResetEmailAction();
        // Trigger NextAuth's email flow to send the actual magic link
        if (userData?.email) {
          const res = await signIn('email', { email: userData.email, redirect: false });
          if (res?.error) throw new Error(res.error);
        }
        setResetLinkSent(true);
        setResetMsg({ type: 'success', text: 'Password reset email sent! Check your inbox, then sign in and set a new password.' });
        // Refresh user data — password is now null
        const u = await getCurrentUserAction();
        if (u) setUserData(u as UserData);
      } catch (e: any) {
        setResetMsg({ type: 'error', text: e.message ?? 'Failed to send reset email' });
      }
    });
  }

  function handleDeleteAccount() {
    startDanger(async () => {
      try {
        await deleteAccountAction(confirmText);
        signOut({ callbackUrl: '/login' });
      } catch (e: any) {
        setDangerMsg({ type: 'error', text: e.message ?? 'Failed to delete account' });
      }
    });
  }

  const passwordStrength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^a-zA-Z0-9]/.test(newPw)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];
  const strengthClass = [styles.pwNone, styles.pwWeak, styles.pwFair, styles.pwGood, styles.pwStrong][passwordStrength];

  const initials = getInitials(userData?.name, userData?.email);
  const bgColor = userData ? avatarColor(userData.id) : '#0052CC';

  const memberSince = '—'; // User model does not track createdAt

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="User Settings">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <User size={18} />
            <span>Settings</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Sidebar tabs */}
          <nav className={styles.tabs}>
            {/* Mini profile card */}
            <div className={styles.miniProfile}>
              <div className={styles.miniAvatar} style={{ background: bgColor }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name || 'avatar'} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className={styles.miniInfo}>
                <span className={styles.miniName}>{userData?.name || 'User'}</span>
                <span className={styles.miniEmail}>{userData?.email}</span>
              </div>
            </div>

            <div className={styles.tabDivider} />

            {[
              { id: 'profile' as Tab, icon: <User size={15} />, label: 'Profile' },
              { id: 'security' as Tab, icon: <Lock size={15} />, label: 'Security' },
              { id: 'danger' as Tab, icon: <Trash2 size={15} />, label: 'Danger Zone' },
            ].map((t) => (
              <button
                key={t.id}
                className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''} ${t.id === 'danger' ? styles.tabDanger : ''}`}
                onClick={() => setTab(t.id)}
                id={`settings-tab-${t.id}`}
              >
                {t.icon}
                <span>{t.label}</span>
                <ChevronRight size={13} className={styles.tabArrow} />
              </button>
            ))}

            <div className={styles.tabDivider} />

            {/* Stats */}
            {userData && (
              <div className={styles.stats}>
                <div className={styles.statRow}>
                  <Calendar size={13} />
                  <span>Joined {memberSince}</span>
                </div>
                <div className={styles.statRow}>
                  <LayoutGrid size={13} />
                  <span>{userData._count.ownedBoards} boards owned</span>
                </div>
                <div className={styles.statRow}>
                  <MessageSquare size={13} />
                  <span>{userData._count.comments} comments</span>
                </div>
                <div className={styles.statRow}>
                  <ShieldCheck size={13} />
                  <span>{userData.workspaceRole}</span>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />

            <button
              className={styles.signOutBtn}
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </nav>

          {/* Panel content */}
          <div className={styles.panel}>
            {loading ? (
              <div className={styles.loadingWrap}>
                <Loader2 size={28} className={styles.spinner} />
              </div>
            ) : (
              <>
                {/* ── PROFILE TAB ── */}
                {tab === 'profile' && (
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Profile</h2>
                    <p className={styles.sectionDesc}>Manage your personal information and how others see you on Kordit.</p>

                    {/* Avatar */}
                    <div className={styles.avatarWrap}>
                      <div className={styles.avatarPreview} style={{ background: bgColor }}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="avatar preview" />
                        ) : (
                          <span>{initials}</span>
                        )}
                        <div className={styles.avatarOverlay}>
                          <Camera size={18} />
                        </div>
                      </div>
                      <div className={styles.avatarMeta}>
                        <p className={styles.avatarLabel}>Profile Picture</p>
                        <p className={styles.avatarHint}>Enter an image URL below, or leave blank to use initials</p>
                        <input
                          id="profile-avatar-url"
                          className={`input ${styles.avatarInput}`}
                          type="url"
                          placeholder="https://example.com/avatar.jpg"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <div className={styles.field}>
                        <label htmlFor="profile-name" className={styles.label}>Display Name</label>
                        <input
                          id="profile-name"
                          className="input"
                          placeholder="Your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={100}
                        />
                      </div>

                      <div className={styles.field}>
                        <label htmlFor="profile-username" className={styles.label}>Username</label>
                        <div className={styles.usernameWrap}>
                          <span className={styles.usernameAt}>@</span>
                          <input
                            id="profile-username"
                            className={`input ${styles.usernameInput}`}
                            placeholder="your_username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                            maxLength={32}
                          />
                        </div>
                        <p className={styles.fieldHint}>3–32 characters. Letters, numbers, _ and - only.</p>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Email Address</label>
                        <input
                          className="input"
                          value={userData?.email ?? ''}
                          disabled
                          style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        />
                        <p className={styles.fieldHint}>Email cannot be changed. Contact support if needed.</p>
                      </div>
                    </div>

                    {profileMsg && (
                      <div className={`${styles.msg} ${profileMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                        {profileMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                        {profileMsg.text}
                      </div>
                    )}

                    <button
                      className={`btn btn-primary ${styles.saveBtn}`}
                      onClick={handleProfileSave}
                      disabled={isPendingProfile}
                      id="save-profile-btn"
                    >
                      {isPendingProfile ? <Loader2 size={14} className={styles.spinner} /> : <Check size={14} />}
                      Save Changes
                    </button>
                  </div>
                )}

                {/* ── SECURITY TAB ── */}
                {tab === 'security' && (
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Security</h2>
                    <p className={styles.sectionDesc}>
                      {userData?.hasPassword
                        ? 'Keep your account secure by using a strong, unique password.'
                        : 'You signed in with a magic link. Set a password below to enable password-based login.'}
                    </p>

                    {/* Info banner for first-time password setup */}
                    {!userData?.hasPassword && (
                      <div className={styles.infoCard}>
                        <div className={styles.infoIconWrap}>
                          <KeyRound size={18} />
                        </div>
                        <div>
                          <p className={styles.infoCardTitle}>No password set</p>
                          <p className={styles.infoCardDesc}>
                            Your account was created via magic link. Set a password below to also sign in with email + password.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className={styles.fieldGroup}>
                      {/* Only show current password field when user already has one */}
                      {userData?.hasPassword && (
                        <div className={styles.field}>
                          <label htmlFor="current-password" className={styles.label}>Current Password</label>
                          <div className={styles.passwordWrap}>
                            <input
                              id="current-password"
                              className={`input ${styles.passwordInput}`}
                              type={showCurrent ? 'text' : 'password'}
                              placeholder="Enter current password"
                              value={currentPw}
                              onChange={(e) => setCurrentPw(e.target.value)}
                              autoComplete="current-password"
                            />
                            <button type="button" className={styles.eyeBtn} onClick={() => setShowCurrent((v) => !v)}>
                              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className={styles.field}>
                        <label htmlFor="new-password" className={styles.label}>
                          {userData?.hasPassword ? 'New Password' : 'Create Password'}
                        </label>
                        <div className={styles.passwordWrap}>
                          <input
                            id="new-password"
                            className={`input ${styles.passwordInput}`}
                            type={showNew ? 'text' : 'password'}
                            placeholder="At least 8 characters"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            autoComplete="new-password"
                          />
                          <button type="button" className={styles.eyeBtn} onClick={() => setShowNew((v) => !v)}>
                            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {newPw && (
                          <div className={styles.strengthRow}>
                            <div className={styles.strengthBar}>
                              {[1, 2, 3, 4].map((n) => (
                                <div
                                  key={n}
                                  className={`${styles.strengthSegment} ${passwordStrength >= n ? strengthClass : ''}`}
                                />
                              ))}
                            </div>
                            <span className={`${styles.strengthLabel} ${strengthClass}`}>{strengthLabel}</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label htmlFor="confirm-password" className={styles.label}>Confirm Password</label>
                        <div className={styles.passwordWrap}>
                          <input
                            id="confirm-password"
                            className={`input ${styles.passwordInput} ${confirmPw && confirmPw !== newPw ? styles.inputError : ''}`}
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Repeat password"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            autoComplete="new-password"
                          />
                          <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm((v) => !v)}>
                            {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {confirmPw && confirmPw !== newPw && (
                          <p className={styles.fieldError}>Passwords do not match</p>
                        )}
                      </div>
                    </div>

                    {pwMsg && (
                      <div className={`${styles.msg} ${pwMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                        {pwMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                        {pwMsg.text}
                      </div>
                    )}

                    <button
                      className={`btn btn-primary ${styles.saveBtn}`}
                      onClick={handlePasswordChange}
                      disabled={isPendingPw || !newPw || newPw !== confirmPw || (userData?.hasPassword ? !currentPw : false)}
                      id="change-password-btn"
                    >
                      {isPendingPw ? <Loader2 size={14} className={styles.spinner} /> : <Lock size={14} />}
                      {userData?.hasPassword ? 'Update Password' : 'Set Password'}
                    </button>

                    {/* Forgot password / reset via magic link */}
                    {userData?.hasPassword && (
                      <>
                        <div className={styles.divider} />

                        <div className={styles.resetCard}>
                          <div className={styles.resetInfo}>
                            <div className={styles.resetIconWrap}>
                              <Mail size={18} />
                            </div>
                            <div>
                              <p className={styles.resetCardTitle}>Forgot your password?</p>
                              <p className={styles.resetCardDesc}>
                                We'll send a magic link to <strong>{userData.email}</strong>. Your current password will be cleared so you can sign in and set a new one.
                              </p>
                            </div>
                          </div>

                          {resetMsg && (
                            <div className={`${styles.msg} ${resetMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                              {resetMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                              {resetMsg.text}
                            </div>
                          )}

                          <button
                            className={`btn btn-ghost ${styles.resetBtn}`}
                            onClick={handleSendResetLink}
                            disabled={isPendingReset || resetLinkSent}
                            id="send-reset-link-btn"
                          >
                            {isPendingReset ? <Loader2 size={14} className={styles.spinner} /> : <Mail size={14} />}
                            {resetLinkSent ? 'Reset Link Sent — Check Email' : 'Send Password Reset Link'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── DANGER ZONE TAB ── */}
                {tab === 'danger' && (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Danger Zone</h2>
                    <p className={styles.sectionDesc}>These actions are permanent and cannot be undone.</p>

                    <div className={styles.dangerCard}>
                      <div className={styles.dangerInfo}>
                        <div className={styles.dangerIconWrap}>
                          <Trash2 size={20} />
                        </div>
                        <div>
                          <p className={styles.dangerCardTitle}>Delete Account</p>
                          <p className={styles.dangerCardDesc}>
                            Permanently delete your account and all associated data including boards, cards, and activity. This cannot be reversed.
                          </p>
                        </div>
                      </div>

                      <div className={styles.dangerConfirm}>
                        <label htmlFor="danger-confirm" className={styles.label}>
                          Type <strong>DELETE</strong> to confirm
                        </label>
                        <input
                          id="danger-confirm"
                          className={`input ${styles.dangerInput}`}
                          placeholder="DELETE"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                        />
                      </div>

                      {dangerMsg && (
                        <div className={`${styles.msg} ${dangerMsg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                          {dangerMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                          {dangerMsg.text}
                        </div>
                      )}

                      <button
                        className={`btn btn-danger ${styles.deleteBtn}`}
                        onClick={handleDeleteAccount}
                        disabled={isPendingDanger || confirmText !== 'DELETE'}
                        id="delete-account-btn"
                      >
                        {isPendingDanger ? <Loader2 size={14} className={styles.spinner} /> : <Trash2 size={14} />}
                        Delete My Account
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
