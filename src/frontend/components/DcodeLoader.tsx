import React from 'react';

interface DcodeLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const DcodeLoader: React.FC<DcodeLoaderProps> = ({ size = 'md', text = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-6 h-6 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  return (
    <div className="flex items-center space-x-2.5 text-zinc-300 font-mono">
      {/* Unique Futuristic Dcode Quantum Pulse Ring */}
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        {/* Outer glowing pulsing orb */}
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-25"></span>
        
        {/* Dual spinning holographic arcs */}
        <div className="w-full h-full rounded-full border-2 border-transparent border-t-blue-500 border-r-cyan-400 animate-spin" />
        <div className="absolute w-3/4 h-3/4 rounded-full border border-transparent border-b-indigo-400 border-l-blue-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
        
        {/* Center core pulse */}
        <div className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_#3b82f6] animate-pulse" />
      </div>

      {text && (
        <span className="text-xs text-zinc-300 font-sans tracking-wide animate-pulse">
          {text}
        </span>
      )}
    </div>
  );
};
