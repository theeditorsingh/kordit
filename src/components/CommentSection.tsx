'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Comment } from '@/types';
import { addCommentAction, deleteCommentAction } from '@/actions/boardActions';
import { getInitials } from '@/utils/storage';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import styles from './CommentSection.module.css';

interface Props {
  boardId: string;
  cardId: string;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommentSection({ boardId, cardId }: Props) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchComments() {
      try {
        const res = await fetch(`/api/comments?cardId=${cardId}&boardId=${boardId}`);
        if (res.ok) setComments(await res.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    fetchComments();
  }, [cardId, boardId]);

  async function handleSubmit() {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const raw = await addCommentAction(boardId, cardId, newComment.trim());
      const comment: Comment = {
        id: raw.id,
        content: raw.content,
        createdAt: new Date(raw.createdAt).toISOString(),
        updatedAt: new Date(raw.updatedAt).toISOString(),
        cardId: raw.cardId,
        userId: raw.userId,
        user: raw.user ? {
          name: raw.user.name || '',
          username: raw.user.username || '',
          image: raw.user.image || undefined,
        } : undefined,
      };
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (e) {
      console.error("Failed to add comment", e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteCommentAction(boardId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error("Failed to delete comment", e);
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <MessageSquare size={14} />
        <span>Comments</span>
        {comments.length > 0 && <span className={styles.count}>{comments.length}</span>}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading comments...</div>
      ) : (
        <div className={styles.list}>
          {comments.map((comment) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.avatar} style={{ background: '#0052CC' }}>
                {getInitials(comment.user?.name || comment.user?.username || 'U')}
              </div>
              <div className={styles.commentBody}>
                <div className={styles.commentMeta}>
                  <span className={styles.commentAuthor}>
                    {comment.user?.name || comment.user?.username || 'User'}
                  </span>
                  <span className={styles.commentTime}>{timeAgo(comment.createdAt)}</span>
                  {session?.user?.id === comment.userId && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(comment.id)}
                      title="Delete comment"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div className={styles.commentText}>{comment.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
