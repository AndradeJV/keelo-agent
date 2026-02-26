import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: 'default' | 'blue' | 'green' | 'red' | 'yellow';
}

const colorMap = {
  default: {
    bg: 'bg-keelo-500/20',
    text: 'text-keelo-500',
    border: 'border-keelo-500/30',
  },
  blue: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
  },
  green: {
    bg: 'bg-green-500/20',
    text: 'text-green-500',
    border: 'border-green-500/30',
  },
  red: {
    bg: 'bg-red-500/20',
    text: 'text-red-500',
    border: 'border-red-500/30',
  },
  yellow: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-500',
    border: 'border-yellow-500/30',
  },
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'default',
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      className={`card-hover border ${colors.border}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-dark-100">{value}</p>
          {trend !== undefined && (
            <p className="text-xs text-dark-400 mt-1">
              <span className="text-keelo-500">{trend}</span> {trendLabel}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${colors.text}`} />
        </div>
      </div>
    </motion.div>
  );
}

