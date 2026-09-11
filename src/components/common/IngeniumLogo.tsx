import React from 'react';
import { BrandLogo, BrandLogoProps, BrandLogoSize } from './BrandLogo';

export { BrandLogo };
export type { BrandLogoProps, BrandLogoSize };

export interface IngeniumLogoProps extends BrandLogoProps {
  showSubtitle?: boolean;
}

/**
 * Backward-compatible icon export that delegates directly to the official BrandLogo.
 */
export const IngeniumLeafIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = "", 
  size = 24 
}) => {
  return (
    <BrandLogo 
      size={size} 
      className={className} 
      iconOnly={true} 
      alt="Ingenium Tech Academy Logo Icon"
    />
  );
};

/**
 * Backward-compatible IngeniumLogo export that delegates directly to the official BrandLogo.
 */
export const IngeniumLogo: React.FC<IngeniumLogoProps> = ({
  className = "",
  showText = true,
  showSubtitle = true,
  size = 'md',
  variant = 'dark',
  ...rest
}) => {
  return (
    <BrandLogo
      className={className}
      showText={showText}
      showSubtitle={showSubtitle}
      size={size}
      variant={variant}
      {...rest}
    />
  );
};

export default BrandLogo;

