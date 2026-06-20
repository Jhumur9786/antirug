export default function RiskOverview({ data }) {
  const score = data.rug_risk_score ?? data.risk_score ?? 0
  const level = data.risk_level || 'UNKNOWN'
  const probability = data.predicted_probability ?? data.rug_probability ?? 0
  const primaryRisk = data.primary_risk || data.agent_data?.risk_score?.primary_risk_factor || 'No critical risks identified'

  const getScoreColor = (s) => {
    return { ring: '#FFFFFF', text: 'text-white', bg: 'bg-white', label: level }
  }

  const colors = getScoreColor(score)
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="bg-surface-container border-4 border-black rounded-xl p-6 cel-shadow">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
        <span>🎯</span> Risk Overview
      </h3>

      {/* Circular Score */}
      <div className="flex justify-center mb-5">
        <div className="relative w-36 h-36 risk-circle" style={{ '--glow-color': colors.ring + '60' }}>
          <svg className="w-full h-full transform -rotate-90 risk-circle" viewBox="0 0 120 120">
          {/* Background Ring */}
          <circle cx="60" cy="60" r="54" fill="none" stroke="#222222" strokeWidth="8" />
          
          {/* Foreground Ring */}
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={colors.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-extrabold ${colors.text}`}>{score}</span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
        </div>
      </div>

      {/* Risk Level badge */}
      <div className="text-center mb-4">
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold ${colors.bg}/15 ${colors.text} border border-current/20`}>
          {level}
        </span>
      </div>

      {/* Rug Probability Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Rug Probability</span>
          <span className={colors.text}>{probability}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-light overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.min(probability, 100)}%`,
              background: `linear-gradient(90deg, ${colors.ring}80, ${colors.ring})`
            }}
          />
        </div>
      </div>

      {/* Primary Risk */}
      <div className="mt-4 p-3 rounded-xl bg-surface-light/50 border border-card-border">
        <p className="text-xs text-slate-500 mb-1">Primary Risk</p>
        <p className="text-sm text-slate-300">{primaryRisk}</p>
      </div>
    </div>
  )
}
