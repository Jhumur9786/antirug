import ReactMarkdown from 'react-markdown'
import { useState } from 'react'
import ScanReportCard from './ScanReportCard'

export default function ChatMessage({ role, content, isReport, reportData }) {
  const isAgent = role === 'assistant'
  const [copied, setCopied] = useState(false)

  const copyText = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isAgent) {
    return (
      <div className="flex items-end gap-4 self-start max-w-[90%] md:max-w-[75%] group mt-4">
        {/* AI Avatar — exact match from mockup line 199-202 */}
        <div className="w-14 h-14 flex-shrink-0 rounded-full border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-surface-container relative">
          <div className="absolute inset-0 bg-primary-container opacity-20 animate-pulse"></div>
          <img 
            src="/logo.png" 
            alt="Detective Mascot Avatar" 
            className="w-full h-full object-cover relative z-10" 
            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-2xl relative z-10">🛡️</span>'; }} 
          />
        </div>

        {/* AI Bubble */}
        {isReport && reportData ? (
          <ScanReportCard data={reportData} />
        ) : (
          <div className="relative bg-gradient-to-br from-surface-container to-surface-container-high border-2 border-black rounded-2xl rounded-bl-none p-6 cel-shadow hover:-translate-y-1 transition-transform font-title-md text-title-md text-on-surface">
            <div className="markdown-body">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            <button 
              onClick={copyText}
              className="absolute -right-12 top-2 p-2 bg-surface-variant border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-on-surface hover:text-primary-container hover:scale-105 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
              title="Copy message"
            >
              {copied ? (
                <span className="material-symbols-outlined text-sm">check</span>
              ) : (
                <span className="material-symbols-outlined text-sm">content_copy</span>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  // User message — exact match from mockup line 208-215
  return (
    <div className="flex items-end gap-4 self-end max-w-[90%] md:max-w-[75%] flex-row-reverse">
      {/* User Avatar */}
      <div className="w-12 h-12 flex-shrink-0 rounded-full border-2 border-black bg-surface-bright flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <span className="material-symbols-outlined text-on-surface">person</span>
      </div>

      {/* User Bubble */}
      <div className="bg-gradient-to-bl from-surface-bright to-surface-container-highest border-2 border-black rounded-2xl rounded-br-none p-6 cel-shadow hover:-translate-y-1 transition-transform font-body-lg text-body-lg text-on-surface">
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}
