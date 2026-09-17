import React, { useEffect, useRef } from 'react';

const HERO_BACKGROUND_URL = "/HERO_BG.png";


type HeroAtmosphereStyle = React.CSSProperties & {
  '--hero-pointer-x': string;
  '--hero-pointer-y': string;
  '--hero-grid-focus': string;
};

export function HeroAtmosphere() {
  const atmosphereRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = atmosphereRef.current;
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!element || !supportsHover) return;

    const renderPointer = () => {
      const current = atmosphereRef.current;
      if (!current) return;

      const rect = current.getBoundingClientRect();
      const { x, y } = pointerRef.current;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

      current.style.setProperty('--hero-grid-focus', inside ? '1' : '0');
      if (inside) {
        current.style.setProperty('--hero-pointer-x', `${x - rect.left}px`);
        current.style.setProperty('--hero-pointer-y', `${y - rect.top}px`);
      }
      frameRef.current = null;
    };

    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderPointer);
    };

    window.addEventListener('pointermove', trackPointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const style: HeroAtmosphereStyle = {
    '--hero-pointer-x': '50%',
    '--hero-pointer-y': '50%',
    '--hero-grid-focus': '0'
  };

  return (
    <div ref={atmosphereRef} className="hero-atmosphere" style={style} aria-hidden="true">
      <div className="hero-atmosphere__smoke" />
      <div className="hero-atmosphere__image-frame">
        <img src={HERO_BACKGROUND_URL} alt="" className="hero-atmosphere__image" />
      </div>
      <div className="hero-atmosphere__grid" />
      <div className="hero-atmosphere__grid hero-atmosphere__grid--focus" />
    </div>);

}