import { useState, useEffect, useRef } from 'react'

const COMIC_MESSAGES = [
  'LIQUIDITY AGENT ACTIVATED...',
  'HOLDER ANALYSIS...',
  'CHECKING HONEYPOTS...',
  'TRACING DEV WALLETS...',
  'SCANNING MINT AUTHORITY...',
  'ANALYZING TOKEN METADATA...',
]

export default function ScanningAnimation() {
  const [percent, setPercent] = useState(0)
  const [activeBubble, setActiveBubble] = useState({ id: 'left', text: COMIC_MESSAGES[0] })
  const [bubbleVisible, setBubbleVisible] = useState(true)
  const bubbleIndex = useRef(0)

  // Progress counter
  useEffect(() => {
    const interval = setInterval(() => {
      setPercent(prev => {
        const next = prev + Math.floor(Math.random() * 5) + 1
        if (next >= 99) {
          clearInterval(interval)
          return 99
        }
        return next
      })
    }, 200)
    return () => clearInterval(interval)
  }, [])

  // Cycle comic bubbles
  useEffect(() => {
    const interval = setInterval(() => {
      setBubbleVisible(false)
      setTimeout(() => {
        bubbleIndex.current = (bubbleIndex.current + 1) % COMIC_MESSAGES.length
        setActiveBubble({
          id: bubbleIndex.current % 2 === 0 ? 'left' : 'right',
          text: COMIC_MESSAGES[bubbleIndex.current]
        })
        setBubbleVisible(true)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="flex-grow flex flex-col items-center justify-center relative px-8 py-12">
      {/* Background Grid Pattern for Cyber Vibe */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20" 
        style={{ backgroundImage: 'radial-gradient(#00ff88 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      ></div>

      {/* Central Scanner Area */}
      <div className="relative w-full max-w-2xl aspect-square md:aspect-video flex items-center justify-center mb-12">
        {/* Radar Rings */}
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <div className="w-32 h-32 rounded-full border-2 border-primary-container opacity-50 absolute animate-radar-pulse"></div>
          <div className="w-48 h-48 rounded-full border-4 border-primary-container opacity-30 absolute animate-radar-pulse" style={{ animationDelay: '0.5s' }}></div>
          <div className="w-64 h-64 rounded-full border-2 border-primary-container opacity-10 absolute animate-radar-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Dynamic Comic Bubbles */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Left Bubble */}
          <div className={`absolute top-10 left-10 md:left-20 comic-bubble bubble-left transition-all duration-300 ${
            activeBubble.id === 'left' && bubbleVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}>
            {activeBubble.id === 'left' ? activeBubble.text : COMIC_MESSAGES[0]}
          </div>
          {/* Right Bubble */}
          <div className={`absolute bottom-20 right-10 md:right-20 comic-bubble bubble-right transition-all duration-300 ${
            activeBubble.id === 'right' && bubbleVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}>
            {activeBubble.id === 'right' ? activeBubble.text : COMIC_MESSAGES[1]}
          </div>
        </div>

        {/* Mascot Container (Running/Scanning) */}
        <div className="relative z-10 animate-scan-pan w-48 h-48 md:w-64 md:h-64 rounded-2xl bg-surface-container-high border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex items-center justify-center">
          {/* Inner Scanner Overlay */}
          <div className="absolute inset-0 bg-primary-container opacity-10 mix-blend-overlay"></div>
          <div className="scan-line z-20"></div>
          {/* Mascot Image */}
          <img 
            alt="Scanning Mascot" 
            className="w-full h-full object-contain p-4 relative z-10" 
            src="/logo.png"
            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML += '<span class="text-6xl relative z-10">🔍</span>'; }}
          />
          {/* Sweat Drops Animation */}
          <div className="absolute top-4 right-8 w-2 h-4 bg-primary-container rounded-full animate-sweat-drop" style={{ animationDelay: '0.2s' }}></div>
          <div className="absolute top-12 left-6 w-3 h-5 bg-primary-container rounded-full animate-sweat-drop" style={{ animationDelay: '0.7s' }}></div>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="w-full max-w-xl z-10 bg-surface-container p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl">
        <div className="flex justify-between items-center mb-4 font-headline-lg-mobile text-headline-lg-mobile text-primary-container uppercase tracking-wide">
          <span>Scanning Contract</span>
          <span className="animate-pulse">{percent}%</span>
        </div>
        <div className="h-8 w-full bg-surface-variant border-2 border-black rounded-full overflow-hidden relative">
          {/* Striped background pattern for un-filled area */}
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)' }}></div>
          {/* The Fill */}
          <div 
            className="h-full bg-primary-container border-r-2 border-black relative overflow-hidden transition-all duration-200"
            style={{ width: `${percent}%` }}
          >
            {/* Inner highlight on the fill */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-white opacity-30"></div>
          </div>
        </div>
        <p className="text-center mt-4 text-on-surface-variant font-code-sm tracking-widest uppercase opacity-70">Do not close window</p>
      </div>
    </main>
  )
}
