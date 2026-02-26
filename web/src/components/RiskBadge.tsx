interface RiskBadgeProps {
  risk: 'critical' | 'high' | 'medium' | 'low';
  size?: 'sm' | 'md';
}

const riskConfig = {
  critical: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'Crítico',
  },
  high: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    label: 'Alto',
  },
  medium: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    label: 'Médio',
  },
  low: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
    label: 'Baixo',
  },
};

export default function RiskBadge({ risk, size = 'sm' }: RiskBadgeProps) {
  const config = riskConfig[risk];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}

