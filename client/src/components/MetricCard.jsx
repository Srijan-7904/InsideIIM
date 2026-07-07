import { motion } from 'framer-motion';

export default function MetricCard({ label, value, hint, tone = 'default' }) {
  const toneClass =
    tone === 'positive'
      ? 'border-emerald-250 bg-emerald-50/40 text-emerald-900'
      : tone === 'negative'
        ? 'border-rose-250 bg-rose-50/40 text-rose-900'
        : 'border-slate-200 bg-white text-slate-850';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -5, scale: 1.015, boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.06)' }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`rounded-[20px] border p-6 lg:p-8 backdrop-blur transition-all duration-200 ${toneClass}`}
    >
      <p className="text-[14px] uppercase tracking-[0.2em] font-bold text-slate-500">{label}</p>
      <div className="mt-4 text-[24px] sm:text-[28px] lg:text-[32px] xl:text-[36px] font-bold tracking-tight text-slate-900 leading-tight">{value}</div>
      {hint ? <p className="mt-3 text-[14px] font-medium text-slate-450">{hint}</p> : null}
    </motion.div>
  );
}
