import React, { useState } from 'react';
import { CheckCircle2, FileText, Lock, Plus, ShieldCheck, Vote, X } from 'lucide-react';
import type { BootstrapPayload, VoteProposal } from '../types/society';
import { formatDateShort, getStatusTextClass } from '../utils/format';
import { isSecretary } from '../utils/permissions';

interface GovernanceViewProps {
  data: BootstrapPayload;
  onCastVote: (voteId: string, optionIds: string[]) => Promise<void>;
  onCreateVote: (payload: {
    title: string;
    description: string;
    voteType: VoteProposal['voteType'];
    ballotMode: VoteProposal['ballotMode'];
    eligibleScope: VoteProposal['eligibleScope'];
    quorumPct: number;
    closesAt: string;
    options: string[];
  }) => Promise<void>;
  onUpdateResolution: (
    meetingId: string,
    resId: string,
    status: 'open' | 'in_progress' | 'completed'
  ) => Promise<void>;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  data,
  onCastVote,
  onCreateVote,
  onUpdateResolution,
}) => {
  const user = data.currentUser;
  const isManagement = isSecretary(user);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<VoteProposal['voteType']>('informal_poll');
  const [newBallotMode, setNewBallotMode] = useState<VoteProposal['ballotMode']>('secret');
  const [newScope, setNewScope] = useState<VoteProposal['eligibleScope']>('all_residents');
  const [newQuorum, setNewQuorum] = useState('25');
  const [newClosesAt, setNewClosesAt] = useState('2026-12-05');
  const [newOptionsText, setNewOptionsText] = useState('Approve\nReject\nAbstain');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectOption = (vote: VoteProposal, optId: string) => {
    setSelectedOptions((prev) => {
      const curr = prev[vote.id] || [];
      if (vote.selectionMode === 'multiple') {
        return {
          ...prev,
          [vote.id]: curr.includes(optId) ? curr.filter((x) => x !== optId) : [...curr, optId],
        };
      }
      return { ...prev, [vote.id]: [optId] };
    });
  };

  const handleSubmitVote = async (vote: VoteProposal) => {
    setErrorMsg(null);
    const chosen = selectedOptions[vote.id] || [];
    if (chosen.length === 0) {
      setErrorMsg('Please select an option before submitting your ballot.');
      return;
    }
    try {
      await onCastVote(vote.id, chosen);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cast vote.');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onCreateVote({
        title: newTitle,
        description: newDesc,
        voteType: newType,
        ballotMode: newBallotMode,
        eligibleScope: newScope,
        quorumPct: Number(newQuorum) || 25,
        closesAt: newClosesAt,
        options: newOptionsText.split('\n').filter((x) => x.trim()),
      });
      setNewTitle('');
      setNewDesc('');
      setCreateOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create vote.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Voting & Polls */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Voting, Polls &amp; Governance Resolutions
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Informal polls and formal resolutions are explicitly labelled. Secret ballots keep voter identity technically separated from ballot choice.
            </p>
          </div>
          {isManagement && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Create Poll / Resolution</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.votes.map((vote) => {
            const totalCast = Object.values(vote.tallies).reduce((s, n) => s + n, 0);
            const turnoutPct = Math.round((totalCast / vote.eligibleCount) * 100);
            const quorumMet = turnoutPct >= vote.quorumPct;
            const restrictedTenant =
              vote.eligibleScope === 'all_verified_owners' && user.role === 'tenant';

            return (
              <article
                key={vote.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={
                        vote.voteType === 'formal_resolution'
                          ? 'font-semibold text-teal-800 dark:text-teal-300'
                          : 'font-medium text-slate-700 dark:text-slate-300'
                      }
                    >
                      {vote.voteType === 'formal_resolution'
                        ? 'Formal Society Resolution'
                        : vote.voteType === 'committee_election'
                        ? 'Committee Election'
                        : 'Informal Community Poll'}
                    </span>
                    <span className="font-mono-num">
                      {vote.ballotMode === 'secret' ? 'Secret Ballot' : 'Attributable'} · Closes {formatDateShort(vote.closesAt)}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    {vote.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{vote.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>Reference: {vote.supportingDocTitle}</span>
                  </p>

                  {/* Quorum Progress */}
                  <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-700 dark:text-slate-300 font-mono-num">
                        Turnout: {totalCast} / {vote.eligibleCount} eligible ({turnoutPct}%)
                      </span>
                      <span className={quorumMet ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400'}>
                        {quorumMet ? `Quorum ${vote.quorumPct}% Met` : `Needs ${vote.quorumPct}% Quorum`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${Math.min(100, turnoutPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Options & Live Tally */}
                  <div className="space-y-2 pt-1">
                    {vote.options.map((opt) => {
                      const count = vote.tallies[opt.id] || 0;
                      const pct = totalCast > 0 ? Math.round((count / totalCast) * 100) : 0;
                      const chosen = (selectedOptions[vote.id] || []).includes(opt.id);
                      const canVote =
                        vote.status === 'open' && !vote.hasUserFlatVoted && !restrictedTenant && !!user.flatId;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!canVote}
                          onClick={() => handleSelectOption(vote, opt.id)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            chosen
                              ? 'border-teal-700 bg-teal-50/80 dark:border-teal-500 dark:bg-teal-950/50'
                              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                          } ${canVote ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40' : 'cursor-default'}`}
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-slate-900 dark:text-white">{opt.label}</span>
                            <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="mt-2 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-teal-700/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{vote.legalNotice}</p>

                  {vote.hasUserFlatVoted ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Ballot recorded for Flat {user.flatNumber} (Duplicate voting locked)</span>
                    </div>
                  ) : restrictedTenant ? (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <Lock className="h-4 w-4" />
                      <span>Restricted to verified flat owners per society bye-laws.</span>
                    </div>
                  ) : !user.permissions?.canVote ? (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <Lock className="h-4 w-4" />
                      <span>Voting permission restricted for this account by Society Secretary.</span>
                    </div>
                  ) : user.flatId && vote.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => handleSubmitVote(vote)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
                    >
                      <Vote className="h-4 w-4" />
                      <span>Cast Ballot for Flat {user.flatNumber}</span>
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">Staff account — voting requires verified flat membership.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Meetings, Minutes & Action Items */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Committee Meetings, Approved Minutes &amp; Action Items
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Published agendas and resolution tracking; confidential committee drafts are restricted from resident views.
          </p>
        </div>

        {data.meetings.map((mtg) => (
          <div
            key={mtg.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mtg.meetingType} · {formatDateShort(mtg.date)} · {mtg.venue}
                </p>
                <h4 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
                  {mtg.title}
                </h4>
              </div>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                {mtg.minutesApproved ? 'Approved Minutes' : 'Draft'}
              </span>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300">{mtg.minutesSummary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Agenda Items</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                  {mtg.agenda.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Attendees</p>
                <p className="text-slate-600 dark:text-slate-400">{mtg.attendees.join(' · ')}</p>
              </div>
            </div>

            {mtg.confidentialDraftNote && isManagement && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-2">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{mtg.confidentialDraftNote}</span>
              </div>
            )}

            {/* Resolution Action Items */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Tracked Resolution Action Items
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 rounded-xl dark:border-slate-800">
                {mtg.resolutions.map((res) => (
                  <div key={res.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{res.title}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Owner: {res.owner} · Due {formatDateShort(res.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`capitalize ${getStatusTextClass(res.status)}`}>
                        {res.status.replace('_', ' ')}
                      </span>
                      {isManagement && res.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => onUpdateResolution(mtg.id, res.id, 'completed')}
                          className="min-h-[32px] rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Create Poll / Vote Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Create Poll or Formal Vote
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Proposal or poll question"
              className="min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <textarea
              rows={2}
              required
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Neutral explanatory background and financial impact..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as VoteProposal['voteType'])}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="informal_poll">Informal Poll</option>
                <option value="formal_resolution">Formal Resolution</option>
              </select>
              <select
                value={newBallotMode}
                onChange={(e) => setNewBallotMode(e.target.value as VoteProposal['ballotMode'])}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="secret">Secret Ballot</option>
                <option value="attributable">Attributable Vote</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value as VoteProposal['eligibleScope'])}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="all_residents">All Residents</option>
                <option value="all_verified_owners">Owners Only</option>
              </select>
              <input
                type="number"
                value={newQuorum}
                onChange={(e) => setNewQuorum(e.target.value)}
                placeholder="Quorum %"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="date"
                value={newClosesAt}
                onChange={(e) => setNewClosesAt(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Ballot Options (one per line)
              </label>
              <textarea
                rows={3}
                value={newOptionsText}
                onChange={(e) => setNewOptionsText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900"
              >
                Publish Vote
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
