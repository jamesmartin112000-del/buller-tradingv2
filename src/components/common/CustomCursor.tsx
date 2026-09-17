import React, { useEffect, useRef } from 'react';
/**
 * CustomCursor — a refined, minimal red cursor rendered globally.
 *
 * Design goals (deliberately understated / professional):
 *  - A tiny solid red dot that tracks the pointer precisely.
 *  - A thin, low-opacity ring that follows with a slight lag.
 *  - Very subtle glow — just enough to read on any background, never neon.
 *  - Gentle hover expansion over interactive elements; soft click feedback.
 *  - No particle trail (removed for a clean, non-busy feel).
 *  - Auto-disabled on touch devices — the native cursor is kept there.
 *
 * Performance: two GPU-accelerated nodes (translate3d), will-change, and a
 * single rAF loop. No libraries.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    // Bail out on touch / coarse-pointer devices — keep the native cursor.
    const isTouch =
    typeof window !== 'undefined' && (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0);
    if (isTouch) return;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    document.body.classList.add('mp-custom-cursor-active');
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
    const dot = {
      x: mouse.x,
      y: mouse.y
    };
    const ring = {
      x: mouse.x,
      y: mouse.y
    };
    let hovering = false;
    let pressed = false;
    let visible = false;
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!visible) {
        visible = true;
        if (dotRef.current) dotRef.current.style.opacity = '1';
        if (ringRef.current) ringRef.current.style.opacity = '1';
      }
    };
    const interactiveSelector =
    'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor="hover"], .cursor-hover';
    const onOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      hovering = !!(target && target.closest?.(interactiveSelector));
    };
    const onDown = () => {
      pressed = true;
    };
    const onUp = () => {
      pressed = false;
    };
    const onLeave = () => {
      visible = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };
    window.addEventListener('mousemove', onMove, {
      passive: true
    });
    window.addEventListener('mouseover', onOver, {
      passive: true
    });
    window.addEventListener('mousedown', onDown, {
      passive: true
    });
    window.addEventListener('mouseup', onUp, {
      passive: true
    });
    document.addEventListener('mouseleave', onLeave);
    const lerp = (a: number, b: number, n: number) => a + (b - a) * n;
    const render = () => {
      // Dot tracks almost exactly; ring follows with a subtle lag.
      dot.x = lerp(dot.x, mouse.x, reduceMotion ? 1 : 0.5);
      dot.y = lerp(dot.y, mouse.y, reduceMotion ? 1 : 0.5);
      ring.x = lerp(ring.x, mouse.x, reduceMotion ? 1 : 0.2);
      ring.y = lerp(ring.y, mouse.y, reduceMotion ? 1 : 0.2);
      const dotScale = pressed ? 0.7 : 1;
      const ringScale = pressed ? 0.9 : hovering ? 1.5 : 1;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%) scale(${dotScale})`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%) scale(${ringScale})`;
        ringRef.current.style.opacity = visible ?
        hovering ?
        '0.55' :
        '0.3' :
        '0';
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove('mp-custom-cursor-active');
    };
  }, []);
  return (
    <div aria-hidden="true" className="mp-cursor-root">
      <div ref={ringRef} className="mp-cursor-ring" />
      <div ref={dotRef} className="mp-cursor-dot" />
    </div>);

}