'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './OnboardingTour.module.css';

const TOUR_KEY = 'kordit_tour_done';

const STEPS = [
  {
    title: '👋 Welcome to Kordit!',
    description: "Let's take a quick 2-minute tour to get you up to speed with all the features.",
    targetId: null,
  },
  {
    title: '📋 Your Boards',
    description: 'The sidebar shows all your boards. Click any board to open it, or use the + button to create a new one.',
    targetId: 'sidebar-boards-section',
  },
  {
    title: '➕ Create a Board',
    description: 'Click "New Board" to create a board from scratch or pick from templates.',
    targetId: 'btn-new-board',
  },
  {
    title: '📊 Board Views',
    description: 'Switch between Kanban board, List view, and Calendar view using the tabs in the top nav.',
    targetId: 'view-switcher',
  },
  {
    title: '🃏 Cards',
    description: 'Click any card to open it. You can set priority, due dates, assignees, labels, checklists, and more.',
    targetId: null,
  },
  {
    title: '🤖 AI Features',
    description: 'Inside a card, use AI to auto-generate subtasks, get smart due-date suggestions, and auto-categorize your task — all powered by Llama AI.',
    targetId: null,
  },
  {
    title: '↩️ Undo / Redo',
    description: 'Made a mistake? Press Ctrl+Z to undo and Ctrl+Shift+Z to redo any action on your board.',
    targetId: null,
  },
  {
    title: '🎉 You\'re all set!',
    description: 'You now know the key features of Kordit. Explore, drag cards around, and build something great!',
    targetId: null,
  },
];

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Auto-start for new users (no localStorage flag)
    if (typeof window !== 'undefined' && !localStorage.getItem(TOUR_KEY)) {
      // Small delay so the page renders first
      const t = setTimeout(() => setActive(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const updateTarget = useCallback(() => {
    const id = STEPS[step]?.targetId;
    if (id) {
      const el = document.getElementById(id);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        return;
      }
    }
    setTargetRect(null);
  }, [step]);

  useEffect(() => {
    if (active) {
      updateTarget();
      window.addEventListener('resize', updateTarget);
      return () => window.removeEventListener('resize', updateTarget);
    }
  }, [active, updateTarget]);

  const finish = () => {
    setActive(false);
    localStorage.setItem(TOUR_KEY, '1');
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!active) return null;

  const currentStep = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={finish} />

      {/* Spotlight highlight */}
      {targetRect && (
        <div
          className={styles.spotlight}
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tooltip card */}
      <div className={styles.tooltip}>
        {/* Step indicators */}
        <div className={styles.dots}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className={styles.body}>
          <h3 className={styles.title}>{currentStep.title}</h3>
          <p className={styles.description}>{currentStep.description}</p>
        </div>

        <div className={styles.actions}>
          <button className={`btn btn-ghost btn-sm`} onClick={finish}>
            Skip tour
          </button>
          <div className={styles.navBtns}>
            {step > 0 && (
              <button className={`btn btn-ghost btn-sm`} onClick={prev}>← Back</button>
            )}
            <button className={`btn btn-primary btn-sm`} onClick={next} id="tour-next-btn">
              {step === STEPS.length - 1 ? "Let's go! 🚀" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
