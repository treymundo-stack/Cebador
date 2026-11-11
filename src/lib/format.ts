export function formatARS(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/** Interpreta 'YYYY-MM-DD' como fecha local (new Date('YYYY-MM-DD') la toma en UTC). */
export function parseFecha(date: string | Date): Date {
  if (date instanceof Date) return new Date(date.getTime());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(date);
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  const d = parseFecha(date);
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date | null): string {
  if (!date) return '—';
  const d = parseFecha(date);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const d = parseFecha(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function diasRestantes(fecha: string | Date | null): string {
  const dias = daysUntil(fecha);
  if (dias === null) return '—';
  if (dias === 0) return 'Hoy';
  if (dias < 0) return `Hace ${Math.abs(dias)} días`;
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}
