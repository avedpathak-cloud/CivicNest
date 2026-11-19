import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BootstrapPayload,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../types/society';
import {
  formatDateTime,
  formatINR,
  getPriorityTextClass,
  getStatusTextClass,
} from '../utils/format';
import { canManageBilling, canManageTickets, isSecretary } from '../utils/permissions';

interface TicketsViewProps {
  data: BootstrapPayload;
  onCreateTicket: (payload: {
    category: TicketCategory;
    priority: TicketPriority;
    title: string;
    description: string;
    location: string;
    preferredContactTime: string;
  }) => Promise<void>;
  onUpdateTicket: (ticketId: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteTicket: (ticketId: string) => Promise<void>;
  createModalOpen: boolean;
  onSetCreateModalOpen: (open: boolean) => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  data,
  onCreateTicket,
  onUpdateTicket,
  onDeleteTicket,
  createModalOpen,
  onSetCreateModalOpen,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(data.tickets[0]?.id ?? null);
  const [confirmDeleteTicketId, setConfirmDeleteTicketId] = useState<string | null>(null);

  // New ticket form state
  const [category, setCategory] = useState<TicketCategory>('plumbing');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(
    data.myFlat ? `${data.myFlat.tower} · Flat ${data.myFlat.flatNumber}` : 'Common Area'
  );
  const [preferredContactTime, setPreferredContactTime] = useState('Weekdays 6:00 PM – 8:00 PM');
  const [submitting, setSubmitting] = useState(false);

  // Detail action states
  const [commentText, setCommentText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [costEstimateInput, setCostEstimateInput] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const user = data.currentUser;
  const isManagement = canManageTickets(user);
  const isFinanceApprover = canManageBilling(user);
  const isVendor = user.role === 'vendor';

  const filtered = data.tickets.filter((t) => {
    const isClosed = ['Resolved', 'Closed', 'Cancelled'].includes(t.status);
    if (filterStatus === 'open' && isClosed) return false;
    if (filterStatus === 'resolved' && !isClosed) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.flatNumber.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedTicket: Ticket | null =
    filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);
    try {
      await onCreateTicket({
        category,
        priority,
        title,
        description,
        location,
        preferredContactTime,
      });
      setTitle('');
      setDescription('');
      onSetCreateModalOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const runTicketAction = async (payload: Record<string, unknown>, onSuccess?: () => void) => {
    if (!selectedTicket) return;
    setActionError(null);
    try {
      await onUpdateTicket(selectedTicket.id, payload);
      onSuccess?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'all', label: `All (${data.tickets.length})` },
                {
                  id: 'open',
                  label: `Active (${
                    data.tickets.filter((t) => !['Resolved', 'Closed', 'Cancelled'].includes(t.status)).length
                  })`,
                },
                {
                  id: 'resolved',
                  label: `Resolved / Closed (${
                    data.tickets.filter((t) => ['Resolved', 'Closed'].includes(t.status)).length
                  })`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filterStatus === tab.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket ID, flat, topic..."
              className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          {!isVendor && (
            <button
              type="button"
              onClick={() => onSetCreateModalOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Ticket</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          {actionError}
        </div>
      )}

      {/* Split Master-Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ticket List */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800 overflow-hidden">
          {filtered.map((t) => {
            const active = selectedTicket?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full p-4 text-left transition-colors ${
                  active
                    ? 'bg-teal-50/70 dark:bg-teal-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                    {t.ticketNumber} · {t.flatNumber}
                  </span>
                  <span className={getStatusTextClass(t.status)}>{t.status}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {t.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="capitalize">{t.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className={`capitalize ${getPriorityTextClass(t.priority)}`}>{t.priority}</span>
                  {t.slaBreached && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-red-600 dark:text-red-400 font-semibold">Overdue SLA</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No tickets match this filter.</p>
            </div>
          )}
        </div>

        {/* Ticket Detail & Audit Timeline */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {selectedTicket ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                      {selectedTicket.ticketNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedTicket.location}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`capitalize ${getPriorityTextClass(selectedTicket.priority)}`}>
                      {selectedTicket.priority} priority
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-display text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedTicket.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Raised by {selectedTicket.raisedByName} on {formatDateTime(selectedTicket.createdAt)} · Preferred time: {selectedTicket.preferredContactTime}
                  </p>
                </div>

                <div className="text-right space-y-1.5">
                  <div>
                    <span className={`text-sm font-semibold ${getStatusTextClass(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </span>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                      SLA Target: {selectedTicket.slaResolutionHours}h
                    </p>
                  </div>
                  {(isSecretary(user) || selectedTicket.raisedByUserId === user.id) && (
                    confirmDeleteTicketId === selectedTicket.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await onDeleteTicket(selectedTicket.id);
                              setConfirmDeleteTicketId(null);
                            } catch (err) {
                              setActionError(err instanceof Error ? err.message : 'Unable to delete ticket.');
                            }
                          }}
                          className="min-h-[32px] rounded-md bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTicketId(null)}
                          className="min-h-[32px] rounded-md border border-slate-200 px-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTicketId(selectedTicket.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Ticket</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {selectedTicket.description}
              </p>

              {/* Cost Estimate & Approval Block */}
              {selectedTicket.costEstimate !== null && selectedTicket.costEstimate > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Estimated Repair Cost
                    </p>
                    <p className="mt-0.5 font-mono-num text-lg font-semibold text-slate-900 dark:text-white">
                      {formatINR(selectedTicket.costEstimate)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {selectedTicket.costApproved
                          ? `Approved by ${selectedTicket.costApproverName}`
                          : 'Awaiting Committee / Treasurer approval'}
                      </span>
                    </p>
                  </div>
                  {!selectedTicket.costApproved && isFinanceApprover && (
                    <button
                      type="button"
                      onClick={() => runTicketAction({ action: 'approve_cost' })}
                      className="min-h-[40px] rounded-lg bg-teal-800 px-4 py-2 text-xs font-medium text-white hover:bg-teal-900"
                    >
                      Approve Estimate
                    </button>
                  )}
                </div>
              )}

              {/* Completion Notes & Resident Rating / Reopen */}
              {selectedTicket.completionNotes && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Completion Proof &amp; Resolution Notes
                  </p>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                    {selectedTicket.completionNotes}
                  </p>
                </div>
              )}

              {selectedTicket.status === 'Resolved' &&
                (selectedTicket.flatId === user.flatId || isManagement) && (
                  <div className="rounded-xl border border-slate-200 p-4 space-y-4 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Confirm Resolution &amp; Rate Work Quality
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingScore(star)}
                          className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border transition-colors ${
                            ratingScore >= star
                              ? 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'border-slate-200 text-slate-400 dark:border-slate-700'
                          }`}
                          aria-label={`Rate ${star} stars`}
                        >
                          <Star className="h-4 w-4 fill-current" />
                        </button>
                      ))}
                      <input
                        type="text"
                        value={ratingFeedback}
                        onChange={(e) => setRatingFeedback(e.target.value)}
                        placeholder="Optional feedback..."
                        className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          runTicketAction({
                            action: 'rate',
                            rating: ratingScore,
                            feedback: ratingFeedback,
                          })
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-medium text-white hover:bg-teal-900"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirm &amp; Close</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <input
                        type="text"
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="Issue persists? Enter reason to reopen..."
                        className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          runTicketAction(
                            { action: 'reopen', comment: reopenReason },
                            () => setReopenReason('')
                          )
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reopen Ticket</span>
                      </button>
                    </div>
                  </div>
                )}

              {/* Staff / Vendor Workflow Controls */}
              {(isManagement || isVendor) && selectedTicket.status !== 'Closed' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Staff &amp; Vendor Dispatch Controls
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        'Acknowledged',
                        'Assigned',
                        'In Progress',
                        'Waiting for Vendor',
                        'Waiting for Approval',
                        'Resolved',
                      ] as TicketStatus[]
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          runTicketAction({
                            status: st,
                            assigneeName: selectedTicket.assigneeName || user.name,
                            completionNotes: st === 'Resolved' ? completionNotes || 'Work completed and inspected.' : undefined,
                            costEstimate: costEstimateInput ? Number(costEstimateInput) : undefined,
                          })
                        }
                        className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedTicket.status === st
                            ? 'border-teal-700 bg-teal-800 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <input
                      type="number"
                      value={costEstimateInput}
                      onChange={(e) => setCostEstimateInput(e.target.value)}
                      placeholder="Optional cost estimate (₹)"
                      className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="Work completion summary (for Resolved)"
                      className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Resident-Visible Conversation */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  <span>Resident-Visible Updates</span>
                </h4>
                <div className="space-y-2.5">
                  {selectedTicket.comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {c.authorName} · {c.authorRole}
                        </span>
                        <span>{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{c.message}</p>
                    </div>
                  ))}
                  {selectedTicket.comments.length === 0 && (
                    <p className="text-xs text-slate-500">No comments yet.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a resident-visible update or reply..."
                    className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      commentText.trim() &&
                      runTicketAction({ action: 'comment', comment: commentText }, () =>
                        setCommentText('')
                      )
                    }
                    className="min-h-[40px] rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Post
                  </button>
                </div>
              </div>

              {/* Confidential Staff / Committee Internal Notes (Never exposed to residents) */}
              {isManagement && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Internal Committee &amp; Staff Notes (Hidden from Residents)</span>
                  </div>
                  {(selectedTicket.internalNotes || []).map((n) => (
                    <div key={n.id} className="text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">{n.authorName}:</span> {n.note}{' '}
                      <span className="text-slate-400">({formatDateTime(n.createdAt)})</span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={internalNoteText}
                      onChange={(e) => setInternalNoteText(e.target.value)}
                      placeholder="Add confidential staff note..."
                      className="min-h-[38px] flex-1 rounded-lg border border-amber-200 bg-white px-3 text-xs dark:border-amber-800 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        internalNoteText.trim() &&
                        runTicketAction(
                          { action: 'internal_note', internalNote: internalNoteText },
                          () => setInternalNoteText('')
                        )
                      }
                      className="min-h-[38px] rounded-lg bg-amber-700 px-3 text-xs font-medium text-white hover:bg-amber-800"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Status History */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status Timeline
                </h4>
                <ol className="mt-3 space-y-2.5">
                  {selectedTicket.history.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-4 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{h.status}</span>{' '}
                        <span className="text-slate-600 dark:text-slate-400">— {h.summary}</span>
                        <span className="block text-slate-400">
                          {h.actorName} ({h.actorRole})
                        </span>
                      </div>
                      <span className="font-mono-num text-slate-400 whitespace-nowrap shrink-0">
                        {formatDateTime(h.timestamp)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Select a ticket to view SLA timeline and actions.
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmitTicket}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Raise Helpdesk Ticket
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tracked with automatic SLA escalation and completion proof.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSetCreateModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="plumbing">Plumbing &amp; Water</option>
                  <option value="electrical">Electrical</option>
                  <option value="lift">Lift / Elevator</option>
                  <option value="security">Security &amp; Gate</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="parking">Parking</option>
                  <option value="noise">Noise / Nuisance</option>
                  <option value="billing">Billing &amp; Accounts</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Urgency &amp; SLA Objective
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="normal">Normal (1 day response · 3 days)</option>
                  <option value="high">High (1 hr response · 24h)</option>
                  <option value="emergency">Emergency / Safety (Immediate alert)</option>
                  <option value="low">Low / Improvement (2d · 10d)</option>
                </select>
              </div>
            </div>

            {priority === 'emergency' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Emergency tickets trigger an immediate alert to society staff. For fire, medical, or police emergencies, call <strong>112</strong> directly.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue"
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Description &amp; Details
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, exact floor/shaft, and any safety concern..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preferred Contact / Visit Window
              </label>
              <input
                type="text"
                value={preferredContactTime}
                onChange={(e) => setPreferredContactTime(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onSetCreateModalOpen(false)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
