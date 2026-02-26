import { motion } from 'framer-motion';
import { AlertTriangle, Clock } from 'lucide-react';

export default function QAHealth() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-yellow-500" size={24} />
          <h1 className="text-2xl font-bold text-dark-100">Saúde de QA (Futuro)</h1>
        </div>
        <p className="text-dark-300 leading-relaxed">
          Esta área foi temporariamente marcada como futura para evitar exposição de métricas com baixa
          confiabilidade em produção (dados estimados/proxy). O relatório semanal e a operação principal do
          Keelo continuam ativos.
        </p>
        <div className="mt-6 flex items-center gap-2 text-dark-400">
          <Clock size={16} />
          <span>Reativação prevista após calibração e validação de métricas.</span>
        </div>
      </motion.div>
    </div>
  );
}

