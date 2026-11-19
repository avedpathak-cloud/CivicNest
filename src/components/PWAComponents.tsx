import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC<{ label?: string; compact?: boolean }> = ({
  label = 'Install App',
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-lg border border-teal-700/20 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-900/60 font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>{isIOS ? 'iOS Install' : 'Android / Web App'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Install CivicNest on Mobile or Desktop
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Run CivicNest as a standalone app with offline notice &amp; gate-pass access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-700 dark:text-slate-300">
              {isIOS ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="font-medium text-slate-900 dark:text-white">iPhone / iPad (Safari)</p>
                  <ol className="mt-2 list-decimal pl-5 space-y-1.5">
                    <li>Tap the Share button in the Safari toolbar.</li>
                    <li>Scroll down and tap Add to Home Screen.</li>
                    <li>Tap Add to launch CivicNest in standalone mode.</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="font-medium text-slate-900 dark:text-white">Android (Chrome / Edge)</p>
                  <ol className="mt-2 list-decimal pl-5 space-y-1.5">
                    <li>Open browser menu (three dots at top-right).</li>
                    <li>Tap Install app or Add to Home screen.</li>
                    <li>Confirm Install to add CivicNest to your Android launcher.</li>
                  </ol>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-medium text-slate-900 dark:text-white">Desktop (Chrome / Edge)</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  Click the install icon in the browser address bar to pin CivicNest as a desktop window.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ label?: string }> = ({
  label = 'Offline Mode — Cached society records are available.',
}) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 lg:bottom-5 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-950 shadow-md dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-300" />
      <span>{label}</span>
    </div>
  );
};
