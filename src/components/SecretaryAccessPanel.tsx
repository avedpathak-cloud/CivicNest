import React, { useState } from 'react';
import { Eye, KeyRound, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import type {
  FlatRecord,
  SocialPost,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types/society';

interface SecretaryAccessPanelProps {
  currentUser: UserAccount;
  availableUsers: UserAccount[];
  allFlats: FlatRecord[];
  socialPosts: SocialPost[];
  onCreateSubAccount: (payload: {
    name: string;
    email: string;
    phone: string;
    pin: string;
    role: Exclude<UserRole, 'secretary'>;
    flatId: string | null;
    permissions: UserPermissions;
  }) => Promise<void>;
  onUpdateSubAccount: (
    userId: string,
    payload: {
      isActive?: boolean;
      role?: Exclude<UserRole, 'secretary'>;
      newPin?: string;
      permissions?: Partial<UserPermissions>;
    }
  ) => Promise<void>;
  onDeleteSubAccount: (userId: string) => Promise<void>;
  onModeratePost: (
    postId: string,
    action: 'pin' | 'unpin' | 'hide' | 'unhide' | 'delete',
    note?: string
  ) => Promise<void>;
}

const SUB_ROLES: { value: Exclude<UserRole, 'secretary'>; label: string }[] = [
  { value: 'owner', label: 'Flat Owner / Member' },
  { value: 'tenant', label: 'Tenant / Occupant' },
  { value: 'family', label: 'Family Member' },
  { value: 'treasurer', label: 'Treasurer (Accounts)' },
  { value: 'facility_manager', label: 'Facility Manager' },
  { value: 'security', label: 'Main Gate Security' },
  { value: 'vendor', label: 'Vendor Partner' },
];

export const SecretaryAccessPanel: React.FC<SecretaryAccessPanelProps> = ({
  currentUser,
  availableUsers,
  allFlats,
  socialPosts,
  onCreateSubAccount,
  onUpdateSubAccount,
  onDeleteSubAccount,
  onModeratePost,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 98230 ');
  const [pin, setPin] = useState('2026');
  const [role, setRole] = useState<Exclude<UserRole, 'secretary'>>('owner');
  const [flatId, setFlatId] = useState<string>('flat_a402');
  const [perms, setPerms] = useState<UserPermissions>({
    canCreatePosts: true,
    canModeratePosts: false,
    canManageTickets: false,
    canManageBilling: false,
    canVote: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [pinResetUid, setPinResetUid] = useState<string | null>(null);
  const [pinResetVal, setPinResetVal] = useState('');

  const subAccounts = availableUsers.filter((u) => u.id !== currentUser.id);
  const moderationQueue = socialPosts.filter((p) => p.isHidden || p.reportCount > 0);

  const handleRoleChange = (nextRole: Exclude<UserRole, 'secretary'>) => {
    setRole(nextRole);
    setPerms({
      canCreatePosts: nextRole !== 'security' && nextRole !== 'vendor',
      canModeratePosts: false,
      canManageTickets: nextRole === 'facility_manager',
      canManageBilling: nextRole === 'treasurer',
      canVote: nextRole === 'owner' || nextRole === 'treasurer',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setSubmitting(true);
    try {
      await onCreateSubAccount({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        pin: pin.trim() || '2026',
        role,
        flatId: flatId || null,
        permissions: perms,
      });
      setName('');
      setEmail('');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to create sub-account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-6 space-y-6 dark:border-teal-900/60 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            <span>Root Secretary Access Control · MySQL Hierarchy</span>
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-white">
            Secretary Sub-Account &amp; Permission Console
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
            Only one root Secretary account exists ({currentUser.email}). Create residents, treasurers, facility staff, security guards, and vendors under your Secretary account and manage their permissions, status, tickets, and social posts.
          </p>
        </div>
        <div className="text-right font-mono-num text-xs text-slate-500 dark:text-slate-400">
          <p>{subAccounts.length} Managed Sub-Accounts</p>
          <p>{subAccounts.filter((u) => u.isActive).length} Active</p>
        </div>
      </div>

      {/* Create New Sub-Account Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 dark:border-slate-800 dark:bg-slate-950"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          <span>Create Account Under Secretary</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name (e.g. Priya Sharma)"
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (e.g. priya@aureliacrest.in)"
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Exclude<UserRole, 'secretary'>)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            {SUB_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={flatId}
            onChange={(e) => setFlatId(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">No Flat (Staff / Gate / Vendor)</option>
            {allFlats.map((f) => (
              <option key={f.id} value={f.id}>
                Flat {f.flatNumber} ({f.tower})
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Initial Login PIN"
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono-num dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
          {(
            [
              ['canCreatePosts', 'Create Social Posts'],
              ['canModeratePosts', 'Moderate Posts'],
              ['canManageTickets', 'Manage All Tickets'],
              ['canManageBilling', 'Manage Billing'],
              ['canVote', 'Eligible to Vote'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={perms[key]}
                onChange={(e) => setPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="h-4 w-4 accent-teal-800"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {errMsg && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errMsg}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{submitting ? 'Creating...' : 'Create Sub-Account'}</span>
          </button>
        </div>
      </form>

      {/* Existing Sub-Accounts Table / Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Sub-Accounts Managed Under {currentUser.name}
        </h3>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800 overflow-hidden">
          {subAccounts.map((acc) => (
            <div
              key={acc.id}
              className={`p-4 space-y-3 ${
                acc.isActive ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 opacity-80 dark:bg-slate-950'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {acc.name}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        acc.isActive
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {acc.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {acc.email} · {acc.roleTitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Role for ${acc.name}`}
                    value={acc.role}
                    onChange={(e) =>
                      onUpdateSubAccount(acc.id, {
                        role: e.target.value as Exclude<UserRole, 'secretary'>,
                      })
                    }
                    className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    {SUB_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onUpdateSubAccount(acc.id, { isActive: !acc.isActive })}
                    className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
                      acc.isActive
                        ? 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300'
                        : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {acc.isActive ? (
                      <>
                        <UserX className="h-3.5 w-3.5" /> Suspend
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5" /> Activate
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPinResetUid(pinResetUid === acc.id ? null : acc.id);
                      setPinResetVal('');
                    }}
                    className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> PIN
                  </button>

                  {confirmDeleteUid === acc.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteSubAccount(acc.id);
                          setConfirmDeleteUid(null);
                        }}
                        className="min-h-[34px] rounded-lg bg-red-600 px-2.5 text-xs font-medium text-white"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteUid(null)}
                        className="min-h-[34px] rounded-lg px-2 text-xs text-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteUid(acc.id)}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Permission Toggles */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                {(
                  [
                    ['canCreatePosts', 'Post in Feed'],
                    ['canModeratePosts', 'Moderate Feed'],
                    ['canManageTickets', 'Manage Tickets'],
                    ['canManageBilling', 'Manage Billing'],
                    ['canVote', 'Can Vote'],
                  ] as const
                ).map(([permKey, permLabel]) => (
                  <label key={permKey} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acc.permissions[permKey]}
                      onChange={(e) =>
                        onUpdateSubAccount(acc.id, {
                          permissions: { [permKey]: e.target.checked },
                        })
                      }
                      className="h-3.5 w-3.5 accent-teal-800"
                    />
                    <span>{permLabel}</span>
                  </label>
                ))}
              </div>

              {pinResetUid === acc.id && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={pinResetVal}
                    onChange={(e) => setPinResetVal(e.target.value)}
                    placeholder="Enter new PIN (e.g. 4455)"
                    className="min-h-[34px] w-48 rounded-lg border border-slate-200 px-3 text-xs font-mono-num dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!pinResetVal.trim()) return;
                      await onUpdateSubAccount(acc.id, { newPin: pinResetVal.trim() });
                      setPinResetUid(null);
                      setPinResetVal('');
                    }}
                    className="min-h-[34px] rounded-lg bg-teal-800 px-3 text-xs font-medium text-white"
                  >
                    Save PIN
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reported / Hidden Social Posts Queue */}
      {moderationQueue.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Social Feed Moderation Queue ({moderationQueue.length})
          </h3>
          <div className="divide-y divide-slate-100 rounded-xl border border-amber-200 dark:divide-slate-800 dark:border-amber-900/50">
            {moderationQueue.map((mp) => (
              <div key={mp.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {mp.authorName} · {mp.category}
                    {mp.reportCount > 0 ? ` · ${mp.reportCount} report(s)` : ''}
                    {mp.isHidden ? ' · Hidden' : ''}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-1">{mp.caption}</p>
                </div>
                <div className="flex items-center gap-2">
                  {mp.isHidden && (
                    <button
                      type="button"
                      onClick={() => onModeratePost(mp.id, 'unhide')}
                      className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Eye className="h-3.5 w-3.5" /> Restore
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onModeratePost(mp.id, 'delete')}
                    className="min-h-[32px] inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 font-medium text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
