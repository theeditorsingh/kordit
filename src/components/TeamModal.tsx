'use client';

import { useState } from 'react';
import { Users, X } from 'lucide-react';
import WorkspaceMembers from './WorkspaceMembers';
import styles from './WorkspaceModal.module.css';

export default function TeamModal({ onClose, workspaceId }: { onClose: () => void; workspaceId?: string }) {
  const [name, setName] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${styles.modal}`} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div><h2><Users size={20} /> {name || 'Your workspace'}</h2><p>Manage teammates and invitation status in one place.</p></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close team management"><X size={18} /></button>
        </header>
        <WorkspaceMembers workspaceId={workspaceId} onLoaded={(data) => setName(data.workspace.name)} />
      </div>
    </div>
  );
}
