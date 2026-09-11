import React from 'react';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface BrandLogoProps {
  /** Size preset ('xs' | 'sm' | 'md' | 'lg' | 'xl') or pixel number */
  size?: BrandLogoSize;
  /** Custom width if required; aspect ratio is strictly preserved */
  width?: number | string;
  /** Custom height if required; aspect ratio is strictly preserved */
  height?: number | string;
  /** Optional class name applied to container */
  className?: string;
  /** Optional class name applied to the logo image/svg directly */
  imageClassName?: string;
  /** Whether to show the official "Ingenium Tech Academy" wordmark alongside the symbol */
  showText?: boolean;
  /** Whether to show the subtitle "Tech Academy" when text is visible */
  showSubtitle?: boolean;
  /** Text color variant for dark or light backgrounds */
  variant?: 'dark' | 'light';
  /** Alternative text for accessibility */
  alt?: string;
  /** If true, renders purely the logo icon with no text wrapper */
  iconOnly?: boolean;
}

/**
 * Standard pixel sizing map for the official Ingenium Tech Academy logo mark.
 * The aspect ratio is strictly 1:1, preserving authentic brand proportions.
 */
const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 64,
  xl: 96,
};

/**
 * Official Ingenium Tech Academy Brand Logo Component.
 * 
 * Sourced directly from /public/IngeniumTechAcademyLogo.svg.
 * Preserves 100% transparent background, authentic colors, and strict aspect ratio.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  width,
  height,
  className = '',
  imageClassName = '',
  showText = false,
  showSubtitle = true,
  variant = 'dark',
  alt = 'Ingenium Tech Academy Official Logo',
  iconOnly = false
}) => {
  // Resolve dimension in pixels
  const numericDimension = typeof size === 'number' 
    ? size 
    : SIZE_MAP[size] || SIZE_MAP.md;

  const styleDimensions: React.CSSProperties = {
    width: width ?? numericDimension,
    height: height ?? (width ? 'auto' : numericDimension),
    aspectRatio: '1 / 1'
  };

  const isDarkText = variant === 'dark';

  // SVG Image Asset Element (Official /public/IngeniumTechAcademyLogo.svg)
  const LogoAsset = (
    <img
      src="/IngeniumTechAcademyLogo.svg"
      alt={alt}
      style={styleDimensions}
      className={`shrink-0 object-contain select-none pointer-events-none transition-transform ${imageClassName}`}
      loading="eager"
      decoding="async"
    />
  );

  if (iconOnly || !showText) {
    if (!className) return LogoAsset;
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {LogoAsset}
      </div>
    );
  }

  // With official brand typography
  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      {LogoAsset}
      <div className="flex flex-col leading-tight select-none">
        <span
          className={`font-black tracking-tight ${
            numericDimension <= 24
              ? 'text-xs'
              : numericDimension <= 36
              ? 'text-sm'
              : numericDimension <= 50
              ? 'text-base'
              : 'text-xl'
          } ${isDarkText ? 'text-zinc-900' : 'text-white'}`}
        >
          INGENIUM
        </span>
        {showSubtitle && (
          <span
            className={`font-semibold uppercase tracking-wider ${
              numericDimension <= 24
                ? 'text-[8px]'
                : numericDimension <= 36
                ? 'text-[10px]'
                : 'text-xs'
            } ${isDarkText ? 'text-[#0A9D8F]' : 'text-[#56C7BB]'}`}
          >
            Tech Academy
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
