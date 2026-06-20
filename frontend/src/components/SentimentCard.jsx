export default function SentimentCard({ data }) {
  const sentiment = data.agent_data?.sentiment || data.sentiment || {}
  const communityLabel = sentiment.community_sentiment || sentiment.sentiment_security_rating || sentiment.overall_sentiment || 'N/A'
  const communityRisk = sentiment.community_intelligence_score !== undefined 
    ? Math.max(0, 100 - sentiment.community_intelligence_score) 
    : (sentiment.community_risk_index ?? data.community_risk_index ?? 0)
  const redditMentions = sentiment.reddit_mentions ?? data.reddit_mentions ?? 0
  const redditBuzz = sentiment.reddit_social_buzz ?? data.reddit_social_buzz ?? 0
  const redditTrust = sentiment.reddit_dev_trust ?? data.reddit_dev_trust ?? 0.5
  const redditRugRisk = sentiment.reddit_rug_risk ?? data.reddit_rug_risk ?? 0
  const allegations = sentiment.reddit_allegations || sentiment.allegations || data.allegations || []
  const aiSummary = sentiment.ai_sentiment_summary || sentiment.ai_analysis || data.ai_risk_summary || ''

  const getSentimentStyle = (label) => {
    return { color: 'text-white', bg: 'bg-white/10', border: 'border-white/20', emoji: '⬛' }
  }

  const style = getSentimentStyle(communityLabel)

  return (
    <div className="bg-surface-container border-4 border-black rounded-xl p-6 cel-shadow">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
        <span>💬</span> Sentiment & Community
      </h3>

      {/* Sentiment Badge */}
      <div className="text-center mb-5">
        <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold ${style.bg} ${style.color} ${style.border} border`}>
          {style.emoji} {communityLabel}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricBox label="Community Risk" value={`${communityRisk}/100`} />
        <MetricBox label="Reddit Mentions" value={redditMentions} highlight={redditMentions > 10} />
        <MetricBox label="Social Buzz" value={`${(redditBuzz * 100).toFixed(0)}%`} />
        <MetricBox label="Dev Trust" value={`${(redditTrust * 100).toFixed(0)}%`} />
      </div>

      {/* Reddit Rug Risk */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Reddit Rug Risk</span>
          <span className="text-white">
            {(redditRugRisk * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-light overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-white"
            style={{ width: `${redditRugRisk * 100}%` }}
          />
        </div>
      </div>

      {/* Allegations */}
      {Array.isArray(allegations) && allegations.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-[#111111] border border-white/20">
          <p className="text-xs text-white font-semibold mb-1.5">⚠️ Allegations Detected</p>
          {allegations.map((a, i) => (
            <p key={i} className="text-xs text-slate-400">
              • {a?.type || a} {a?.confidence ? `— ${(a.confidence * 100).toFixed(0)}% confidence` : ''}
            </p>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {aiSummary && (
        <div className="mt-3 p-3 rounded-xl bg-surface-light/50 border border-card-border">
          <p className="text-xs text-slate-500 mb-1">🧠 AI Analysis</p>
          <p className="text-xs text-slate-300 leading-relaxed">{String(aiSummary).substring(0, 300)}</p>
        </div>
      )}
    </div>
  )
}

function MetricBox({ label, value, highlight }) {
  return (
    <div className="p-3 rounded-xl bg-surface-light/50 border border-card-border text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-white' : 'text-gray-300'}`}>{value}</p>
    </div>
  )
}
