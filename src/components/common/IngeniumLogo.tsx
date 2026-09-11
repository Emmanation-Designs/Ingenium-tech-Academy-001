import React from 'react';

interface IngeniumLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
}

export const IngeniumLeafIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = "w-6 h-6 text-[#0A9D8F]", 
  size = 24 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left Leaf */}
      <path 
        d="M8.5 24C8.5 24 7 15 15.5 10C15.5 10 13.5 18 8.5 24Z" 
        fill="currentColor" 
      />
      {/* Right Leaf */}
      <path 
        d="M23.5 24C23.5 24 25 13 16 7C16 7 17.5 16 23.5 24Z" 
        fill="currentColor" 
      />
      {/* Base stem */}
      <path 
        d="M16 11V26" 
        stroke="currentColor" 
        strokeWidth="2.2" 
        strokeLinecap="round" 
      />
    </svg>
  );
};

export const IngeniumLogo: React.FC<IngeniumLogoProps> = ({
  className = "",
  showText = true,
  size = 'md',
  variant = 'dark'
}) => {
  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 36 : 26;
  const isDarkText = variant === 'dark';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="shrink-0 text-[#0A9D8F] flex items-center justify-center">
        <IngeniumLeafIcon size={iconSize} className="text-[#0A9D8F]" />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-bold tracking-tight ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm'} ${isDarkText ? 'text-zinc-900' : 'text-white'}`}>
            Ingenium
          </span>
          <span className={`text-[10px] font-medium tracking-wide ${isDarkText ? 'text-zinc-500' : 'text-zinc-300'}`}>
            Tech Academy
          </span>
        </div>
      )}
    </div>
  );
};
