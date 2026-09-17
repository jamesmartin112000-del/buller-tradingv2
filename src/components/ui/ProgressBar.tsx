import React from 'react';
interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: 'red' | 'green' | 'amber' | 'brand' | 'gradient';
  height?: number;
  showLabel?: boolean;
}
export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  height = 4,
  showLabel
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const tones: Record<string, string> = {
    red: 'bg-sell',
    green: 'bg-buy',
    amber: 'bg-warn',
    brand: 'bg-brand',
    gradient: 'bg-gradient-to-r from-buy via-warn to-sell'
  };
  return (
    <div className="w-full">
      <div
        className="w-full bg-bg-800 rounded-full overflow-hidden"
        style={{
          height
        }}>
        
        <div
          className={`${tones[tone]} h-full transition-all duration-500 rounded-full`}
          style={{
            width: `${pct}%`
          }} />
        
      </div>
      {showLabel &&
      <div className="text-2xs text-ink-muted mt-1 font-mono">
          {value.toFixed(0)}%
        </div>
      }
    </div>);

}