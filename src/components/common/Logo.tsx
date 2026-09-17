import React from 'react';
import { useContent } from '../../lib/db/hooks';

const MAIN_LOGO_URL = "/LOGO_PNG_FINAL.png";

const CIRCLE_LOGO_URL = "/FINAL-CIRCLE-LOGO.png";


interface LogoProps {
  size?: number | 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'main' | 'circle';
  className?: string;
}

export function Logo({
  size,
  showText = true,
  variant = 'main',
  className = ''
}: LogoProps) {
  const mainLogoUrl = useContent('brand.logoUrl', MAIN_LOGO_URL);
  const circleLogoUrl = useContent('brand.circleLogoUrl', CIRCLE_LOGO_URL);
  const name = useContent('brand.name', 'BULLER TRADING');
  const subtitle = useContent('brand.subtitle', 'SYED AZHAAD HUSSAIN');
  const persistedSize = Number(useContent('brand.logoSize', '52'));
  const legacySizes = { sm: 36, md: 48, lg: 68 };
  const requestedSize =
  typeof size === 'number' ?
  size :
  typeof size === 'string' ?
  legacySizes[size] :
  persistedSize;
  const pixelSize = Math.min(240, Math.max(28, requestedSize || 52));
  const source = variant === 'circle' ? circleLogoUrl : mainLogoUrl;

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <img
        src={source || (variant === 'circle' ? CIRCLE_LOGO_URL : MAIN_LOGO_URL)}
        alt={`${name} ${variant === 'circle' ? 'circular ' : ''}logo`}
        width={pixelSize}
        height={pixelSize}
        className="shrink-0 object-contain"
        style={{ width: pixelSize, height: pixelSize }} />
      
      {showText &&
      <div className="logo-copy min-w-0 leading-tight">
          <div className="truncate text-sm font-bold tracking-[0.12em] text-ink sm:text-base">
            {name}
          </div>
          {subtitle &&
        <div className="truncate text-[9px] uppercase tracking-[0.18em] text-brand sm:text-[10px]">
              {subtitle}
            </div>
        }
        </div>
      }
    </div>);

}