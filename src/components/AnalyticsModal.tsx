'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Clock3, LayoutGrid, Loader2, MoveRight, Plus, X } from 'lucide-react';
import styles from './WorkspaceModal.module.css';

type Analytics = {
  days: number;
  series: Array<{ day: string; created: number; moved: number; completed: number }>;
  totals: { boards: number; created: number; moved: number; completed: number; overdue: number; completionRate: number };
  boards: Array<{ id: string; title: string; total: number; completed: number; overdue: number; rate: number }>;
};

export default function AnalyticsModal({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/analytics?days=${days}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((value) => { if (active) setData(value); });
    return () => { active = false; };
  }, [days]);

  const max = useMemo(() => Math.max(1, ...(data?.series.map((row) => row.created + row.moved + row.completed) ?? [1])), [data]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${styles.modal}`} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div><h2><BarChart3 size={20} /> Team analytics</h2><p>Throughput and completion across boards you can access.</p></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close analytics"><X size={18} /></button>
        </header>
        <div className={styles.toolbar}>
          <div className={styles.segmented}>{[7, 30, 90].map((value) => <button key={value} className={days === value ? styles.segmentActive : ''} onClick={() => { setData(null); setDays(value); }}>{value} days</button>)}</div>
        </div>
        {!data ? <div className={styles.loading}><Loader2 className={styles.spin} /> Loading analytics…</div> : (
          <div className={styles.content}>
            <div className={styles.stats}>
              {[
                { label: 'Boards', value: data.totals.boards, icon: <LayoutGrid size={16} /> },
                { label: 'Cards created', value: data.totals.created, icon: <Plus size={16} /> },
                { label: 'Moves', value: data.totals.moved, icon: <MoveRight size={16} /> },
                { label: 'Completed', value: data.totals.completed, icon: <CheckCircle2 size={16} /> },
                { label: 'Overdue now', value: data.totals.overdue, icon: <Clock3 size={16} /> },
                { label: 'All-time complete', value: `${data.totals.completionRate}%`, icon: <BarChart3 size={16} /> },
              ].map((stat) => <div className={styles.stat} key={stat.label}><span>{stat.icon}{stat.label}</span><strong>{stat.value}</strong></div>)}
            </div>

            <section className={styles.section}>
              <h3>Daily activity</h3>
              <div className={styles.chart}>
                {data.series.map((row, index) => (
                  <div className={styles.chartColumn} key={row.day} title={`${row.day}: ${row.created} created, ${row.moved} moved, ${row.completed} completed`}>
                    <div className={styles.barStack} style={{ height: `${Math.max(4, ((row.created + row.moved + row.completed) / max) * 100)}%` }}>
                      <span style={{ flex: row.completed, background: '#36B37E' }} />
                      <span style={{ flex: row.moved, background: '#6554C0' }} />
                      <span style={{ flex: row.created, background: '#0052CC' }} />
                    </div>
                    {(index === 0 || index === data.series.length - 1 || index % Math.ceil(data.series.length / 6) === 0) && <small>{new Date(`${row.day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>}
                  </div>
                ))}
              </div>
              <div className={styles.legend}><span><i style={{ background: '#0052CC' }} />Created</span><span><i style={{ background: '#6554C0' }} />Moved</span><span><i style={{ background: '#36B37E' }} />Completed</span></div>
            </section>

            <section className={styles.section}>
              <h3>Board completion</h3>
              <div className={styles.boardList}>{data.boards.map((board) => <div key={board.id} className={styles.boardRow}><div><b>{board.title}</b><span>{board.completed}/{board.total} completed · {board.overdue} overdue</span></div><div className={styles.progress}><span style={{ width: `${board.rate}%` }} /></div><strong>{board.rate}%</strong></div>)}</div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
