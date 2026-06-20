export default function Header({ lastScan, activeTab, setActiveTab }) {
  return (
    <nav className="fixed top-0 w-full z-50 border-b-4 border-black dark:border-black bg-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex justify-between items-center h-20 px-8 w-full max-w-[1280px] mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-extrabold text-primary-container italic tracking-tight drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
            AntiRug AI
          </span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 h-full pt-2">
          <button 
            onClick={() => setActiveTab('scanner')}
            className={`font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg hover:scale-105 transition-all duration-200 ${
              activeTab === 'scanner' 
                ? "text-primary-container border-b-4 border-primary-container relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-1 after:bg-primary-container drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]" 
                : "text-on-surface-variant opacity-70 hover:opacity-100"
            }`}
          >
            Scanner
          </button>
          <button 
            onClick={() => setActiveTab('agent')}
            className={`font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg hover:scale-105 transition-all duration-200 ${
              activeTab === 'agent' 
                ? "text-primary-container border-b-4 border-primary-container relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-1 after:bg-primary-container drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]" 
                : "text-on-surface-variant opacity-70 hover:opacity-100"
            }`}
          >
            Agent
          </button>
        </div>

        {/* Trailing Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container border-2 border-black rounded-full font-title-md text-title-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1),0_0_10px_rgba(0,255,136,0.3)]">
            <span className="w-3 h-3 rounded-full bg-black animate-pulse shadow-[0_0_5px_rgba(0,0,0,0.5)]"></span>
            Agent Active
          </div>
          <button className="w-12 h-12 bg-surface-variant rounded-full border-2 border-black flex items-center justify-center hover:scale-105 transition-transform duration-200 active:translate-y-1 active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-primary-container">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
