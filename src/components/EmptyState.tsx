'use client';
import React from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  variant: 'no-boards' | 'no-cards' | 'no-results' | 'no-activity' | 'no-members';
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const illustrations = {
  'no-boards': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="20" width="20" height="48" rx="4" fill="currentColor" opacity="0.15"/>
      <rect x="8" y="20" width="20" height="48" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
      <rect x="33" y="12" width="20" height="56" rx="4" fill="currentColor" opacity="0.25"/>
      <rect x="33" y="12" width="20" height="56" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.6"/>
      <rect x="58" y="28" width="20" height="40" rx="4" fill="currentColor" opacity="0.15"/>
      <rect x="58" y="28" width="20" height="40" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
      <circle cx="58" cy="10" r="6" fill="#0052CC" opacity="0.8"/>
      <path d="M55 10l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'no-cards': (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="16" width="48" height="32" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" opacity="0.4"/>
      <path d="M32 26v12M26 32h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  'no-results': (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="18" stroke="currentColor" strokeWidth="2.5" opacity="0.4"/>
      <path d="M43 43l14 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
      <path d="M24 30h12M30 24v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  'no-activity': (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="8" width="40" height="48" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <line x1="20" y1="22" x2="44" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
      <line x1="20" y1="30" x2="38" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
      <line x1="20" y1="38" x2="32" y2="38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  'no-members': (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="24" r="10" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
      <path d="M10 52c0-10 8-18 18-18s18 8 18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      <path d="M48 28v12M54 34H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
};

const defaults = {
  'no-boards': { title: 'No boards yet', description: 'Create your first board to start organizing your work.' },
  'no-cards': { title: 'No cards here', description: 'Add a card to get started with this column.' },
  'no-results': { title: 'Nothing found', description: 'Try adjusting your search or filter to find what you\'re looking for.' },
  'no-activity': { title: 'No activity yet', description: 'Actions on this board will appear here.' },
  'no-members': { title: 'No members yet', description: 'Invite teammates to collaborate on this board.' },
};

export default function EmptyState({ variant, title, action }: EmptyStateProps) {
  const d = defaults[variant];
  return (
    <div className={styles.root}>
      <div className={styles.illustration}>{illustrations[variant]}</div>
      <h3 className={styles.title}>{title || d.title}</h3>
      <p className={styles.desc}>{d.description}</p>
      {action && (
        <button className={`btn btn-primary btn-sm ${styles.cta}`} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
