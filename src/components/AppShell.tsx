import React, { useState } from 'react';
import {
  Building2,
  CalendarDays,
  CreditCard,
  Home,
  KeyRound,
  LayoutGrid,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Ticket as TicketIcon,
  UserCircle2,
  Users,
  Vote,
  Wrench,
  X,
} from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';
import type { LanguageCode, UserAccount } from '../types/society';
import { isSecretary, isSocietyManagement } from '../utils/permissions';
import { OfflineIndicator, PWAInstallButton } from './PWAComponents';

export type NavTabId =
  | 'home'
  | 'tickets'
  | 'finance'
  | 'services'
  | 'amenities'
  | 'governance'
  | 'operations'
  | 'profile';

interface AppShellProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  currentUser: UserAccount;
  availableUsers: UserAccount[];
  onSwitchUser: (userId: string) => void;
  onLoginWithPin: (email: string, pin: string) => Promise<void>;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  largeText: boolean;
  onQuickRaiseTicket: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  availableUsers,
  onSwitchUser,
  onLoginWithPin,
  lang,
  onChangeLang,
  darkMode,
  onToggleDark,
  largeText,
  onQuickRaiseTicket,
  children,
}) => {
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'switch' | 'login'>('switch');
  const [loginEmail, setLoginEmail] = useState('secretary@aureliacrest.in');
  const [loginPin, setLoginPin] = useState('2026');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const isSecurity = currentUser.role === 'security';
  const isVendor = currentUser.role === 'vendor';
  const isManagement = isSocietyManagement(currentUser);

  const navItems: {
    id: NavTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hidden?: boolean;
  }[] = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'tickets', label: t.navTickets, icon: TicketIcon },
    { id: 'finance', label: t.navFinance, icon: CreditCard, hidden: isSecurity || isVendor },
    { id: 'services', label: t.navServices, icon: Wrench, hidden: isSecurity },
    { id: 'amenities', label: t.navAmenities, icon: CalendarDays, hidden: isSecurity || isVendor },
    { id: 'governance', label: t.navGovernance, icon: Vote, hidden: isSecurity || isVendor },
    { id: 'operations', label: t.navOperations, icon: ShieldCheck, hidden: isVendor },
    {
      id: 'profile',
      label: isSecretary(currentUser)
        ? 'Secretary Console & Profile'
        : isManagement
        ? 'Flats, Reports & Profile'
        : t.navProfile,
      icon: UserCircle2,
    },
  ];

  const visibleNav = navItems.filter((item) => !item.hidden);
  const currentItem = visibleNav.find((i) => i.id === activeTab) || visibleNav[0];

  const mobilePrimaryIds: NavTabId[] = isSecurity
    ? ['home', 'operations', 'tickets', 'profile']
    : isVendor
    ? ['home', 'tickets', 'services', 'profile']
    : ['home', 'tickets', 'finance', 'services'];

  const mobilePrimaryTabs = visibleNav.filter((item) => mobilePrimaryIds.includes(item.id)).slice(0, 4);
  const mobileMoreTabs = visibleNav.filter((item) => !mobilePrimaryIds.includes(item.id));

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      await onLoginWithPin(loginEmail.trim(), loginPin.trim());
      setRoleDrawerOpen(false);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
        largeText ? 'large-text-mode' : ''
      }`}
    >
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            {t.brand}
          </span>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {t.societyTag}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary Navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/70 dark:text-teal-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? 'text-teal-800 dark:text-teal-300' : ''}`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Account / Hierarchy Switcher */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setRoleDrawerOpen(true)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800/60 transition-colors"
          >
            <p className="text-xs font-medium text-teal-800 dark:text-teal-300 truncate">
              {isSecretary(currentUser) ? 'Root Secretary Account' : 'Sub-Account · Switch / Sign In'}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
              {currentUser.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {currentUser.roleTitle}
            </p>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="lg:pl-64 flex min-h-screen flex-col">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md lg:px-8 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setRoleDrawerOpen(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Switch active account or sign in"
            >
              <Users className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="hidden sm:inline whitespace-nowrap">Aurelia Crest CHS</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <h1 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                  {currentItem?.label}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <select
              aria-label="Select interface language"
              value={lang}
              onChange={(e) => onChangeLang(e.target.value as LanguageCode)}
              className="hidden sm:block min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="en">EN</option>
              <option value="hi">हिंदी</option>
              <option value="mr">मराठी</option>
            </select>

            <button
              type="button"
              onClick={onToggleDark}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="hidden md:block">
              <PWAInstallButton label={t.installApp} compact />
            </div>

            {!isVendor && (
              <button
                type="button"
                onClick={onQuickRaiseTicket}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-900 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.quickRaiseTicket}</span>
                <span className="sm:hidden">Ticket</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport Content */}
        <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden pb-safe dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {mobilePrimaryTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMoreSheetOpen(false);
                }}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                  active
                    ? 'text-teal-800 dark:text-teal-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium tracking-tight truncate max-w-full">
                  {item.id === 'finance'
                    ? 'Pay'
                    : item.id === 'services'
                    ? 'Services'
                    : item.id === 'operations'
                    ? 'Gate'
                    : item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreSheetOpen(true)}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
              moreSheetOpen || mobileMoreTabs.some((m) => m.id === activeTab)
                ? 'text-teal-800 dark:text-teal-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile More Bottom Sheet */}
      {moreSheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/50 backdrop-blur-sm">
          <div className="rounded-t-3xl border-t border-slate-200 bg-white px-5 pb-8 pt-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                All Society Modules
              </h2>
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {mobileMoreTabs.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setMoreSheetOpen(false);
                    }}
                    className={`min-h-[56px] flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-200'
                        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-400" />
                    <span className="text-xs font-medium leading-snug">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <PWAInstallButton label={t.installApp} />
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => onChangeLang(e.target.value as LanguageCode)}
                className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Account Switcher & MySQL Email+PIN Login Drawer */}
      {roleDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[88vh] flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Secretary Root &amp; Sub-Account Access
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Single Root Secretary account oversees all residents, staff, tickets, and social posts in MySQL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleDrawerOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close account switcher"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800 self-start">
              <button
                type="button"
                onClick={() => setAuthTab('switch')}
                className={`min-h-[34px] rounded-md px-3 text-xs font-medium ${
                  authTab === 'switch'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Quick Switch ({availableUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-medium ${
                  authTab === 'login'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Sign In with PIN
              </button>
            </div>

            {authTab === 'switch' ? (
              <div className="mt-4 overflow-y-auto space-y-2 pr-1">
                {availableUsers.map((u) => {
                  const selected = u.id === currentUser.id;
                  const isRoot = u.role === 'secretary';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!u.isActive}
                      onClick={() => {
                        onSwitchUser(u.id);
                        setRoleDrawerOpen(false);
                      }}
                      className={`w-full min-h-[56px] flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50 ${
                        selected
                          ? 'border-teal-700 bg-teal-50/80 dark:border-teal-500 dark:bg-teal-950/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {u.name}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            {isRoot ? '· Root Secretary' : '· Under Secretary'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {u.roleTitle} · {u.email}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-teal-800 dark:text-teal-300 whitespace-nowrap shrink-0">
                        {!u.isActive ? 'Suspended' : selected ? 'Active' : 'Select'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={handlePinSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="secretary@aureliacrest.in"
                    className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Security PIN (default demo PIN: 2026)
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value)}
                    className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                {loginError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">{loginError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="min-h-[42px] rounded-lg bg-teal-800 px-5 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-50"
                  >
                    {loggingIn ? 'Authenticating...' : 'Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <OfflineIndicator label={t.offlineBanner} />
    </div>
  );
};
