"use client";
import { useRef } from "react";

/**
 * Detects horizontal swipe gestures.
 * onSwipeLeft  → user swiped left  (→ next day/month)
 * onSwipeRight → user swiped right (→ prev day/month)
 * Ignores near-vertical touches (dy > 60px).
 */
export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void
) {
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = startX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(startY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 60 && dy < 60) {
      if (dx > 0) onSwipeLeft();
      else onSwipeRight();
    }
  };

  return { onTouchStart, onTouchEnd };
}
