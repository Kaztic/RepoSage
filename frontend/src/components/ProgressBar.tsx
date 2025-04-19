import React from 'react';

type ProgressBarProps = {
  progress: number;
};

export default function ProgressBar({ progress }: ProgressBarProps) {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className="w-full bg-surface-700/50 rounded-full h-2 overflow-hidden">
      <div 
        className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-in-out shadow-subtle"
        style={{ width: `${normalizedProgress}%` }}
        role="progressbar"
        aria-valuenow={normalizedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      ></div>
    </div>
  );
} 