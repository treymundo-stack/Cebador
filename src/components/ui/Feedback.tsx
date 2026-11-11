import { ReactNode } from 'react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-crema-200 border-t-mate-500 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function FullSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner size={32} />
      {label && <p className="text-sm text-mate-400">{label}</p>}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-sm text-alerta-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-lg font-medium text-mate-500" style={{ fontFamily: '"Cormorant Garamond", serif' }}>{title}</p>
      {description && <p className="text-sm text-mate-400 max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
