export default function Recommendations({ data }) {
  const alert = data.agent_data?.alert || data.alert || {}
  const prediction = data.agent_data?.prediction || data.prediction || {}
  
  const recommendations = data.recommendations || alert.recommendations || []
  const aiScenario = prediction.ai_risk_scenario || data.ai_risk_scenario || ''
  const securityPosture = data.security_posture || alert.security_posture || ''

  if (!recommendations.length && !aiScenario && !securityPosture) return null

  return (
    <div className="bg-surface-container border-4 border-black rounded-xl p-6 cel-shadow">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span>📋</span> Security Assessment & Recommendations
      </h3>

      {/* Security Posture */}
      {securityPosture && (
        <div className="mb-4 p-3 rounded-xl bg-[#111111] border border-white/20">
          <p className="text-xs text-white font-medium mb-1">Security Posture</p>
          <p className="text-sm text-slate-300">{securityPosture}</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 font-medium mb-2">Actionable Recommendations</p>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="text-white mt-0.5 text-xs">▸</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Risk Scenario */}
      {aiScenario && (
        <div className="p-3 rounded-xl bg-surface-light/50 border border-card-border">
          <p className="text-xs text-slate-500 mb-1">🧠 AI Risk Scenario</p>
          <p className="text-xs text-slate-300 leading-relaxed">{String(aiScenario).substring(0, 500)}</p>
        </div>
      )}
    </div>
  )
}
