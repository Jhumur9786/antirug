import { useState, useRef, useEffect } from 'react'
import Header from './components/Header'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import HeroInput from './components/HeroInput'
import ResultsDashboard from './components/ResultsDashboard'
import ScanningAnimation from './components/ScanningAnimation'

const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE || 'https://antirug-production-e5cd.up.railway.app')

function App() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('antirug_chat')
    return saved ? JSON.parse(saved) : []
  })
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('antirug_session')
    if (saved) return saved
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem('antirug_session', newId)
    return newId
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('scanner')
  const [scanResult, setScanResult] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const handleDirectScan = async (tokenId) => {
    setScanLoading(true)
    setScanResult(null)
    try {
      const response = await fetch(`${API_BASE}/analyze/${tokenId}`)
      if (!response.ok) throw new Error(`Analysis failed (${response.status})`)
      const report = await response.json()
      setScanResult(report)
    } catch (err) {
      alert(`⚠️ Connection Error: ${err.message}`)
    } finally {
      setScanLoading(false)
    }
  }

  useEffect(() => {
    localStorage.setItem('antirug_chat', JSON.stringify(messages))
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Extract Solana token addresses (base58) from text
  const extractTokenId = (text) => {
    const solanaMatch = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/)
    if (solanaMatch) return solanaMatch[1]
    return null
  }

  // Format analysis report as markdown
  const formatReport = (data) => {
    const name = data.token_name || data.agent_data?.scanner?.name || 'Unknown'
    const symbol = data.agent_data?.scanner?.symbol || ''
    const risk = data.rug_risk_score ?? data.risk_score ?? 'N/A'
    const level = data.risk_level || 'N/A'
    const prob = data.predicted_probability ?? data.rug_probability ?? 'N/A'
    const alert = data.alert_level || 'N/A'
    const posture = data.security_posture || 'N/A'
    const confidence = data.confidence ?? 'N/A'
    const primaryRisk = data.primary_risk || 'None detected'
    const warning = data.primary_warning || 'No critical warnings'

    let md = `## 🛡️ AntiRug Analysis: **${name}** (${symbol})\n\n`
    md += `| Metric | Value |\n|---|---|\n`
    md += `| **Token ID** | \`${data.token_id}\` |\n`
    md += `| **Risk Score** | **${risk}/100** (${level}) |\n`
    md += `| **Rug Probability** | **${prob}%** |\n`
    md += `| **Alert Level** | ${alert} |\n`
    md += `| **Security Posture** | ${posture} |\n`
    md += `| **AI Confidence** | ${confidence}% |\n\n`
    md += `**Primary Risk:** ${primaryRisk}\n\n`
    md += `**⚠️ Warning:** ${warning}\n\n`

    const recs = data.recommendations || data.agent_data?.alert?.recommendations || []
    if (recs.length > 0) {
      md += `### 📋 Recommendations\n`
      recs.forEach(r => { md += `- ${r}\n` })
      md += '\n'
    }

    const triggers = data.key_triggers || data.agent_data?.prediction?.key_triggers || []
    if (triggers.length > 0) {
      md += `### 🚨 Key Risk Triggers\n`
      triggers.forEach(t => { md += `- ${t}\n` })
    }

    return md
  }

  const handleSend = async (text) => {
    if (!text.trim()) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Try /chat first
      let response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content || data.reply || "Sorry, I couldn't process that request."
        }])
        return
      }

      // Fallback: extract token ID and call /analyze
      const tokenId = extractTokenId(text)
      if (tokenId) {
        response = await fetch(`${API_BASE}/analyze/${tokenId}`)
        if (!response.ok) throw new Error(`Analysis failed (${response.status})`)
        const report = await response.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: formatReport(report),
          isReport: true,
          reportData: report
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Please include a Solana token address in your message so I can analyze it. Example: **Analyze DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263**"
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Connection Error**: ${err.message}. Please check if the agent is online.`
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    if (confirm('Clear entire chat history?')) {
      setMessages([])
      localStorage.removeItem('antirug_chat')
      localStorage.removeItem('antirug_session')
      window.location.reload()
    }
  }

  return (
    // Exact match: mockup line 156
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col overflow-hidden relative">
      
      {/* Dynamic Mascot Background — exact match: mockup line 158-160 */}
      <div className="absolute top-1/2 left-1/2 w-[120vw] h-[120vw] max-w-[1000px] max-h-[1000px] pointer-events-none z-0 opacity-[0.04] bg-mascot flex items-center justify-center" style={{ transform: 'translate(-50%, -50%)' }}>
        <img alt="Mascot Background" className="w-full h-full object-contain filter grayscale" src="/logo.png"/>
      </div>

      <Header 
        lastScan={messages.length > 0 ? "Agent Active" : "Waiting for input..."} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      {/* Main Chat Area — exact match: mockup line 194 */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto mt-20 relative flex flex-col bg-circuit-pattern z-10">
        
        {activeTab === 'scanner' ? (
          <div className="flex-1 overflow-y-auto chat-scrollbar flex flex-col items-center">
            {scanLoading ? (
              <ScanningAnimation />
            ) : (
              <div className="p-8 md:p-12 flex flex-col items-center w-full">
                <HeroInput onAnalyze={handleDirectScan} loading={scanLoading} />
                {scanResult && <div className="w-full mt-4"><ResultsDashboard data={scanResult} /></div>}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Chat History Container — exact match: mockup line 196 */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 flex flex-col gap-10 pb-40">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-24 h-24 rounded-full border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-surface-container relative mb-6 group hover:scale-105 transition-transform duration-300">
                    <div className="absolute inset-0 bg-primary-container opacity-20 animate-pulse"></div>
                    <img src="/logo.png" alt="AntiRug AI Logo" className="w-full h-full object-cover relative z-10" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-4xl relative z-10">🛡️</span>'; }} />
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">AntiRug AI</h2>
                  <p className="text-on-surface-variant font-body-lg text-body-lg mb-8 max-w-sm">
                    Agent RUG online. I'm scanning the mempool for shady contracts. Got a target address for me to investigate?
                  </p>
                </div>
              ) : (
                <div className="flex flex-col flex-1 gap-10">
                  {messages.map((m, i) => (
                    <ChatMessage key={i} role={m.role} content={m.content} isReport={m.isReport} reportData={m.reportData} />
                  ))}
                  
                  {loading && (
                    // Typing indicator — exact match: mockup lines 271-280
                    <div className="flex items-end gap-4 self-start mt-2">
                      <div className="w-10 h-10 flex-shrink-0 rounded-full border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-surface-container">
                        <img alt="Detective Mascot Avatar" className="w-full h-full object-cover grayscale opacity-80" src="/logo.png" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-sm">🛡️</span>'; }}/>
                      </div>
                      <div className="bg-surface border-2 border-black rounded-xl rounded-bl-none px-6 py-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-primary-container rounded-full typing-dot shadow-[0_0_5px_rgba(0,255,136,0.5)]"></div>
                        <div className="w-2.5 h-2.5 bg-primary-container rounded-full typing-dot shadow-[0_0_5px_rgba(0,255,136,0.5)]"></div>
                        <div className="w-2.5 h-2.5 bg-primary-container rounded-full typing-dot shadow-[0_0_5px_rgba(0,255,136,0.5)]"></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-4" />
                </div>
              )}
            </div>

            {/* Input Area — ChatInput is absolutely positioned */}
            {messages.length > 0 && (
              <button 
                onClick={clearChat}
                className="fixed bottom-36 right-8 z-30 text-xs text-on-surface-variant hover:text-on-surface transition-colors bg-surface-container border border-black rounded-md px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Clear Chat
              </button>
            )}
            <ChatInput onSend={handleSend} loading={loading} />
          </>
        )}
      </main>
    </div>
  )
}

export default App
