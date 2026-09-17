import React from 'react';
import { Logo } from './Logo';

interface HeroLogoWatermarkProps {
  className?: string;
  size?: 'default' | 'large';
}

export function HeroLogoWatermark({
  className = '',
  size = 'default'
}: HeroLogoWatermarkProps) {
  return (
    <div
      className={`hero-logo-watermark pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${size === 'large' ? 'hero-logo-watermark--large' : ''} ${className}`}
      aria-hidden="true">
      
      <div className="hero-logo-watermark__mark">
        <div className="hero-logo-watermark__logo">
          <Logo variant="circle" size={240} showText={false} />
        </div>
      </div>
    </div>);

}