import { useState, useRef, useEffect } from 'react'

export default function ChatInput({ onSend, loading }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    if (!text.trim() || loading) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [text])

  // Exact match from mockup lines 283-298
  return (
    <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 bg-gradient-to-t from-background via-background to-transparent pt-20 z-20">
      <div className="max-w-4xl mx-auto">
        <div className="bg-surface-container border-4 border-black p-2 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center relative group focus-within:-translate-y-1 focus-within:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
          <div className="pl-4 pr-2 flex items-center text-primary-container">
            <span className="material-symbols-outlined font-bold">terminal</span>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a command or contract address..."
            className="w-full bg-transparent border-none text-on-surface placeholder:text-on-surface-variant font-body-lg text-body-lg py-4 px-2 focus:outline-none focus:ring-0 resize-none max-h-[150px]"
            rows={1}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || loading}
            className={`w-12 h-12 ml-2 border-2 border-black rounded-xl flex items-center justify-center transition-all duration-200 ${
              text.trim() && !loading 
                ? 'bg-primary-container text-on-primary-fixed shadow-[2px_2px_0px_0px_rgba(0,0,0,1),0_0_15px_rgba(0,255,136,0.4)] hover:scale-105 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1),0_0_25px_rgba(0,255,136,0.7)] active:translate-y-1 active:shadow-none' 
                : 'bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50'
            }`}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        <div className="mt-4 hidden md:flex justify-center gap-3 flex-wrap">
          <span 
            onClick={() => { setText('/scan '); textareaRef.current?.focus(); }} 
            className="text-xs font-code-sm text-primary-container bg-surface-container border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-md px-3 py-1.5 hover:bg-surface-container-high hover:-translate-y-0.5 cursor-pointer transition-all"
          >
            /scan [address]
          </span>
          <span 
            onClick={() => { setText('/monitor '); textareaRef.current?.focus(); }} 
            className="text-xs font-code-sm text-on-surface-variant bg-surface-container border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-md px-3 py-1.5 hover:bg-surface-container-high hover:-translate-y-0.5 cursor-pointer transition-all"
          >
            /monitor [address]
          </span>
          <span 
            onClick={() => { onSend('/explain'); setText(''); }} 
            className="text-xs font-code-sm text-on-surface-variant bg-surface-container border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-md px-3 py-1.5 hover:bg-surface-container-high hover:-translate-y-0.5 cursor-pointer transition-all"
          >
            /explain
          </span>
        </div>
      </div>
    </div>
  )
}
