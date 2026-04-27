'use client';
import { useState } from 'react';
import { Board, Card } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { Calendar, CheckSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import dynamic from 'next/dynamic';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
const CardModal = dynamic(() => import('./CardModal'), { ssr: false });
import styles from './ListView.module.css';

interface Props { board: Board; search: string; }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function getDueDateClass(date: string | null) {
  if (!date) return '';
  const diff = (new Date(date).getTime() - Date.now()) / 86400000;
  if (diff < 0) return 'overdue';
  if (diff <= 2) return 'due-soon';
  return '';
}

export default function ListView({ board, search }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedCard, setSelectedCard] = useState<{ card: Card; colId: string } | null>(null);

  function toggle(colId: string) {
    setCollapsed((p) => ({ ...p, [colId]: !p[colId] }));
  }

  return (
    <div className={styles.listView}>
      {board.columns.map((col) => {
        const cards = col.cardIds
          .map((id) => board.cards[id])
          .filter(Boolean)
          .filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));
        const isCollapsed = collapsed[col.id];

        return (
          <div key={col.id} className={styles.group}>
            <button className={styles.groupHeader} onClick={() => toggle(col.id)}>
              <span className={styles.colDot} style={{ background: col.color }}/>
              <span className={styles.colTitle}>{col.title}</span>
              <span className={styles.colCount}>{cards.length}</span>
              {isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
            </button>

            {!isCollapsed && (
              <div className={styles.rows}>
                {cards.length === 0 ? (
                  <div className={styles.emptyRow}>No cards in this column</div>
                ) : (
                  <div style={{ height: Math.min(400, cards.length * 40), width: '100%' }}>
                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          height={height}
                          itemCount={cards.length}
                          itemSize={40}
                          width={width}
                          itemData={{ cards, board, colId: col.id }}
                        >
                          {({ index, style, data }) => {
                            const card = data.cards[index];
                            const done = card.checklist.filter((c: any) => c.done).length;
                            const total = card.checklist.length;
                            const assignees = card.assigneeIds.map((id: string) => data.board.members.find((m: any) => m.id === id)).filter(Boolean);
                            return (
                              <div style={style}>
                                <div className={styles.row} onClick={() => setSelectedCard({ card, colId: data.colId })}>
                                  <span className={`priority-dot dot-${card.priority}`}/>
                                  <span className={styles.rowTitle}>{card.title}</span>
                                  <div className={styles.rowMeta}>
                                    {card.labels.slice(0, 2).map((l: any) => (
                                      <span key={l.id} className="card-chip" style={{ background: l.color, fontSize: 10 }}>{l.name}</span>
                                    ))}
                                    {card.dueDate && (
                                      <span className={`${styles.metaItem} ${getDueDateClass(card.dueDate)}`}>
                                        <Calendar size={11}/>{formatDate(card.dueDate)}
                                      </span>
                                    )}
                                    {total > 0 && (
                                      <span className={`${styles.metaItem} ${done === total ? styles.allDone : ''}`}>
                                        <CheckSquare size={11}/>{done}/{total}
                                      </span>
                                    )}
                                    {assignees.map((m: any) => (
                                      <span key={m!.id} className="avatar avatar-sm" style={{ background: m!.color }}>{getInitials(m!.name)}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {selectedCard && (
        <CardModal
          card={selectedCard.card}
          board={board}
          columnId={selectedCard.colId}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
