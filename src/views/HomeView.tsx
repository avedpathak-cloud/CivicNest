import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CreditCard,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Ticket as TicketIcon,
  Vote,
  Wrench,
  X,
} from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';
import type { BootstrapPayload, LanguageCode, SosAlert } from '../types/society';
import type { NavTabId } from '../components/AppShell';
import { SocialFeedSection } from '../components/SocialFeedSection';
import { formatDateShort, formatDateTime, formatINR, getPriorityTextClass, getStatusTextClass } from '../utils/format';
import { isSecretary, isSocietyManagement } from '../utils/permissions';

interface HomeViewProps {
  data: BootstrapPayload;
  lang: LanguageCode;
  onNavigate: (tab: NavTabId) => void;
  onQuickRaiseTicket: () => void;
  onUploadSocialImage: (dataUrl: string) => Promise<string>;
  onCreateSocialPost: (payload: {
    caption: string;
    category: string;
    imageUrl?: string | null;
  }) => Promise<void>;
  onToggleLikePost: (postId: string) => Promise<void>;
  onToggleSavePost: (postId: string) => Promise<void>;
  onAddPostComment: (postId: string, text: string) => Promise<void>;
  onDeletePostComment: (postId: string, commentId: string) => Promise<void>;
  onReportPost: (postId: string, reason: string) => Promise<void>;
  onModeratePost: (
    postId: string,
    action: 'pin' | 'unpin' | 'hide' | 'unhide' | 'delete',
    note?: string
  ) => Promise<void>;
  onTriggerSos: (payload: { alertType: SosAlert['alertType']; message: string }) => Promise<void>;
  onUpdateSosStatus: (sosId: string, status: 'acknowledged' | 'resolved') => Promise<void>;
}

export const HomeView: React.FC<HomeViewProps> = ({
  data,
  lang,
  onNavigate,
  onQuickRaiseTicket,
  onUploadSocialImage,
  onCreateSocialPost,
  onToggleLikePost,
  onToggleSavePost,
  onAddPostComment,
  onDeletePostComment,
  onReportPost,
  onModeratePost,
  onTriggerSos,
  onUpdateSosStatus,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosType, setSosType] = useState<SosAlert['alertType']>('medical');
  const [sosNote, setSosNote] = useState('');
  const [sosBusy, setSosBusy] = useState(false);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const user = data.currentUser;
  const isManagement = isSocietyManagement(user);
  const isRootSecretary = isSecretary(user);
  const isSecurity = user.role === 'security';
  const isVendor = user.role === 'vendor';

  const unpaidInvoices = data.invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial');
  const totalDue = unpaidInvoices.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const openTickets = data.tickets.filter((tk) => !['Resolved', 'Closed', 'Cancelled'].includes(tk.status));
  const pendingVotes = data.votes.filter((v) => v.status === 'open' && !v.hasUserFlatVoted);
  const myBookings = data.bookings.filter(
    (b) => b.status === 'confirmed' && (isManagement || b.flatId === user.flatId)
  );

  const activeSosAlerts = (data.sosAlerts || []).filter((s) => s.status !== 'resolved');
  const canHandleSos = isRootSecretary || isSecurity || user.role === 'facility_manager';

  return (
    <div className="space-y-8">
      {/* Active Emergency SOS Dispatch Banner */}
      {activeSosAlerts.length > 0 && (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40 space-y-3">
          {activeSosAlerts.map((sos) => (
            <div key={sos.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Siren className="h-5 w-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
                    Active {sos.alertType} SOS · Flat {sos.flatNumber || 'Campus'} ({sos.tower || 'Main'}) ·{' '}
                    {formatDateTime(sos.createdAt)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {sos.userName}: {sos.message}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Status: {sos.status}
                    {sos.acknowledgedBy ? ` · Responding: ${sos.acknowledgedBy}` : ''}
                  </p>
                </div>
              </div>
              {canHandleSos && (
                <div className="flex items-center gap-2">
                  {sos.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => onUpdateSosStatus(sos.id, 'acknowledged')}
                      className="min-h-[38px] rounded-lg bg-red-700 px-3.5 text-xs font-medium text-white hover:bg-red-800"
                    >
                      Acknowledge Dispatch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdateSosStatus(sos.id, 'resolved')}
                    className="min-h-[38px] rounded-lg border border-red-300 bg-white px-3.5 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-200"
                  >
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Architectural Society Banner — Focal Anchor */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="grid lg:grid-cols-12 lg:items-stretch">
          <div className="p-6 sm:p-8 lg:col-span-7 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-teal-800 dark:text-teal-300">
                {data.society.societyName} · {data.society.city}
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t.welcomeTitle}, {user.name.split(' ')[0]}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                {user.roleTitle}.{' '}
                {isRootSecretary
                  ? 'Root Secretary command: create & manage resident/staff sub-accounts, moderate community posts, resolve or remove tickets, and oversee collections.'
                  : isManagement
                  ? 'Monitor ticket SLAs, maintenance collections, group service demand, and resolutions across all towers.'
                  : isSecurity
                  ? 'Manage visitor check-ins, pre-approved gate passes, delivery logs, and safety alerts.'
                  : isVendor
                  ? 'View your assigned society work orders and group service campaign appointments.'
                  : 'Share flat decor & thoughts on the community wall, track dues, helpdesk SLAs, group discounts, and society votes.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isRootSecretary && (
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900 transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Manage Sub-Accounts ({data.availableUsers.length - 1})</span>
                </button>
              )}
              {!isRootSecretary && !isSecurity && !isVendor && (
                <button
                  type="button"
                  onClick={() => onNavigate(totalDue > 0 ? 'finance' : 'services')}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900 transition-colors whitespace-nowrap"
                >
                  <span>{totalDue > 0 ? `${t.payDues} (${formatINR(totalDue)})` : 'Explore Group Services'}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              )}
              {!isVendor && (
                <button
                  type="button"
                  onClick={onQuickRaiseTicket}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <TicketIcon className="h-4 w-4 shrink-0" />
                  <span>{t.quickRaiseTicket}</span>
                </button>
              )}
              {isSecurity && (
                <button
                  type="button"
                  onClick={() => onNavigate('operations')}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900 transition-colors whitespace-nowrap"
                >
                  <span>Open Gate Operations</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>
          </div>

          <div className="relative min-h-[200px] lg:col-span-5 bg-slate-100 dark:bg-slate-800">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/society_campus_hero_1795110531649.jpg"
                alt="Aurelia Crest Co-operative Housing Society landscaped courtyard"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover lg:h-full"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-teal-900 to-slate-900 p-6 text-white">
                <Building2 className="h-10 w-10 text-teal-300" />
                <p className="mt-2 text-sm font-medium">Aurelia Crest Campus</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent flex items-end p-5">
              <div className="text-white">
                <p className="text-xs text-teal-200">
                  {data.society.occupiedFlats} / {data.society.totalFlats} Occupied Flats ·{' '}
                  {Math.round((data.society.digitalAdoptionFlats / data.society.occupiedFlats) * 100)}% Digital Adoption
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isManagement ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Open Tickets · Overdue</p>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900 dark:text-white">
                {data.society.ticketStats.open}{' '}
                <span className="text-sm font-normal text-red-600 dark:text-red-400">
                  / {data.society.ticketStats.overdue} overdue
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {data.society.ticketStats.slaCompliancePct}% within SLA
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Maintenance Collected</p>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900 dark:text-white">
                {data.society.financeStats.collectionRatePct}%
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                {formatINR(data.society.financeStats.outstandingTotal)} outstanding
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Group Service Opt-Ins</p>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-teal-800 dark:text-teal-300">
                {data.society.campaignStats.totalOptIns}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                {formatINR(data.society.campaignStats.estimatedResidentSavings)} resident savings
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Community Social Wall</p>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900 dark:text-white">
                {data.socialPosts.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Flat decor &amp; resident posts
              </p>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => !isSecurity && !isVendor && onNavigate('finance')}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-teal-700/40 transition-colors dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isSecurity ? 'Visitors Today' : isVendor ? 'Assigned Jobs' : 'Maintenance Due'}
                </span>
                <CreditCard className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900 dark:text-white">
                {isSecurity
                  ? data.visitors.length
                  : isVendor
                  ? openTickets.length
                  : formatINR(totalDue)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isSecurity
                  ? `${data.visitors.filter((v) => v.status === 'checked_in').length} inside campus`
                  : isVendor
                  ? 'Active work orders'
                  : unpaidInvoices.length > 0
                  ? `Due ${formatDateShort(unpaidInvoices[0].dueDate)}`
                  : 'All invoices settled'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-teal-700/40 transition-colors dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Open Tickets</span>
                <TicketIcon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900 dark:text-white">
                {openTickets.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {data.tickets.filter((tk) => tk.status === 'Resolved').length} awaiting confirmation
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate(isSecurity ? 'operations' : 'services')}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-teal-700/40 transition-colors dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isSecurity ? 'Pre-Approved Passes' : 'Active Group Deals'}
                </span>
                <Wrench className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-teal-800 dark:text-teal-300">
                {isSecurity
                  ? data.visitors.filter((v) => v.status === 'pre_approved').length
                  : data.campaigns.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isSecurity ? 'Expected arrivals' : 'Up to 15% bulk discount'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate(isSecurity || isVendor ? 'tickets' : 'governance')}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-teal-700/40 transition-colors dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isSecurity || isVendor ? 'Upcoming Bookings' : 'Pending Votes'}
                </span>
                <Vote className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900 dark:text-white">
                {isSecurity || isVendor ? myBookings.length : pendingVotes.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isSecurity || isVendor ? 'Amenity slots' : 'Open polls & resolutions'}
              </p>
            </button>
          </>
        )}
      </section>

      {/* FB / Instagram-Style Community Social Feed on Main Page */}
      <SocialFeedSection
        posts={data.socialPosts}
        currentUser={user}
        onUploadImage={onUploadSocialImage}
        onCreatePost={onCreateSocialPost}
        onToggleLike={onToggleLikePost}
        onToggleSave={onToggleSavePost}
        onAddComment={onAddPostComment}
        onDeleteComment={onDeletePostComment}
        onReportPost={onReportPost}
        onModeratePost={onModeratePost}
      />

      {/* Two-Column Operations & Official Notices Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {isManagement ? 'Priority Ticket Queue' : 'Recent Helpdesk Activity'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracked response &amp; resolution SLAs
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="text-xs font-medium text-teal-800 hover:underline dark:text-teal-300 whitespace-nowrap shrink-0"
            >
              View all tickets
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.tickets.slice(0, 4).map((tk) => (
              <div key={tk.id} className="py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">
                      {tk.ticketNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{tk.flatNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`capitalize ${getPriorityTextClass(tk.priority)}`}>
                      {tk.priority} priority
                    </span>
                    {tk.slaBreached && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">SLA Overdue</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white truncate">
                    {tk.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {tk.assigneeName ? `Assigned: ${tk.assigneeName}` : 'Pending assignment'}
                  </p>
                </div>

                <span className={`text-xs whitespace-nowrap shrink-0 ${getStatusTextClass(tk.status)}`}>
                  {tk.status}
                </span>
              </div>
            ))}
            {data.tickets.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No tickets logged for your scope.</p>
            )}
          </div>
        </section>

        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Official Notices &amp; Alerts
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('operations')}
                className="text-xs font-medium text-teal-800 hover:underline dark:text-teal-300 whitespace-nowrap"
              >
                All notices
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.notices.slice(0, 3).map((n) => (
                <div key={n.id} className="py-3.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={
                        n.category === 'emergency_alert'
                          ? 'text-red-700 dark:text-red-400 font-semibold'
                          : n.category === 'vendor_promo'
                          ? 'text-teal-800 dark:text-teal-300 font-medium'
                          : 'text-slate-700 dark:text-slate-300 font-medium'
                      }
                    >
                      {n.category === 'emergency_alert'
                        ? 'Emergency Alert'
                        : n.category === 'vendor_promo'
                        ? 'Vendor Offer (Opt-in)'
                        : 'Official Circular'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateShort(n.publishedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{n.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-slate-900 dark:text-white">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <h3 className="font-display text-sm font-semibold">Emergency &amp; Duty Contacts</h3>
              </div>
              {!isVendor && (
                <button
                  type="button"
                  onClick={() => setSosModalOpen(true)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-medium text-white hover:bg-red-800 whitespace-nowrap"
                >
                  <Siren className="h-3.5 w-3.5" />
                  <span>Trigger SOS</span>
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-slate-500 dark:text-slate-400">Main Gate 24x7</p>
                <p className="mt-0.5 font-mono-num font-semibold text-slate-900 dark:text-white">
                  +91 20 2681 0100
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-slate-500 dark:text-slate-400">National Emergency</p>
                <p className="mt-0.5 font-mono-num font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                  <PhoneCall className="h-3.5 w-3.5" /> 112 / Fire 101
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t.emergencyDisclaimer}
            </p>
          </section>
        </div>
      </div>

      {/* Live Group Service Highlight Strip */}
      {!isSecurity && data.campaigns.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Group-Buying Home Services Marketplace
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.groupDiscountNote}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('services')}
              className="min-h-[40px] rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Browse All Campaigns
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.campaigns.slice(0, 3).map((cmp) => (
              <div
                key={cmp.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {cmp.categoryGroup} · {cmp.confirmedCount} flats joined
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{cmp.name}</p>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="font-mono-num text-lg font-bold text-teal-800 dark:text-teal-300">
                      {formatINR(cmp.currentUnitPrice)}
                    </span>
                    {cmp.activeDiscountPct > 0 && (
                      <span className="ml-2 font-mono-num text-xs line-through text-slate-400">
                        {formatINR(cmp.basePrice)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {cmp.activeDiscountPct > 0
                      ? `${cmp.activeDiscountPct}% off unlocked`
                      : `Needs ${cmp.minConfirmedFlats} flats`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Emergency SOS Modal */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSosBusy(true);
              try {
                await onTriggerSos({
                  alertType: sosType,
                  message: sosNote.trim() || `Immediate ${sosType} assistance needed at Flat ${user.flatNumber || 'Campus'}.`,
                });
                setSosNote('');
                setSosModalOpen(false);
              } finally {
                setSosBusy(false);
              }
            }}
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <Siren className="h-5 w-5" />
                <h3 className="font-display text-lg font-semibold">Dispatch Society SOS Alert</h3>
              </div>
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Alerts Main Gate Security, Facility Manager, and Society Secretary immediately with your flat ({user.flatNumber || 'Campus'}) location.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'medical', label: 'Medical Emergency' },
                  { id: 'fire', label: 'Fire / Smoke' },
                  { id: 'lift', label: 'Lift Trapped' },
                  { id: 'security', label: 'Security Threat' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSosType(opt.id)}
                  className={`min-h-[44px] rounded-xl border px-3 text-xs font-medium text-left transition-colors ${
                    sosType === opt.id
                      ? 'border-red-600 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950/60 dark:text-red-200'
                      : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={sosNote}
              onChange={(e) => setSosNote(e.target.value)}
              placeholder="Optional details (floor, lift number, medical note)..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sosBusy}
                className="min-h-[44px] rounded-lg bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {sosBusy ? 'Dispatching...' : 'Send SOS Now'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
