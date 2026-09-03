import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPwaPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already launched in standalone mode (already installed as app)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed previously in this session
    const dismissedSession = sessionStorage.getItem('pwa_prompt_dismissed');
    if (dismissedSession === 'true') {
      setIsDismissed(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture beforeinstallprompt event (Chrome, Android, Edge, Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isInstalled || isDismissed) return null;

  // Android / Chrome / Edge / Desktop installation prompt
  if (deferredPrompt) {
    return (
      <div 
        id="pwa-install-banner"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-2xl shadow-xl p-4 z-50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xs border border-black/5 bg-[#0A84FF] flex-shrink-0 flex items-center justify-center">
            <img 
              src="/icons/icon-192x192.png" 
              alt="App Icon" 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-[#1C1C1E]">Install as App</p>
            <p className="text-[11px] text-[#8E8E93] leading-snug">Add shortcut to your home screen or desktop</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            id="pwa-install-btn"
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-[#0A84FF] hover:bg-[#0071E3] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Download size={13} strokeWidth={2.5} />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-[#8E8E93] hover:text-[#1C1C1E] rounded-lg transition cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari instruction banner (helper for iPhone/iPad users)
  if (isIOS && !showIOSInstructions) {
    return (
      <div 
        id="pwa-ios-hint"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-2xl shadow-xl p-3.5 z-50 flex items-center justify-between gap-3 animate-in fade-in"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-[#0A84FF] rounded-xl flex-shrink-0">
            <Smartphone size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#1C1C1E]">Install on iPhone / iPad</p>
            <p className="text-[11px] text-[#8E8E93]">Tap to see how to add to home screen</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowIOSInstructions(true)}
            className="px-3 py-1.5 bg-[#0A84FF] hover:bg-[#0071E3] text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            How
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-[#8E8E93] hover:text-[#1C1C1E] rounded-lg transition cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  if (isIOS && showIOSInstructions) {
    return (
      <div 
        id="pwa-ios-modal"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white border border-[#E5E5EA] rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-[#0A84FF]" />
            <p className="text-xs font-bold text-[#1C1C1E]">Add to Home Screen</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[#8E8E93] hover:text-[#1C1C1E] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5 text-xs text-[#3A3A3C]">
          <p className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#F2F2F7] flex items-center justify-center font-bold text-[10px] text-[#8E8E93]">1</span>
            <span>Tap the <strong className="inline-flex items-center gap-1 text-[#0A84FF]"><Share size={12} /> Share</strong> button in Safari</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#F2F2F7] flex items-center justify-center font-bold text-[10px] text-[#8E8E93]">2</span>
            <span>Scroll down and select <strong className="inline-flex items-center gap-1 text-[#1C1C1E]"><PlusSquare size={12} /> Add to Home Screen</strong></span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-1 w-full py-1.5 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          Got it
        </button>
      </div>
    );
  }

  return null;
};
