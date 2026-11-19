import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  PauseCircle,
  PlayCircle,
  Plus,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { BootstrapPayload, ServiceCampaign } from '../types/society';
import { formatDateShort, formatINR } from '../utils/format';
import { canManageTickets, isSecretary } from '../utils/permissions';

interface ServicesMarketplaceViewProps {
  data: BootstrapPayload;
  onOptIn: (
    campaignId: string,
    payload: { preferredDate: string; preferredSlot: string; cadence: string }
  ) => Promise<void>;
  onManageCampaign: (campaignId: string, payload: Record<string, unknown>) => Promise<void>;
  onCreateCampaign: (payload: {
    name: string;
    categoryGroup: ServiceCampaign['categoryGroup'];
    vendorName: string;
    basePrice: number;
    scope: string;
    minConfirmedFlats: number;
    optInDeadline: string;
  }) => Promise<void>;
}

export const ServicesMarketplaceView: React.FC<ServicesMarketplaceViewProps> = ({
  data,
  onOptIn,
  onManageCampaign,
  onCreateCampaign,
}) => {
  const user = data.currentUser;
  const isManagement = isSecretary(user) || canManageTickets(user);
  const isVendor = user.role === 'vendor';

  const [optInCampaign, setOptInCampaign] = useState<ServiceCampaign | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('10:00 AM – 12:00 PM');
  const [cadence, setCadence] = useState<'one_time' | 'monthly' | 'quarterly' | 'annual'>('annual');
  const [consentChecked, setConsentChecked] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ServiceCampaign['categoryGroup']>('Cleaning and pest control');
  const [newVendor, setNewVendor] = useState('');
  const [newBasePrice, setNewBasePrice] = useState('1500');
  const [newScope, setNewScope] = useState('');
  const [newMinFlats, setNewMinFlats] = useState('25');
  const [newDeadline, setNewDeadline] = useState('2026-12-02');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenOptIn = (cmp: ServiceCampaign) => {
    setErrorMsg(null);
    setOptInCampaign(cmp);
    setPreferredDate(cmp.availableDates[0] ?? '2026-12-01');
    setConsentChecked(true);
  };

  const handleConfirmOptIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optInCampaign || !consentChecked) return;
    setErrorMsg(null);
    try {
      await onOptIn(optInCampaign.id, { preferredDate, preferredSlot, cadence });
      setOptInCampaign(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to opt in.');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateCampaign({
        name: newName,
        categoryGroup: newCategory,
        vendorName: newVendor,
        basePrice: Number(newBasePrice) || 1200,
        scope: newScope,
        minConfirmedFlats: Number(newMinFlats) || 25,
        optInDeadline: newDeadline,
      });
      setNewName('');
      setNewScope('');
      setCreateOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create campaign.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Group-Buying Home Services Marketplace
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Aggregates voluntary resident demand across the society so vetted vendors unlock tiered bulk discounts. Final discounts lock only when confirmed flats reach each tier threshold by the campaign deadline.
          </p>
        </div>

        {isManagement && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Launch Service Campaign</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Campaign Cards */}
      <div className="space-y-6">
        {data.campaigns.map((cmp) => {
          const mySub = cmp.subscriptions.find(
            (s) => s.flatId === user.flatId && s.status !== 'cancelled'
          );
          const nextTier = cmp.tiers.find((t) => t.minFlats > cmp.confirmedCount);
          const maxTierTarget = nextTier ? nextTier.minFlats : cmp.tiers[cmp.tiers.length - 1]?.minFlats || 200;
          const progressPct = Math.min(100, Math.round((cmp.confirmedCount / maxTierTarget) * 100));

          return (
            <article
              key={cmp.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Info */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-teal-800 dark:text-teal-300">
                        {cmp.categoryGroup}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Vendor: {cmp.vendorName}</span>
                      <span aria-hidden="true">·</span>
                      <span>Deadline: {formatDateShort(cmp.optInDeadline)}</span>
                    </div>
                    <h3 className="mt-1.5 font-display text-lg font-semibold text-slate-900 dark:text-white">
                      {cmp.name}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{cmp.scope}</p>
                  </div>

                  {/* Live Demand Progress Bar */}
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                        <span className="font-mono-num">{cmp.confirmedCount}</span> confirmed flats
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                        {nextTier
                          ? `${nextTier.minFlats - cmp.confirmedCount} more for ${nextTier.discountPct}% off (${formatINR(nextTier.unitPrice)})`
                          : `Top ${cmp.activeDiscountPct}% tier reached`}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-teal-700 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
                      {cmp.tiers.map((tier) => {
                        const unlocked = cmp.confirmedCount >= tier.minFlats;
                        return (
                          <div
                            key={tier.minFlats}
                            className={`rounded-lg border p-1.5 text-[11px] ${
                              unlocked
                                ? 'border-teal-600/40 bg-teal-50 text-teal-900 dark:border-teal-500/40 dark:bg-teal-950/50 dark:text-teal-200'
                                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                            }`}
                          >
                            <div className="font-mono-num font-semibold">{tier.minFlats}+</div>
                            <div className="font-mono-num">{tier.discountPct}% off</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inclusions & Policy Transparency */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Included</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {cmp.inclusions.map((inc, i) => (
                          <li key={i}>{inc}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Exclusions &amp; Terms</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {cmp.exclusions.map((exc, i) => (
                          <li key={i}>{exc}</li>
                        ))}
                        <li>{cmp.taxMaterialPolicy}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Right Pricing & Action Panel */}
                <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {cmp.status === 'locked' ? 'Locked Final Group Price' : 'Current Tier Price'}
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono-num text-3xl font-bold text-slate-900 dark:text-white">
                            {formatINR(cmp.currentUnitPrice)}
                          </span>
                          {cmp.activeDiscountPct > 0 && (
                            <span className="font-mono-num text-sm line-through text-slate-400">
                              {formatINR(cmp.basePrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {cmp.activeDiscountPct > 0
                          ? `${cmp.activeDiscountPct}% group savings`
                          : `Min ${cmp.minConfirmedFlats} flats`}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {cmp.cancellationPolicy} {cmp.fallbackPolicy}
                    </p>
                  </div>

                  {/* Resident Opt-In / Subscription Status */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {!isVendor && user.flatId && (
                      <>
                        {!mySub ? (
                          <button
                            type="button"
                            disabled={cmp.status === 'locked' || cmp.status === 'completed'}
                            onClick={() => handleOpenOptIn(cmp)}
                            className="w-full min-h-[44px] rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50 transition-colors"
                          >
                            {cmp.status === 'locked'
                              ? 'Price Locked · Opt-In Closed'
                              : `Opt In for Flat ${user.flatNumber}`}
                          </button>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                Opted In ({mySub.status}) · {mySub.preferredDate}
                              </span>
                              <span className="text-slate-500">{mySub.preferredSlot}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {mySub.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onManageCampaign(cmp.id, {
                                      action: 'pause_subscription',
                                      subscriptionId: mySub.id,
                                    })
                                  }
                                  className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                >
                                  <PauseCircle className="h-3.5 w-3.5" /> Pause
                                </button>
                              )}
                              {mySub.status === 'paused' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onManageCampaign(cmp.id, {
                                      action: 'resume_subscription',
                                      subscriptionId: mySub.id,
                                    })
                                  }
                                  className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-teal-600 px-3 text-xs font-medium text-teal-800 dark:text-teal-300"
                                >
                                  <PlayCircle className="h-3.5 w-3.5" /> Resume
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  onManageCampaign(cmp.id, {
                                    action: 'cancel_subscription',
                                    subscriptionId: mySub.id,
                                  })
                                }
                                className="min-h-[38px] rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                              >
                                Cancel Opt-In
                              </button>
                              {!mySub.rating && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onManageCampaign(cmp.id, {
                                      action: 'rate_service',
                                      subscriptionId: mySub.id,
                                      rating: 5,
                                    })
                                  }
                                  className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 dark:border-amber-800 dark:text-amber-300"
                                >
                                  <Star className="h-3.5 w-3.5" /> Mark Done (5★)
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Committee Price Lock & Vendor Work Order Summary */}
                    {isManagement && cmp.status !== 'locked' && (
                      <button
                        type="button"
                        onClick={() => onManageCampaign(cmp.id, { action: 'lock_price' })}
                        className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Lock Final Price ({formatINR(cmp.currentUnitPrice)}) &amp; Issue Work Order</span>
                      </button>
                    )}

                    {(isManagement || isVendor) && cmp.subscriptions.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Assigned Appointments ({cmp.subscriptions.filter((s) => s.status !== 'cancelled').length})
                        </p>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {cmp.subscriptions
                            .filter((s) => s.status !== 'cancelled')
                            .map((s) => (
                              <div key={s.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                                <span>
                                  {s.flatNumber} ({s.residentName})
                                </span>
                                <span className="font-mono-num">
                                  {s.preferredDate} · {s.preferredSlot}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Resident Opt-In Confirmation Modal */}
      {optInCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmOptIn}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Opt In to Group Service
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{optInCampaign.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOptInCampaign(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preferred Service Date
              </label>
              <select
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {optInCampaign.availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preferred Slot
              </label>
              <select
                value={preferredSlot}
                onChange={(e) => setPreferredSlot(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="09:00 AM – 11:00 AM">09:00 AM – 11:00 AM</option>
                <option value="10:00 AM – 12:00 PM">10:00 AM – 12:00 PM</option>
                <option value="02:00 PM – 04:00 PM">02:00 PM – 04:00 PM</option>
                <option value="04:30 PM – 06:30 PM">04:30 PM – 06:30 PM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Frequency (No silent auto-renewals)
              </label>
              <select
                value={cadence}
                onChange={(e) =>
                  setCadence(e.target.value as 'one_time' | 'monthly' | 'quarterly' | 'annual')
                }
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="one_time">One-Time Campaign Service</option>
                <option value="monthly">Monthly Opt-In (Pause anytime)</option>
                <option value="quarterly">Quarterly Reminder</option>
                <option value="annual">Annual Reminder</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 accent-teal-800"
              />
              <span>
                I acknowledge the base price ({formatINR(optInCampaign.basePrice)}), current tier price (
                {formatINR(optInCampaign.currentUnitPrice)}), cancellation terms, and that final discount depends on confirmed flats by {formatDateShort(optInCampaign.optInDeadline)}.
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOptInCampaign(null)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!consentChecked}
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
              >
                Confirm Opt-In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Launch Campaign Modal (Committee / Admin) */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Publish Group Service Campaign
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
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Campaign Name (e.g., Chimney & Exhaust Deep Degreasing)"
              className="min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as ServiceCampaign['categoryGroup'])
                }
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="Climate and appliances">Climate and appliances</option>
                <option value="Vehicle care">Vehicle care</option>
                <option value="Home maintenance">Home maintenance</option>
                <option value="Cleaning and pest control">Cleaning and pest control</option>
                <option value="Water and safety">Water and safety</option>
                <option value="Convenience">Convenience</option>
              </select>
              <input
                type="text"
                required
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                placeholder="Vetted Vendor Name"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                required
                value={newBasePrice}
                onChange={(e) => setNewBasePrice(e.target.value)}
                placeholder="Base Price ₹"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                required
                value={newMinFlats}
                onChange={(e) => setNewMinFlats(e.target.value)}
                placeholder="Min Flats"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="date"
                required
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <textarea
              rows={2}
              required
              value={newScope}
              onChange={(e) => setNewScope(e.target.value)}
              placeholder="Service scope & checklist..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
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
                Publish Campaign
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
