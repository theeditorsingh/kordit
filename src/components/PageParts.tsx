'use client';
/** Small pieces shared by Home, My Tasks and workspace pages. */
import Link from 'next/link';
import { Calendar, Circle, Plus, Star } from 'lucide-react';
import type { Board, Workspace } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { getBoardBackgroundStyle } from '@/utils/boardBackground';
import { getDueDateClass, formatDate } from '@/utils/dates';
import { boardHref, type AssignedCard } from '@/utils/myTasks';
import { workspaceInitial, workspaceTileColor } from '@/utils/workspaceTile';
import styles from './Pages.module.css';

/** One assigned task: tick to complete, click to open it on its board. */
export function TaskRow({ item, username }: { item: AssignedCard; username?: string | null }) {
  const { updateCard } = useBoardContext();
  const { card, board, column } = item;
  const href = boardHref(board, username, card.id);
  function complete() {
    const completedAt = new Date().toISOString();
    updateCard(board.id, { ...card, completedAt }, { completedAt });
  }
  const main = (
    <>
      <span className={styles.rowTitle}>{card.title}</span>
      <span className={styles.rowMeta}>
        <span className={styles.dot} style={{ background: column.color }} aria-hidden="true" />
        {board.title} · {column.title}
      </span>
    </>
  );
  return (
    <div className={styles.row}>
      <button className={styles.tick} onClick={complete} title="Mark completed" aria-label={`Mark "${card.title}" completed`}>
        <Circle size={18} />
      </button>
      {href ? <Link href={href} className={styles.rowMain}>{main}</Link> : <div className={styles.rowMain}>{main}</div>}
      {card.dueDate && (
        <span className={`${styles.due} ${getDueDateClass(card.dueDate)}`}>
          <Calendar size={13} /> {formatDate(card.dueDate)}
        </span>
      )}
    </div>
  );
}

function openCount(board: Board) {
  return board.columns.reduce((n, col) => n + col.cardIds.filter((id) => board.cards[id] && !board.cards[id].completedAt).length, 0);
}

export function BoardTile({ board, username }: { board: Board; username?: string | null }) {
  const href = boardHref(board, username) ?? '/';
  const bg = getBoardBackgroundStyle(board);
  const count = openCount(board);
  return (
    <Link href={href} className={styles.boardTile} style={Object.keys(bg).length ? bg : { background: board.color || '#0052CC' }}>
      {board.isFavorite && <Star size={14} className={styles.boardTileStar} aria-label="Favourite" />}
      <span className={styles.boardTileTitle}>{board.title}</span>
      <span className={styles.boardTileMeta}>{count} open task{count === 1 ? '' : 's'}</span>
    </Link>
  );
}

export function WorkspaceBadge({ name, large }: { name: string; large?: boolean }) {
  return (
    <span className={`${styles.wsBadge} ${large ? styles.wsBadgeLarge : ''}`} style={{ background: workspaceTileColor(name) }} aria-hidden="true">
      {workspaceInitial(name)}
    </span>
  );
}

export function WorkspaceTile({ workspace }: { workspace: Workspace }) {
  return (
    <Link href={`/workspaces/${workspace.slug}`} className={styles.wsTile}>
      <WorkspaceBadge name={workspace.name} />
      <span style={{ minWidth: 0 }}>
        <span className={styles.wsName} style={{ display: 'block' }}>{workspace.name}</span>
        <span className={styles.wsMeta} style={{ display: 'block' }}>
          {workspace.boardCount} board{workspace.boardCount === 1 ? '' : 's'} · {workspace.memberCount} member{workspace.memberCount === 1 ? '' : 's'}
        </span>
      </span>
    </Link>
  );
}

export function NewWorkspaceTile({ onClick }: { onClick: () => void }) {
  return (
    <button className={`${styles.wsTile} ${styles.wsTileNew}`} onClick={onClick}>
      <Plus size={16} /> New workspace
    </button>
  );
}
