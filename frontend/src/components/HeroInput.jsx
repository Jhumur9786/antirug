import { useState } from 'react'

export default function HeroInput({ onAnalyze, loading }) {
  const [tokenId, setTokenId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = tokenId.trim()
    if (trimmed && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      onAnalyze(trimmed)
    }
  }

  const quickTokens = [
    { name: 'BONK', id: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { name: 'JUP', id: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { name: 'WIF', id: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
    { name: 'RAY', id: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  ]

  return (
    <section className="text-center mb-12 flex flex-col items-center">
      {/* Title */}
      <h1 className="font-display-lg text-display-lg text-on-surface mb-3 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
        Token Security Scanner
      </h1>
      <p className="text-on-surface-variant font-body-lg text-body-lg mb-8 max-w-xl mx-auto">
        AI-powered autonomous rug detection using 5 intelligence agents on Solana
      </p>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl w-full mx-auto mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Enter Solana Token Address..."
            disabled={loading}
            className="w-full px-5 py-4 rounded-xl bg-surface-container border-3 border-black text-on-surface placeholder:text-on-surface-variant/50 font-code-sm text-code-sm focus:outline-none focus:border-primary-container focus:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !tokenId.trim()}
          className="px-8 py-4 rounded-xl font-title-md text-title-md text-on-primary-container bg-primary-container border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-105 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1),0_0_20px_rgba(0,255,136,0.4)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? '⏳ Analyzing...' : '🔍 Analyze Token'}
        </button>
      </form>

      {/* Quick tokens */}
      <div className="flex flex-wrap justify-center gap-3">
        <span className="text-xs text-on-surface-variant font-code-sm mt-1">Quick scan:</span>
        {quickTokens.map(t => (
          <button
            key={t.id}
            onClick={() => { setTokenId(t.id); onAnalyze(t.id) }}
            disabled={loading}
            className="text-xs font-code-sm text-primary-container bg-surface-container border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-md px-3 py-1.5 hover:bg-surface-container-high hover:-translate-y-0.5 cursor-pointer transition-all disabled:opacity-40"
          >
            {t.name}
          </button>
        ))}
      </div>
    </section>
  )
}
