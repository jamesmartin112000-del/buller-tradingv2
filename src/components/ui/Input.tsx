import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}
export function Input({
  label,
  hint,
  error,
  icon,
  suffix,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label &&
      <label
        htmlFor={inputId}
        className="block text-2xs uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">
        
          {label}
        </label>
      }
      <div
        className={`flex items-center bg-bg-700 border ${error ? 'border-sell' : 'border-line'} rounded-md focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-[border-color,box-shadow] ${className}`}>
        
        {icon && <span className="pl-3 text-ink-muted">{icon}</span>}
        <input
          id={inputId}
          {...rest}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim outline-none disabled:opacity-50" />
        
        {suffix &&
        <span className="pr-3 text-ink-muted text-sm">{suffix}</span>
        }
      </div>
      {hint && !error && <p className="text-2xs text-ink-dim mt-1">{hint}</p>}
      {error && <p className="text-2xs text-sell mt-1">{error}</p>}
    </div>);

}