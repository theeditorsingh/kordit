import { useRef, useState, useCallback } from 'react';

interface Options {
  /** Pixels dragged down before onDismiss fires. Default: 80 */
  threshold?: number;
  onDismiss: () => void;
}

/**
 * Attaches swipe-down-to-dismiss touch handlers to a bottom sheet element.
 * Returns props to spread onto the sheet container and the current dragY value
 * so you can apply a translateY transform for visual feedback.
 */
export function useSwipeDown({ threshold = 80, onDismiss }: Options) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy); // only drag downward
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragY > threshold) {
      onDismiss();
    }
    setDragY(0);
    startY.current = null;
  }, [dragY, threshold, onDismiss]);

  const dragStyle: React.CSSProperties =
    dragY > 0
      ? {
          transform: `translateY(${dragY}px)`,
          opacity: Math.max(0.5, 1 - dragY / 300),
          transition: 'none',
        }
      : { transition: 'transform 0.3s ease, opacity 0.3s ease' };

  return { onTouchStart, onTouchMove, onTouchEnd, dragY, dragStyle };
}
