import React from 'react';

interface HumanLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textColor?: string;
}

export const HumanLogo: React.FC<HumanLogoProps> = ({ 
  size = 32, 
  className = '', 
  showText = false,
  textColor = 'var(--mc-text)'
}) => {
  return (
    <div className={`mc-human-logo-container ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-3)' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Soft Ambient Organic Backdrop */}
        <rect width="48" height="48" rx="14" fill="var(--mc-accent-light)" />
        
        {/* Interlocking Human Warmth & Empathy Leaves/Hands */}
        <path 
          d="M24 14C20 8 13 10 13 18C13 25 24 34 24 34C24 34 35 25 35 18C35 10 28 8 24 14Z" 
          fill="var(--mc-accent)" 
          opacity="0.9"
        />
        <path 
          d="M24 20C22 16 17 17 17 22C17 26.5 24 32 24 32C24 32 31 26.5 31 22C31 17 26 16 24 20Z" 
          fill="var(--mc-bg-card)" 
          opacity="0.95"
        />
        {/* Gentle Living Core */}
        <circle cx="24" cy="22" r="3.5" fill="var(--mc-accent)" />
      </svg>
      {showText && (
        <span style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 'var(--text-lg)', 
          fontWeight: 600, 
          color: textColor,
          letterSpacing: '-0.02em'
        }}>
          MindCare
        </span>
      )}
    </div>
  );
};
