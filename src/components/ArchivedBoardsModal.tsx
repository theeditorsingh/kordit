'use client';
import { useEffect, useState } from 'react';
import { X, ArrowLeft, ArchiveRestore, Loader2 } from 'lucide-react';
import { getArchivedBoardsAction, unarchiveBoardAction } from '@/actions/boardActions';
import styles from './ArchivedBoardsModal.module.css';
import { Board } from '@/types';

interface Props {
  onClose: () => void;
}

export default function ArchivedBoardsModal({ onClose }: Props) {
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBoards() {
      try {
        const data = await getArchivedBoardsAction();
        setBoards(data);
      } catch (error) {
        console.error("Failed to load archived boards", error);
      } finally {
        setLoading(false);
      }
    }
    loadBoards();
  }, []);

  const handleRestore = async (boardId: string) => {
    setRestoringId(boardId);
    try {
      await unarchiveBoardAction(boardId);
      setBoards(prev => prev.filter(b => b.id !== boardId));
    } catch (error) {
      console.error("Failed to unarchive board", error);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>
            <button className={styles.closeBtn} style={{ marginRight: 8 }} onClick={onClose}>
              <ArrowLeft size={16} />
            </button>
            Archived Boards
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <Loader2 className="animate-spin" size={24} color="var(--text-muted)" />
            </div>
          ) : boards.length === 0 ? (
            <div className={styles.emptyState}>
              No archived boards found.
            </div>
          ) : (
            <div className={styles.boardList}>
              {boards.map((board) => (
                <div key={board.id} className={styles.boardItem}>
                  <div className={styles.boardInfo}>
                    <div 
                      className={styles.boardIcon} 
                      style={{ 
                        backgroundColor: board.backgroundType === 'color' ? board.background : board.color,
                        backgroundImage: board.backgroundType === 'image' ? `url(${board.background})` : 'none'
                      }} 
                    />
                    <span className={styles.boardTitle}>{board.title}</span>
                  </div>
                  <button 
                    className={styles.restoreBtn} 
                    onClick={() => handleRestore(board.id)}
                    disabled={restoringId === board.id}
                  >
                    {restoringId === board.id ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <ArchiveRestore size={14} />
                    )}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
