'use client';

import { useState, useEffect } from 'react';

const EMOTIONS = [
  '😊', // Happy
  '🤔', // Thinking
  '😲', // Surprised
  '😎', // Cool
  '🥳', // Party
  '🙃', // Upside down
  '😴', // Sleepy
  '🤫', // Shushing
  '🤓', // Nerd
];

export default function Mascot() {
  const [emotionIndex, setEmotionIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Only change randomly if not hovered
    if (isHovered) return;

    const interval = setInterval(() => {
      setEmotionIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * EMOTIONS.length);
        } while (next === prev);
        return next;
      });
    }, 4000); // Change emotion every 4 seconds

    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setEmotionIndex(0); // Reset to happy when mouse leaves
      }}
      style={{
        position: 'fixed',
        bottom: '40px',
        right: '40px',
        fontSize: '80px', // Big 2D Emoji style
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        animation: 'float 4s infinite ease-in-out',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 50,
        transform: isHovered ? 'scale(1.2) rotate(10deg)' : 'scale(1)',
        filter: isHovered ? 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
      }}
      title="I'm just hanging out!"
    >
      {isHovered ? '🤩' : EMOTIONS[emotionIndex]}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-15px) rotate(-5deg); }
          66% { transform: translateY(-5px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
