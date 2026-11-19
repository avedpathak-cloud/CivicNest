import React, { useState } from 'react';
import { Car, Download, Home, Phone, Shield, UserPlus, Users } from 'lucide-react';
import type { BootstrapPayload, LanguageCode, UserPermissions, UserRole } from '../types/society';
import { PWAInstallButton } from '../components/PWAComponents';
import { SecretaryAccessPanel } from '../components/SecretaryAccessPanel';
import { formatDateTime } from '../utils/format';
import { isSecretary, isSocietyManagement } from '../utils/permissions';

interface FlatDirectoryProfileViewProps {
  data: BootstrapPayload;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  largeText: boolean;
  onToggleLargeText: () => void;
  onUpdatePreferences: (payload: {
    preferredLang?: LanguageCode;
    consentMarketing?: boolean;
    consentDirectory?: boolean;
  }) => Promise<void>;
  onUpdateMyFlat: (kind: 'family' | 'vehicle' | 'move_request', payload: Record<string, string>) => Promise<void>;
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

export const FlatDirectoryProfileView: React.FC<FlatDirectoryProfileViewProps> = ({
  data,
  lang,
  onChangeLang,
  largeText,
  onToggleLargeText,
  onUpdatePreferences,
  onUpdateMyFlat,
  onCreateSubAccount,
  onUpdateSubAccount,
  onDeleteSubAccount,
  onModeratePost,
}) => {
  const user = data.currentUser;
  const isManagement = isSocietyManagement(user);

  const [famName, setFamName] = useState('');
  const [famRelation, setFamRelation] = useState('Spouse');
  const [famPhone, setFamPhone] = useState('');

  const [vehNo, setVehNo] = useState('');
  const [vehType, setVehType] = useState('4-wheeler');

  const [moveType, setMoveType] = useState('move_out');
  const [moveDate, setMoveDate] = useState('2026-12-10');

  const handleExportPersonalData = async () => {
    const res = await fetch('/api/profile/export', { headers: { 'x-user-id': user.id } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicnest-export-${user.flatNumber ?? user.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportReport = async (type: 'tickets' | 'campaigns') => {
    const res = await fetch(`/api/reports/export?type=${type}`, { headers: { 'x-user-id': user.id } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicnest-${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Secretary Hierarchical Access & Sub-Account Control Console */}
      {isSecretary(user) && (
        <SecretaryAccessPanel
          currentUser={user}
          availableUsers={data.availableUsers}
          allFlats={data.allFlats}
          socialPosts={data.socialPosts}
          onCreateSubAccount={onCreateSubAccount}
          onUpdateSubAccount={onUpdateSubAccount}
          onDeleteSubAccount={onDeleteSubAccount}
          onModeratePost={onModeratePost}
        />
      )}

      {/* My Flat & Family Section */}
      {data.myFlat && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified Digital Flat Identity · {data.myFlat.tower} ({data.myFlat.wing})
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Home className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                <span>Flat {data.myFlat.flatNumber}</span>
              </h2>
            </div>
            <div className="text-right text-xs text-slate-600 dark:text-slate-400 font-mono-num">
              <p>{data.myFlat.areaSqFt} sq.ft · Floor {data.myFlat.floor}</p>
              <p>Parking: {data.myFlat.parkingSlots.join(', ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Family Members */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span>Authorised Family Members</span>
              </h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {data.myFlat.familyMembers.map((f) => (
                  <div key={f.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{f.name}</p>
                      <p className="text-slate-500">{f.relation} · {f.phone}</p>
                    </div>
                    <span className="capitalize text-slate-500">{f.accessLevel} access</span>
                  </div>
                ))}
                {data.myFlat.familyMembers.length === 0 && (
                  <p className="p-3 text-xs text-slate-500">No additional family members added yet.</p>
                )}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!famName.trim()) return;
                  await onUpdateMyFlat('family', { name: famName, relation: famRelation, phone: famPhone });
                  setFamName('');
                  setFamPhone('');
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  required
                  value={famName}
                  onChange={(e) => setFamName(e.target.value)}
                  placeholder="Name"
                  className="min-h-[38px] flex-1 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={famRelation}
                  onChange={(e) => setFamRelation(e.target.value)}
                  placeholder="Relation"
                  className="min-h-[38px] w-24 rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={famPhone}
                  onChange={(e) => setFamPhone(e.target.value)}
                  placeholder="Phone"
                  className="min-h-[38px] w-32 rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="min-h-[38px] inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </button>
              </form>
            </div>

            {/* Registered Vehicles & Move-In/Out */}
            <div className="space-y-4">
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Car className="h-4 w-4 text-slate-400" />
                  <span>Registered Vehicles &amp; Stickers</span>
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                  {data.myFlat.vehicles.map((v) => (
                    <div key={v.id} className="p-3 flex items-center justify-between text-xs">
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                        {v.registrationNo} ({v.type})
                      </span>
                      <span className="font-mono-num text-slate-500">
                        {v.parkingSlot} · {v.stickerId}
                      </span>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!vehNo.trim()) return;
                    await onUpdateMyFlat('vehicle', { registrationNo: vehNo, type: vehType });
                    setVehNo('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    required
                    value={vehNo}
                    onChange={(e) => setVehNo(e.target.value)}
                    placeholder="MH-12-XX-0000"
                    className="min-h-[38px] flex-1 rounded-lg border border-slate-200 px-3 text-xs font-mono-num dark:border-slate-700 dark:bg-slate-950"
                  />
                  <select
                    value={vehType}
                    onChange={(e) => setVehType(e.target.value)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="4-wheeler">4-wheeler</option>
                    <option value="EV">EV</option>
                    <option value="2-wheeler">2-wheeler</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-[38px] rounded-lg bg-slate-900 px-3 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    Register
                  </button>
                </form>
              </div>

              {/* Move-In / Move-Out NOC */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onUpdateMyFlat('move_request', { type: moveType, requestedDate: moveDate });
                }}
                className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950 space-y-2"
              >
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Move-In / Move-Out NOC &amp; Service Lift Slot
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={moveType}
                    onChange={(e) => setMoveType(e.target.value)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="move_in">Move-In Request</option>
                    <option value="move_out">Move-Out NOC</option>
                  </select>
                  <input
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    className="min-h-[38px] rounded-lg bg-teal-800 px-3 text-xs font-medium text-white hover:bg-teal-900"
                  >
                    Request NOC
                  </button>
                </div>
                {data.myFlat.moveRequests.map((m) => (
                  <p key={m.id} className="text-[11px] text-slate-500">
                    {m.type.replace('_', '-').toUpperCase()} on {m.requestedDate} · Status: {m.nocStatus.replace('_', ' ')}
                  </p>
                ))}
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Privacy, Accessibility, Language & Android PWA Install */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Profile, Accessibility &amp; Privacy Controls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage language, large-text mode, vendor promotion opt-out, Android/Desktop PWA installation, and personal data export.
            </p>
          </div>
          <PWAInstallButton label="Install Android / Web App" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Interface Language (English / हिंदी / मराठी)
              </label>
              <select
                value={lang}
                onChange={(e) => {
                  const next = e.target.value as LanguageCode;
                  onChangeLang(next);
                  onUpdatePreferences({ preferredLang: next });
                }}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Large Text Accessibility Mode</p>
                <p className="text-xs text-slate-500">Increases base reading size for senior residents</p>
              </div>
              <input
                type="checkbox"
                checked={largeText}
                onChange={onToggleLargeText}
                className="h-5 w-5 accent-teal-800"
              />
            </label>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Receive Group Service &amp; Vendor Offers</p>
                <p className="text-xs text-slate-500">Official society circulars always remain active</p>
              </div>
              <input
                type="checkbox"
                checked={user.consentMarketing}
                onChange={(e) => onUpdatePreferences({ consentMarketing: e.target.checked })}
                className="h-5 w-5 accent-teal-800"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Opt-In to Society Resident Directory</p>
                <p className="text-xs text-slate-500">Control visibility to verified society neighbours</p>
              </div>
              <input
                type="checkbox"
                checked={user.consentDirectory}
                onChange={(e) => onUpdatePreferences({ consentDirectory: e.target.checked })}
                className="h-5 w-5 accent-teal-800"
              />
            </label>

            <button
              type="button"
              onClick={handleExportPersonalData}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
              <span>Download My Personal &amp; Flat Data (JSON)</span>
            </button>
          </div>
        </div>
      </section>

      {/* Committee & Facility Directory */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Society Contacts &amp; Opt-In Directory
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {data.availableUsers
            .filter((u) => u.consentDirectory)
            .map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-100 p-3.5 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                <p className="text-slate-500 dark:text-slate-400">{u.roleTitle}</p>
                <p className="mt-2 font-mono-num text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {u.phone}
                </p>
              </div>
            ))}
        </div>
      </section>

      {/* Committee Reports & Immutable Audit Log */}
      {isManagement && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <span>Society Reports &amp; Immutable Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Records high-risk changes, financial approvals, vote actions, and ticket transitions with actor &amp; timestamp.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExportReport('tickets')}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" /> Tickets CSV
              </button>
              <button
                type="button"
                onClick={() => handleExportReport('campaigns')}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" /> Marketplace CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Timestamp</th>
                  <th className="px-4 py-2.5 font-medium">Actor</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.auditLogs.slice(0, 12).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 font-mono-num text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-white whitespace-nowrap">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="px-4 py-2.5 font-mono-num text-teal-800 dark:text-teal-300 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
