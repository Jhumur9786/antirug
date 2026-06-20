export default function MarketCard({ data }) {
  const scanner = data.agent_data?.scanner || {}
  const sentiment = data.agent_data?.sentiment || {}
  
  const liquidity = sentiment.liquidity_usd ?? scanner.liquidity_usd ?? 0
  const volume = sentiment.volume_24h ?? scanner.volume_24h ?? 0
  const marketCap = sentiment.fundamental_data?.financial?.market_cap ?? sentiment.market_cap ?? scanner.market_cap ?? 0
  const holders = scanner.holder_count ?? scanner.holders ?? 0
  const dexRisk = sentiment.dex_risk_level ?? 'N/A'
  const price = sentiment.fundamental_data?.financial?.current_price ?? sentiment.current_price ?? 0
  const priceChange = sentiment.price_change_24h ?? 0

  const formatUSD = (val) => {
    const num = Number(val)
    if (!num || isNaN(num) || num === 0) return '$0'
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
    if (num >= 1) return `$${num.toFixed(2)}`
    if (num >= 0.01) return `$${num.toFixed(4)}`
    return `$${num.toFixed(6)}`
  }

  const getDexRiskStyle = (risk) => {
    return 'text-white bg-white/10 border-white/20'
  }

  return (
    <div className="bg-surface-container border-4 border-black rounded-xl p-6 cel-shadow">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
        <span>📊</span> Liquidity & Market
      </h3>

      {/* Price */}
      {price > 0 && (
        <div className="text-center mb-5">
          <p className="text-3xl font-extrabold text-white">{formatUSD(price)}</p>
          {priceChange !== 0 && (
            <p className={`text-sm font-medium mt-1 text-gray-400`}>
              {priceChange > 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
            </p>
          )}
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-3 mb-5">
        <MarketRow icon="💧" label="DEX Liquidity" value={formatUSD(liquidity)} />
        <MarketRow icon="📈" label="24h Volume" value={formatUSD(volume)} />
        <MarketRow icon="💰" label="Market Cap" value={formatUSD(marketCap)} />
        <MarketRow icon="👥" label="Holders" value={holders.toLocaleString()} />
      </div>

      {/* DEX Risk */}
      <div className="text-center">
        <p className="text-xs text-slate-500 mb-2">DEX Risk Level</p>
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold border ${getDexRiskStyle(dexRisk)}`}>
          {dexRisk}
        </span>
      </div>
    </div>
  )
}

function MarketRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-light/50 border border-card-border">
      <span className="flex items-center gap-2 text-sm text-slate-400">
        <span>{icon}</span> {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}
