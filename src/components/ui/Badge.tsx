import React from 'react';
interface BadgeProps {
  children: React.ReactNode;
  tone?: 'red' | 'green' | 'amber' | 'blue' | 'purple' | 'neutral' | 'brand';
  size?: 'sm' | 'md';
  className?: string;
}
const tones: Record<string, string> = {
  red: 'bg-sell/15 text-sell border-sell/30',
  green: 'bg-buy/15 text-buy border-buy/30',
  amber: 'bg-warn/15 text-warn border-warn/30',
  blue: 'bg-blue-trade/15 text-blue-trade border-blue-trade/30',
  purple: 'bg-purple-trade/15 text-purple-trade border-purple-trade/30',
  neutral: 'bg-bg-500 text-ink-muted border-line',
  brand: 'bg-brand/15 text-brand border-brand/30'
};
export function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  className = ''
}: BadgeProps) {
  const sz = size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wider border ${tones[tone]} ${sz} ${className}`}>
      
      {children}
    </span>);

}