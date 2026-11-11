/**
 * Formato argentino: punto de miles y coma decimal, en todos los montos y decimales.
 */
import { describe, expect, it } from 'vitest';
import { decimal, formatARS, formatNumber, formatPercent } from '@/lib/format';

describe('formato de montos y decimales', () => {
  it('pesos con punto de miles, también con 4 cifras', () => {
    expect(formatARS(4800)).toBe('$ 4.800');
    expect(formatARS(300000)).toBe('$ 300.000');
    expect(formatARS(1234567)).toBe('$ 1.234.567');
    expect(formatARS(950)).toBe('$ 950');
    expect(formatARS(-75000)).toBe('-$ 75.000');
    expect(formatARS(4800.6)).toBe('$ 4.801');
    expect(formatARS(null)).toBe('—');
  });

  it('decimales con coma', () => {
    expect(decimal(4.5, 1)).toBe('4,5');
    expect(decimal(4, 1)).toBe('4');
    expect(decimal(18.04, 1)).toBe('18');
    expect(decimal(1234.56, 1)).toBe('1.234,6');
    expect(formatNumber(4.5, 1)).toBe('4,5');
    expect(formatNumber(12000)).toBe('12.000');
  });

  it('porcentajes con coma', () => {
    expect(formatPercent(17.6)).toBe('+17,6%');
    expect(formatPercent(-3.25)).toBe('-3,3%');
  });
});
