'use client';
import { useState } from 'react';
import { Board, Card } from '@/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CardModal from './CardModal';
import styles from './CalendarView.module.css';

interface Props { board: Board; }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarView({ board }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedCard, setSelectedCard] = useState<{ card: Card; colId: string } | null>(null);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Map cards to days
  const cardsByDay: Record<number, { card: Card; colId: string }[]> = {};
  board.columns.forEach((col) => {
    col.cardIds.forEach((id) => {
      const card = board.cards[id];
      if (!card?.dueDate) return;
      const d = new Date(card.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!cardsByDay[day]) cardsByDay[day] = [];
        cardsByDay[day].push({ card, colId: col.id });
      }
    });
  });

  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className={styles.calView}>
      <div className={styles.calHeader}>
        <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18}/></button>
        <h2 className={styles.monthTitle}>{MONTHS[month]} {year}</h2>
        <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18}/></button>
      </div>

      <div className={styles.grid}>
        {DAYS.map((d) => (
          <div key={d} className={styles.dayLabel}>{d}</div>
        ))}

        {cells.map((day, i) => (
          <div key={i} className={`${styles.cell} ${day ? '' : styles.empty} ${day && isToday(day) ? styles.today : ''}`}>
            {day && (
              <>
                <span className={styles.dayNum}>{day}</span>
                <div className={styles.cellCards}>
                  {(cardsByDay[day] || []).map(({ card, colId }) => {
                    const col = board.columns.find((c) => c.id === colId);
                    return (
                      <button
                        key={card.id}
                        className={styles.calCard}
                        style={{ borderLeft: `3px solid ${col?.color ?? '#0052CC'}` }}
                        onClick={() => setSelectedCard({ card, colId })}
                        title={card.title}
                      >
                        <span className={`priority-dot dot-${card.priority}`} style={{ width: 6, height: 6 }}/>
                        <span className={styles.calCardTitle}>{card.title}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

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
