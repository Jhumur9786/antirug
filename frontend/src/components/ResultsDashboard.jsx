import { useEffect, useState } from 'react'

// Map risk score to gauge needle angle (-90 = 0%, 90 = 100%)
function scoreToAngle(score) {
  return -90 + (score / 100) * 180
}

function getStatusPill(level) {
  const l = (level || '').toLowerCase()
  if (l.includes('high') || l.includes('critical') || l.includes('danger'))
    return { bg: 'bg-[#ff3366]', text: 'text-white', label: 'DANGER', icon: 'error', wiggle: true }
  if (l.includes('medium') || l.includes('elevated') || l.includes('warn'))
    return { bg: 'bg-[#ffb59d]', text: 'text-black', label: 'WARN', icon: 'warning', wiggle: false }
  return { bg: 'bg-primary-container', text: 'text-black', label: 'SAFE', icon: 'check_circle', wiggle: false }
}

function getRiskLabel(score) {
  if (score >= 80) return { label: 'CRITICAL RISK', bg: 'bg-[#ff3366]', text: 'text-white' }
  if (score >= 60) return { label: 'ELEVATED RISK', bg: 'bg-[#ffb59d]', text: 'text-black' }
  if (score >= 40) return { label: 'MODERATE RISK', bg: 'bg-[#ffb59d]', text: 'text-black' }
  return { label: 'LOW RISK', bg: 'bg-primary-container', text: 'text-black' }
}

// Agent field report card component
function AgentCard({ icon, title, description, status, extra, delay }) {
  const pill = getStatusPill(status)
  return (
    <div 
      className="comic-border bg-surface-container rounded-xl p-6 hover:-translate-y-1 hover:translate-x-1 hover:shadow-none transition-all duration-200 flex flex-col opacity-0"
      style={{ animation: `slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms forwards` }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-full bg-surface-variant border-2 border-black flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-on-surface">{icon}</span>
        </div>
        <span className={`status-pill ${pill.bg} ${pill.text} ${pill.wiggle ? 'animate-wiggle' : ''}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{pill.icon}</span>
          {pill.label}
        </span>
      </div>
      <h4 className="font-title-md text-title-md text-on-surface mb-2">{title}</h4>
      <p className="font-body-md text-body-md text-on-surface-variant mb-4 flex-grow">{description}</p>
      {extra && <div className="mt-auto">{extra}</div>}
    </div>
  )
}

export default function ResultsDashboard({ data }) {
  const [animate, setAnimate] = useState(false)
  const score = data.rug_risk_score ?? data.risk_score ?? 50
  const level = data.risk_level || 'Medium'
  const riskInfo = getRiskLabel(score)
  const needleAngle = scoreToAngle(score)
  const summary = data.primary_warning || data.security_posture || 'Analysis complete. Review agent findings below.'

  // Agent data extraction
  const agents = data.agent_data || {}
  const contract = agents.scanner || {}
  const liquidity = agents.liquidity || {}
  const holders = agents.holders || {}
  const prediction = agents.prediction || {}
  const alert = agents.alert || {}

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-12 w-full">
      {/* Hero Section: Risk Score & Mascot */}
      <section className="flex flex-col lg:flex-row gap-8 items-center justify-center">
        {/* Mascot Area */}
        <div className="relative w-48 h-48 lg:w-64 lg:h-64 rounded-full comic-border overflow-hidden bg-surface-container flex-shrink-0 animate-wiggle">
          <img 
            alt="Detective RUG Mascot" 
            className="w-full h-full object-cover" 
            src="/logo.png"
            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-6xl">🛡️</span>'; }}
          />
        </div>

        {/* Score Panel */}
        <div className="comic-border rounded-xl bg-surface-container p-8 flex flex-col items-center flex-grow max-w-md w-full relative overflow-hidden">
          <div className="mb-4">
            <span className={`status-pill ${riskInfo.bg} ${riskInfo.text} animate-wiggle`}>
              <span className="material-symbols-outlined text-sm">warning</span>
              {riskInfo.label}
            </span>
          </div>
          <h2 className="font-display-lg text-display-lg text-on-surface mb-6 text-center">SCORE: {score}</h2>
          
          {/* Speedometer Gauge */}
          <div className="gauge-container mb-4">
            <div className="gauge-background"></div>
            <div className="gauge-needle-container">
              <div 
                className="gauge-needle" 
                style={{ 
                  animation: animate ? 'needleBounce 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
                  '--needle-angle': `${needleAngle}deg`
                }}
              ></div>
            </div>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant text-center mt-4">
            {summary}
          </p>
        </div>
      </section>

      {/* AI Agent Analysis Cards (Bento Grid) */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary-container text-3xl">smart_toy</span>
          <h3 className="font-headline-lg text-headline-lg text-on-surface uppercase tracking-tight">Agent Field Reports</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AgentCard
            icon="description"
            title="Contract Intel"
            description={contract.ownership_renounced === false 
              ? `Ownership is NOT renounced. ${contract.mint_authority_enabled ? 'Minting function remains active.' : ''} ${data.primary_risk || 'High probability of supply manipulation detected.'}`
              : contract.ownership_renounced === true
                ? 'Ownership has been renounced. Minting is disabled. No supply manipulation risk detected.'
                : 'Contract analysis completed. Review details for full assessment.'}
            status={contract.ownership_renounced === false ? 'danger' : contract.ownership_renounced === true ? 'safe' : level}
            delay={100}
            extra={<button className="w-full py-2 bg-surface border-2 border-black rounded-lg font-code-sm text-code-sm text-on-surface hover:bg-surface-variant transition-colors">View Source</button>}
          />
          <AgentCard
            icon="water_drop"
            title="Liquidity Pool"
            description={liquidity.pool_size_usd 
              ? `Pool size: $${Number(liquidity.pool_size_usd).toLocaleString()}. ${liquidity.liquidity_locked ? 'Liquidity is locked.' : 'Liquidity is NOT locked — rug risk.'}`
              : 'Liquidity analysis completed. Check lock status and pool depth.'}
            status={liquidity.liquidity_locked === false ? 'danger' : liquidity.liquidity_locked === true ? 'safe' : 'warn'}
            delay={200}
            extra={liquidity.pool_size_usd && (
              <div className="bg-surface-container-lowest border-2 border-black rounded p-2 text-center font-code-sm text-code-sm text-on-surface">
                Pool: ${Number(liquidity.pool_size_usd).toLocaleString()}
              </div>
            )}
          />
          <AgentCard
            icon="groups"
            title="Holder Distribution"
            description={holders.top10_concentration 
              ? `Top 10 wallets hold ${holders.top10_concentration}% combined. ${holders.top10_concentration < 30 ? 'Distribution looks healthy.' : 'Concentrated ownership detected.'}`
              : 'Holder distribution analysis completed.'}
            status={holders.top10_concentration > 50 ? 'danger' : holders.top10_concentration > 30 ? 'warn' : 'safe'}
            delay={300}
            extra={holders.top10_concentration && (
              <div className="flex gap-2">
                <div className="h-2 rounded-full border border-black bg-primary-container" style={{ width: `${100 - (holders.top10_concentration || 0)}%` }}></div>
                <div className="h-2 rounded-full border border-black bg-surface-variant" style={{ width: `${holders.top10_concentration || 0}%` }}></div>
              </div>
            )}
          />
          <AgentCard
            icon="vpn_key"
            title="Admin Authority"
            description={prediction.key_triggers?.length > 0
              ? prediction.key_triggers.slice(0, 2).join('. ') + '.'
              : data.primary_risk || 'Admin authority analysis completed.'}
            status={score >= 70 ? 'danger' : score >= 40 ? 'warn' : 'safe'}
            delay={400}
          />
          <AgentCard
            icon="forum"
            title="Social Sentiment"
            description={alert.community_label
              ? `Community sentiment: ${alert.community_label}. ${alert.social_score ? `Social score: ${alert.social_score}/100.` : ''}`
              : 'Social sentiment analysis completed.'}
            status={alert.community_label?.toLowerCase().includes('positive') ? 'safe' : alert.community_label?.toLowerCase().includes('negative') ? 'danger' : 'warn'}
            delay={500}
          />
        </div>
      </section>
    </div>
  )
}
