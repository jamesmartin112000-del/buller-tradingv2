import React from 'react';
interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  accent?: 'red' | 'green' | 'amber' | 'purple' | 'blue' | 'none';
  dense?: boolean;
  action?: React.ReactNode;
}
const accentMap: Record<string, string> = {
  red: 'border-l-2 border-l-sell',
  green: 'border-l-2 border-l-buy',
  amber: 'border-l-2 border-l-warn',
  purple: 'border-l-2 border-l-purple-trade',
  blue: 'border-l-2 border-l-blue-trade',
  none: ''
};
export function Card({
  children,
  className = '',
  title,
  icon,
  accent = 'none',
  dense,
  action
}: CardProps) {
  return (
    <div
      className={`bg-bg-600 border border-line rounded-md ${dense ? 'p-2.5' : 'p-3.5'} ${accentMap[accent]} ${className}`}>
      
      {title &&
      <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
            <h3 className="text-[11px] sm:text-xs uppercase tracking-[0.1em] font-semibold text-ink-muted truncate">
              {title}
            </h3>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      }
      {children}
    </div>);

}