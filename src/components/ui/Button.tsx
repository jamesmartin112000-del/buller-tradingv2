import React from 'react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
    'bg-brand text-bg-900 border border-brand hover:bg-gold-deep hover:border-gold-deep',
    secondary: 'bg-bg-600 text-ink border border-line hover:border-line-strong',
    ghost: 'bg-transparent text-ink-muted border border-transparent hover:text-brand hover:bg-brand/10',
    danger: 'bg-sell/10 text-sell border border-sell/40 hover:bg-sell/15',
    success: 'bg-buy/10 text-buy border border-buy/40 hover:bg-buy/15'
  };
  const sizes: Record<string, string> = {
    sm: 'min-h-11 px-3 text-xs gap-1.5',
    md: 'min-h-11 px-4 text-sm gap-2',
    lg: 'min-h-12 px-5 text-base gap-2'
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center font-semibold rounded-md transition-[background-color,border-color,color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-900 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      
      {icon}
      {children}
    </button>);

}