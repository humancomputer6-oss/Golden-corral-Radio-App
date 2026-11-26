import React, { useState } from 'react';
import {
  Bell,
  Check,
  ClipboardList,
  LogIn,
  LogOut,
  Radio,
  Shield,
  Sliders,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ListenView } from './components/ListenView';
import { ZonesScheduleView } from './components/ZonesScheduleView';
import { OperationsView } from './components/OperationsView';
import { SubmitView } from './components/SubmitView';
import { AdminView } from './components/AdminView';
import { RadioProvider, useRadio } from './context/RadioContext';

type AppTab = 'listen' | 'zones' | 'operations' | 'submit' | 'admin';

const NAV_ITEMS: { id: AppTab; label: string; mobileLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'listen', label: 'Listen', mobileLabel: 'Listen', icon: Radio },
  { id: 'zones', label: 'Zones & Hours', mobileLabel: 'Zones', icon: Sliders },
  { id: 'operations', label: 'Operations', mobileLabel: 'Ops', icon: ClipboardList },
  { id: 'submit', label: 'Submit Track', mobileLabel: 'Submit', icon: UploadCloud },
  { id: 'admin', label: 'Admin', mobileLabel: 'Admin', icon: Shield },
];

const AppShell: React.FC = () => {
  const {
    user,
    profile,
    signingIn,
    authError,
    clearAuthError,
    signIn,
    logOut,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    simulatedOffline,
  } = useRadio();

  const [activeTab, setActiveTab] = useState<AppTab>('listen');
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#1A1614]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 lg:h-16 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('listen')}
            className="text-base sm:text-lg font-bold tracking-tight text-stone-900 font-display whitespace-nowrap shrink-0 text-left"
          >
            Golden Corral Clean Radio
          </button>

          {/* Zone 2: Clean Single-Line Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[40px] px-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'border-amber-600 text-stone-950'
                      : 'border-transparent text-stone-600 hover:text-stone-950'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {!user ? (
              <button
                type="button"
                onClick={signIn}
                disabled={signingIn}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#1A1614] px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                {signingIn ? 'Signing In...' : 'Sign In'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Account and real-time notifications"
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Bell className="w-4 h-4 text-amber-700" />
                <span className="hidden sm:inline max-w-[140px] truncate">
                  {profile?.displayName || user.email}
                </span>
                {unreadNotificationCount > 0 && (
                  <span className="font-mono tabular-nums text-amber-800">
                    ({unreadNotificationCount})
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Responsive Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 lg:pb-12 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-500">
            {profile
              ? `Signed in as ${profile.displayName} · Role: ${profile.role}`
              : 'Free Subscriber Mode · Stream royalty-free ambiance and save tracks offline'}
          </p>
          <PWAInstallButton />
        </div>

        {authError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-center justify-between gap-3"
          >
            <span>{authError}</span>
            <button
              type="button"
              onClick={clearAuthError}
              aria-label="Dismiss sign-in notice"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-amber-900 hover:bg-amber-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'listen' && <ListenView />}
        {activeTab === 'zones' && <ZonesScheduleView />}
        {activeTab === 'operations' && <OperationsView />}
        {activeTab === 'submit' && <SubmitView />}
        {activeTab === 'admin' && <AdminView />}
      </main>

      {/* Desktop Quiet Footer */}
      <footer className="hidden lg:block border-t border-stone-200 bg-white/60">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-stone-500">
          <span>Golden Corral Clean Radio · Family-Friendly Hospitality Broadcast Hub</span>
          <span>Royalty-Free Licensed Audio · Clean Radio Edits Only</span>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Thumb-Zone Navigation Bar (<= 15% cap with header) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-t border-stone-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-amber-700' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Account & Real-Time Notifications Slide-Over Drawer */}
      {drawerOpen && user && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full flex flex-col border-l border-stone-200 shadow-2xl">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-stone-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 truncate">
                    {profile?.displayName || 'Subscriber'}
                  </p>
                  <p className="text-xs text-stone-500 truncate">
                    {user.email} · {profile?.role || 'subscriber'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close notifications drawer"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900 font-display">
                  Real-Time Notifications
                </h2>
                <span className="text-xs font-mono tabular-nums text-stone-500">
                  {unreadNotificationCount} unread
                </span>
              </div>

              {notifications.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">
                  No notifications yet. Submission status changes and report dispatches appear here automatically.
                </p>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-xl border p-3.5 space-y-1.5 ${
                        n.read ? 'border-stone-200 bg-white' : 'border-amber-300 bg-amber-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-stone-900">{n.title}</p>
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            aria-label="Mark notification read"
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-amber-800 hover:bg-amber-100 shrink-0"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">{n.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-stone-200 space-y-2">
              <PWAInstallButton />
              <button
                type="button"
                onClick={async () => {
                  await logOut();
                  setDrawerOpen(false);
                }}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator simulatedOffline={simulatedOffline} />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <RadioProvider>
        <AppShell />
      </RadioProvider>
    </ErrorBoundary>
  );
}
