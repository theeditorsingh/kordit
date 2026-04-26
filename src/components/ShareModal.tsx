'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { X, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import styles from './ShareModal.module.css';

interface Props {
  onClose: () => void;
}

export default function ShareModal({ onClose }: Props) {
  const { data: session } = useSession();
  const { activeBoard, addMember, removeMember, dispatch } = useBoardContext();
  const [inviteText, setInviteText] = useState('');
  const [role, setRole] = useState<'Admin' | 'Member'>('Member');
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');

  if (!activeBoard) return null;

  const handleShare = () => {
    const email = inviteText.trim();
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address");
        return;
      }
      addMember(activeBoard.id, email, role);
      setInviteText('');
    }
  };

  const handleRoleChange = (memberId: string, newRole: 'Admin' | 'Member' | 'Remove') => {
    if (newRole === 'Remove') {
      removeMember(activeBoard.id, memberId);
    } else {
      dispatch({ type: 'UPDATE_MEMBER_ROLE', boardId: activeBoard.id, memberId, role: newRole });
    }
  };

  const filteredMembers = activeBoard.members.filter(m => session?.user?.id ? m.id !== session.user.id : true);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Share board</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.inviteSection}>
            <div className={styles.inputWrapper}>
              <input
                className={styles.input}
                placeholder="Email address or name"
                value={inviteText}
                onChange={(e) => setInviteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                autoFocus
              />
            </div>
            <select
              className={styles.roleSelect}
              value={role}
              onChange={(e) => setRole(e.target.value as 'Admin' | 'Member')}
            >
              <option value="Member">Member</option>
              <option value="Admin">Admin</option>
            </select>
            <button className={styles.shareBtn} onClick={handleShare}>
              Share
            </button>
          </div>

          <div className={styles.linkSection}>
            <div className={styles.linkIcon}>
              <LinkIcon size={16} />
            </div>
            <div className={styles.linkContent}>
              <span className={styles.linkTitle}>Share this board with a link</span>
              <button className={styles.createLink}>Create link</button>
            </div>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'members' ? styles.active : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Board members <span className={styles.badge}>{filteredMembers.length + 1}</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'requests' ? styles.active : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Join requests
            </button>
          </div>

          {activeTab === 'members' && (
            <div className={styles.memberList}>
              {/* Current User */}
              <div className={styles.memberItem}>
                <div className={styles.memberInfo}>
                  <div className={styles.avatar} style={{ backgroundColor: '#6554C0' }}>
                    {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className={styles.memberDetails}>
                    <span className={styles.memberName}>{session?.user?.name || 'User'} (you)</span>
                    <span className={styles.memberUsername}>
                      {session?.user?.username ? `@${session.user.username}` : session?.user?.email || ''} • Board admin
                    </span>
                  </div>
                </div>
                <div className={styles.memberRole}>
                  Admin <ChevronDown size={14} />
                </div>
              </div>

              {/* Invited Members */}
              {filteredMembers.map((member) => (
                <div className={styles.memberItem} key={member.id}>
                  <div className={styles.memberInfo}>
                    <div className={styles.avatar} style={{ backgroundColor: member.color }}>
                      {getInitials(member.name)}
                    </div>
                    <div className={styles.memberDetails}>
                      <span className={styles.memberName}>
                        {member.name}
                        {member.status === 'pending' && (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, padding: '2px 6px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                            Requested
                          </span>
                        )}
                      </span>
                      <span className={styles.memberUsername}>@{member.name.split('@')[0].toLowerCase().replace(/\s+/g, '')}</span>
                    </div>
                  </div>
                  <select
                    className={styles.roleSelect}
                    style={{ padding: '4px 8px', height: 'auto' }}
                    value={member.role || 'Member'}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as 'Admin' | 'Member' | 'Remove')}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Member">Member</option>
                    <option value="Remove">Remove from board</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          
          {activeTab === 'requests' && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              No pending requests.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
