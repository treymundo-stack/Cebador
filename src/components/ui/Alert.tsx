import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

type Variant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: Variant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const config: Record<Variant, { icon: typeof CheckCircle2; bg: string; border: string; text: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-positivo-50', border: 'border-positivo-100', text: 'text-positivo-700', iconColor: 'text-positivo-500' },
  error: { icon: XCircle, bg: 'bg-alerta-50', border: 'border-alerta-100', text: 'text-alerta-700', iconColor: 'text-alerta-500' },
  warning: { icon: AlertCircle, bg: 'bg-warning-50', border: 'border-warning-100', text: 'text-warning-600', iconColor: 'text-warning-500' },
  info: { icon: Info, bg: 'bg-mate-50', border: 'border-mate-100', text: 'text-mate-700', iconColor: 'text-mate-500' },
};

export function Alert({ variant, title, children, className = '' }: AlertProps) {
  const { icon: Icon, bg, border, text, iconColor } = config[variant];
  return (
    <div className={`flex gap-3 rounded-xl border ${bg} ${border} ${text} p-4 ${className}`}>
      <Icon size={20} className={`shrink-0 ${iconColor}`} />
      <div className="flex-1 text-sm">
        {title && <p className="font-medium mb-0.5">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
