export default function ScanReportCard({ data }) {
  const name = data.token_name || data.agent_data?.scanner?.name || 'Unknown'
  const symbol = data.agent_data?.scanner?.symbol || ''
  const risk = data.rug_risk_score ?? data.risk_score ?? 'N/A'
  const level = data.risk_level || 'N/A'
  const primaryRisk = data.primary_risk || 'None detected'
  const warning = data.primary_warning || 'No critical warnings'
  
  const isHighRisk = risk >= 70 || level.toLowerCase().includes('high')
  const themeColor = isHighRisk ? 'error' : (risk >= 40 ? 'secondary-container' : 'primary-container')
  const glowClass = isHighRisk ? 'comic-glow-error' : (risk >= 40 ? 'shadow-[0_0_20px_rgba(255,181,157,0.15),6px_6px_0px_0px_rgba(0,0,0,1)]' : 'shadow-[0_0_20px_rgba(0,255,136,0.15),6px_6px_0px_0px_rgba(0,0,0,1)]')

  return (
    <div className={`bg-surface-container border-4 border-black rounded-xl rounded-bl-none overflow-hidden ${glowClass} flex flex-col hover:-translate-y-1 transition-transform w-full`}>
      {/* Panel Header */}
      <div className="bg-surface-container-highest border-b-4 border-black p-4 flex items-center justify-between gap-4 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 bg-${themeColor}/20`}></div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface border-2 border-black flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,255,136,0.3)]">
            <span className="material-symbols-outlined text-primary-container drop-shadow-[0_0_5px_rgba(0,255,136,0.8)]">radar</span>
          </div>
          <div>
            <h3 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface m-0 leading-none">Scan Complete</h3>
            <p className="font-code-sm text-code-sm text-primary-container mt-1">Target: {name} ({symbol})</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-black text-${themeColor}`}>{risk}/100</div>
          <div className={`text-xs font-bold uppercase tracking-widest text-on-surface-variant`}>Risk Score</div>
        </div>
      </div>

      {/* Panel Body */}
      <div className="p-6 flex flex-col gap-5 bg-gradient-to-b from-surface-container to-surface-container-low">
        <p className={`font-title-md text-title-md text-on-surface border-l-4 border-${themeColor} pl-4`}>
          {isHighRisk ? "Initial findings look suspicious. Here's the breakdown:" : "Analysis complete. Here are the key findings:"}
        </p>
        
        {/* Evidence Bento-style mini cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-surface border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group hover:bg-surface-container transition-colors">
            <div className={`absolute top-0 right-0 w-16 h-16 bg-${themeColor}/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110`}></div>
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className={`w-8 h-8 rounded-full bg-${themeColor}/20 border border-${themeColor} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-${themeColor} text-sm`}>warning</span>
              </div>
              {isHighRisk && <span className="bg-error text-on-error px-2 py-1 border border-black rounded-md text-xs font-bold uppercase tracking-wider animate-[wiggle_3s_ease-in-out_infinite] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">SUS</span>}
            </div>
            <h4 className="font-code-sm text-code-sm text-on-surface-variant mb-1 relative z-10">Primary Risk</h4>
            <p className="font-title-md text-title-md text-on-surface relative z-10">{primaryRisk}</p>
          </div>

          <div className="bg-surface border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group hover:bg-surface-container transition-colors">
            <div className={`absolute top-0 right-0 w-16 h-16 bg-${themeColor}/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110`}></div>
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className={`w-8 h-8 rounded-full bg-${themeColor}/20 border border-${themeColor} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-${themeColor} text-sm`}>gpp_maybe</span>
              </div>
              <span className={`bg-${themeColor} text-on-${themeColor === 'error' ? 'error' : 'surface'} px-2 py-1 border border-black rounded-md text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>{level}</span>
            </div>
            <h4 className="font-code-sm text-code-sm text-on-surface-variant mb-1 relative z-10">Alert Level</h4>
            <p className="font-title-md text-title-md text-on-surface relative z-10">{warning.length > 40 ? warning.substring(0, 40) + '...' : warning}</p>
          </div>
        </div>

        <div className="bg-surface-container-highest border-2 border-outline-variant border-dashed rounded-lg p-4 mt-2">
          <p className="font-body-md text-body-md text-on-surface-variant italic">
            {isHighRisk ? "I wouldn't touch this with a ten-foot pole. Do you want me to monitor it for rug pulls?" : "Seems okay for now, but always proceed with caution. Want me to keep an eye on it?"}
          </p>
        </div>
      </div>
    </div>
  )
}
