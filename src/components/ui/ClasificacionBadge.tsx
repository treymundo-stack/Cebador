import { CLASIFICACION_LABEL, type Clasificacion } from '@/lib/reglas';

const ESTILO: Record<Clasificacion, string> = {
  reforzar: 'bg-positivo-100 text-positivo-700',
  mantener: 'bg-crema-200 text-mate-600',
  revisar_precio: 'bg-warning-100 text-warning-600',
  no_recomprar: 'bg-alerta-100 text-alerta-700',
};

export function ClasificacionBadge({ value }: { value: Clasificacion }) {
  return <span className={`badge whitespace-nowrap ${ESTILO[value]}`}>{CLASIFICACION_LABEL[value]}</span>;
}
