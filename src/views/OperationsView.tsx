import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Car,
  Check,
  Clock,
  FileText,
  KeyRound,
  Package,
  Plus,
  QrCode,
  ShieldCheck,
  Star,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { QrCodeSvg } from '../components/QrCodeSvg';
import type { BootstrapPayload, HouseHelpRecord, Notice, VisitorPass } from '../types/society';
import { formatDateShort, formatDateTime, getStatusTextClass } from '../utils/format';
import { canManageTickets, isSecretary } from '../utils/permissions';

interface OperationsViewProps {
  data: BootstrapPayload;
  onAckNotice: (noticeId: string) => Promise<void>;
  onPublishNotice: (payload: {
    title: string;
    body: string;
    category: Notice['category'];
    targetAudience: string;
  }) => Promise<void>;
  onCreateVisitor: (payload: {
    visitorName: string;
    visitorType: VisitorPass['visitorType'];
    phone: string;
    vehicleNo?: string;
    expectedDate: string;
    flatNumber?: string;
    isWalkIn?: boolean;
  }) => Promise<void>;
  onRedeemVisitorPass: (passCode: string) => Promise<void>;
  onDecideVisitor: (visitorId: string, decision: 'approve' | 'deny') => Promise<void>;
  onUpdateVisitorStatus: (visitorId: string, status: VisitorPass['status']) => Promise<void>;
  onLogAssetService: (assetId: string) => Promise<void>;
  onRegisterHouseHelp: (payload: {
    name: string;
    phone: string;
    helpType: HouseHelpRecord['helpType'];
    idProofType: string;
    idProofNumber: string;
    assignedFlats: string[];
  }) => Promise<void>;
  onHouseHelpAttendance: (houseHelpId: string, direction: 'in' | 'out') => Promise<void>;
  onVerifyHouseHelp: (
    houseHelpId: string,
    backgroundCheck: 'pending' | 'cleared' | 'flagged',
    idVerified: boolean
  ) => Promise<void>;
  onAssignHouseHelpFlat: (houseHelpId: string, flatNumber: string) => Promise<void>;
  onReviewHouseHelp: (houseHelpId: string, rating: number, comment: string) => Promise<void>;
  onCreateParcel: (payload: {
    flatNumber: string;
    courierName: string;
    trackingNote: string;
    shelfLocation: string;
  }) => Promise<void>;
  onCollectParcel: (parcelId: string, pickupOtp: string) => Promise<void>;
  onGuardShiftAction: (payload: {
    action: 'clock_in' | 'clock_out';
    deviceId?: string;
    handoverNote?: string;
  }) => Promise<void>;
  onSendParkingAlert: (payload: { vehicleNo: string; location: string }) => Promise<void>;
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  data,
  onAckNotice,
  onPublishNotice,
  onCreateVisitor,
  onRedeemVisitorPass,
  onDecideVisitor,
  onUpdateVisitorStatus,
  onLogAssetService,
  onRegisterHouseHelp,
  onHouseHelpAttendance,
  onVerifyHouseHelp,
  onAssignHouseHelpFlat,
  onReviewHouseHelp,
  onCreateParcel,
  onCollectParcel,
  onGuardShiftAction,
  onSendParkingAlert,
}) => {
  const user = data.currentUser;
  const isSecurity = user.role === 'security';
  const isRootSecretary = isSecretary(user);
  const isManagement = isRootSecretary || canManageTickets(user);

  const [tab, setTab] = useState<'visitors' | 'househelp' | 'parcels' | 'notices' | 'documents' | 'assets'>(
    isSecurity ? 'visitors' : 'visitors'
  );
  const [actionError, setActionError] = useState<string | null>(null);

  // Visitor & Gate state
  const [visName, setVisName] = useState('');
  const [visType, setVisType] = useState<VisitorPass['visitorType']>('guest');
  const [visPhone, setVisPhone] = useState('');
  const [visVehicle, setVisVehicle] = useState('');
  const [visFlat, setVisFlat] = useState(user.flatNumber || 'A-402');
  const [walkInMode, setWalkInMode] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [qrVisitor, setQrVisitor] = useState<VisitorPass | null>(null);

  // Parking obstruction alert & guard shift
  const [alertVehicle, setAlertVehicle] = useState('');
  const [alertLocation, setAlertLocation] = useState('Tower A Fire Lane');
  const [shiftHandover, setShiftHandover] = useState('');

  // House Help state
  const [hhModalOpen, setHhModalOpen] = useState(false);
  const [hhName, setHhName] = useState('');
  const [hhPhone, setHhPhone] = useState('');
  const [hhType, setHhType] = useState<HouseHelpRecord['helpType']>('maid');
  const [hhProofType, setHhProofType] = useState('Aadhaar');
  const [hhProofNum, setHhProofNum] = useState('');
  const [hhFlats, setHhFlats] = useState(user.flatNumber || 'A-402');
  const [qrHelp, setQrHelp] = useState<HouseHelpRecord | null>(null);
  const [reviewingHelp, setReviewingHelp] = useState<HouseHelpRecord | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Parcels state
  const [prcFlat, setPrcFlat] = useState('A-402');
  const [prcCourier, setPrcCourier] = useState('Amazon Prime');
  const [prcNote, setPrcNote] = useState('');
  const [prcShelf, setPrcShelf] = useState('Shelf B-1');
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});

  // Notice modal
  const [noticeModal, setNoticeModal] = useState(false);
  const [ntcTitle, setNtcTitle] = useState('');
  const [ntcBody, setNtcBody] = useState('');
  const [ntcCategory, setNtcCategory] = useState<Notice['category']>('official_circular');
  const [ntcAudience, setNtcAudience] = useState('All Residents');

  const runAction = async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visName.trim()) return;
    await runAction(async () => {
      await onCreateVisitor({
        visitorName: visName,
        visitorType: visType,
        phone: visPhone || 'Verified',
        vehicleNo: visVehicle || undefined,
        expectedDate: new Date().toISOString().slice(0, 10),
        flatNumber: visFlat,
        isWalkIn: isSecurity && walkInMode,
      });
      setVisName('');
      setVisPhone('');
      setVisVehicle('');
    });
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAction(async () => {
      await onPublishNotice({
        title: ntcTitle,
        body: ntcBody,
        category: ntcCategory,
        targetAudience: ntcAudience,
      });
      setNtcTitle('');
      setNtcBody('');
      setNoticeModal(false);
    });
  };

  const handleCreateHouseHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAction(async () => {
      await onRegisterHouseHelp({
        name: hhName,
        phone: hhPhone,
        helpType: hhType,
        idProofType: hhProofType,
        idProofNumber: hhProofNum || 'Verified',
        assignedFlats: hhFlats
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      });
      setHhName('');
      setHhPhone('');
      setHhProofNum('');
      setHhModalOpen(false);
    });
  };

  const visitorParkingSlots = (data.parkingSlots || []).filter((s) => s.isVisitor);
  const activeGuardShift = (data.guardShifts || []).find((s) => s.status === 'on_duty');

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'visitors', label: 'Visitors & Parking', icon: KeyRound },
              { id: 'househelp', label: `House Help (${data.houseHelps?.length || 0})`, icon: UserCheck },
              { id: 'parcels', label: `Parcels (${(data.parcels || []).filter((p) => p.status === 'at_gate').length})`, icon: Package },
              { id: 'notices', label: 'Notices', icon: Bell },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'assets', label: 'Assets & PM', icon: Wrench },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tab === item.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {isManagement && tab === 'notices' && (
          <button
            type="button"
            onClick={() => setNoticeModal(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Publish Notice</span>
          </button>
        )}

        {(isManagement || isSecurity) && tab === 'househelp' && (
          <button
            type="button"
            onClick={() => setHhModalOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Register Domestic Staff</span>
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {actionError}
        </div>
      )}

      {/* TAB 1: Visitors, QR Gate Redeem, Visitor Parking Pool & Guard Shift */}
      {tab === 'visitors' && (
        <div className="space-y-6">
          {/* Guard / Secretary Quick Pass Redeem & Shift Bar */}
          {(isSecurity || isManagement) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      Gate QR / 6-Digit Pass Verification
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Redeem resident pre-approved passes and auto-allocate visitor parking when vehicle is listed.
                    </p>
                  </div>
                  <QrCode className="h-5 w-5 text-teal-700 dark:text-teal-400 shrink-0" />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value)}
                    placeholder="Enter 6-digit Pass Code (e.g. 482910)"
                    className="min-h-[42px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      runAction(async () => {
                        if (!redeemCode.trim()) return;
                        await onRedeemVisitorPass(redeemCode.trim());
                        setRedeemCode('');
                      })
                    }
                    className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
                  >
                    Verify &amp; Check In
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      Guard Shift &amp; Device Lock
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeGuardShift
                        ? `${activeGuardShift.guardName} · ${activeGuardShift.deviceId} · GPS verified`
                        : 'No guard clocked in at Main Gate'}
                    </p>
                  </div>
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={shiftHandover}
                    onChange={(e) => setShiftHandover(e.target.value)}
                    placeholder={activeGuardShift ? 'Shift handover note...' : 'Gate tablet ID (GATE-TAB-01)'}
                    className="min-h-[42px] flex-1 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  {activeGuardShift ? (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(async () => {
                          await onGuardShiftAction({
                            action: 'clock_out',
                            handoverNote: shiftHandover || 'Normal gate handover completed.',
                          });
                          setShiftHandover('');
                        })
                      }
                      className="min-h-[42px] rounded-lg border border-slate-200 px-3.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 whitespace-nowrap"
                    >
                      Clock Out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(async () => {
                          await onGuardShiftAction({
                            action: 'clock_in',
                            deviceId: shiftHandover || 'GATE-TAB-01',
                          });
                          setShiftHandover('');
                        })
                      }
                      className="min-h-[42px] rounded-lg bg-teal-800 px-3.5 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
                    >
                      Clock In
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Pre-Approved Pass or Walk-in */}
          <form
            onSubmit={handleVisitorSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {isSecurity ? 'Log Gate Visitor Entry' : 'Pre-Approve Visitor or Delivery (with QR Pass)'}
              </h3>
              {isSecurity && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={walkInMode}
                    onChange={(e) => setWalkInMode(e.target.checked)}
                    className="accent-teal-800"
                  />
                  <span>Request live Resident Approval (Walk-In)</span>
                </label>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-6 gap-3">
              <input
                type="text"
                required
                value={visName}
                onChange={(e) => setVisName(e.target.value)}
                placeholder="Visitor / Courier Name"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={visType}
                onChange={(e) => setVisType(e.target.value as VisitorPass['visitorType'])}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="guest">Guest</option>
                <option value="delivery">Delivery</option>
                <option value="cab">Cab / Taxi</option>
                <option value="domestic_staff">Domestic Staff</option>
              </select>
              <input
                type="text"
                value={visVehicle}
                onChange={(e) => setVisVehicle(e.target.value)}
                placeholder="Vehicle No (Optional)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm uppercase dark:border-slate-700 dark:bg-slate-950"
              />
              {(isSecurity || isManagement) ? (
                <input
                  type="text"
                  value={visFlat}
                  onChange={(e) => setVisFlat(e.target.value)}
                  placeholder="Flat (e.g. A-402)"
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              ) : (
                <input
                  type="tel"
                  value={visPhone}
                  onChange={(e) => setVisPhone(e.target.value)}
                  placeholder="Visitor Phone"
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              )}
              <button
                type="submit"
                className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
              >
                {isSecurity ? (walkInMode ? 'Ping Resident' : 'Check In Now') : 'Generate QR Pass'}
              </button>
            </div>
          </form>

          {/* Visitor Passes List */}
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
            {data.visitors.map((v) => (
              <div key={v.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-semibold text-teal-800 dark:text-teal-300">
                      Pass #{v.passCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Flat {v.flatNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{v.visitorType.replace('_', ' ')}</span>
                    {v.parkingSlotNumber && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num font-medium text-slate-800 dark:text-slate-200">
                          Parking {v.parkingSlotNumber}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {v.visitorName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {v.vehicleNo ? `Vehicle ${v.vehicleNo} · ` : ''}Logged by {v.loggedBy}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs capitalize mr-1 ${getStatusTextClass(v.status)}`}>
                    {v.status.replace('_', ' ')}
                  </span>

                  <button
                    type="button"
                    onClick={() => setQrVisitor(v)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>QR Pass</span>
                  </button>

                  {v.status === 'pending_approval' && (v.flatId === user.flatId || isRootSecretary) && (
                    <>
                      <button
                        type="button"
                        onClick={() => runAction(() => onDecideVisitor(v.id, 'approve'))}
                        className="min-h-[38px] rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white hover:bg-emerald-800"
                      >
                        Approve Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(() => onDecideVisitor(v.id, 'deny'))}
                        className="min-h-[38px] rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
                      >
                        Deny
                      </button>
                    </>
                  )}

                  {(isSecurity || isManagement) && (v.status === 'pre_approved' || v.status === 'approved') && (
                    <button
                      type="button"
                      onClick={() => runAction(() => onUpdateVisitorStatus(v.id, 'checked_in'))}
                      className="min-h-[38px] rounded-lg bg-teal-800 px-3 text-xs font-medium text-white"
                    >
                      Check In
                    </button>
                  )}

                  {(isSecurity || isManagement) && v.status === 'checked_in' && (
                    <button
                      type="button"
                      onClick={() => runAction(() => onUpdateVisitorStatus(v.id, 'checked_out'))}
                      className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Check Out
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Visitor Parking Pool & Wrong-Parking Obstruction Dispatch */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Car className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <span>Live Visitor Parking Bays (Auto-Assigned on Vehicle Entry)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {visitorParkingSlots.filter((s) => !s.occupiedByVisitorId).length} of {visitorParkingSlots.length} visitor bays currently free
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {visitorParkingSlots.map((slot) => {
                const occupied = Boolean(slot.occupiedByVisitorId);
                return (
                  <div
                    key={slot.id}
                    className={`rounded-xl border p-3.5 ${
                      occupied
                        ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                        {slot.slotNumber}
                      </span>
                      <span className="uppercase text-[10px] text-slate-500">{slot.slotType}</span>
                    </div>
                    <p className={`mt-1.5 text-xs ${occupied ? 'text-amber-800 dark:text-amber-300 font-medium' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {occupied ? slot.visitorVehicleNo || 'Occupied' : 'Available'}
                    </p>
                  </div>
                );
              })}
            </div>

            {(isSecurity || isManagement) && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <input
                  type="text"
                  value={alertVehicle}
                  onChange={(e) => setAlertVehicle(e.target.value)}
                  placeholder="Wrongly parked vehicle no. (e.g. MH-12-XX-1024)"
                  className="min-h-[40px] flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 text-xs uppercase dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={alertLocation}
                  onChange={(e) => setAlertLocation(e.target.value)}
                  placeholder="Obstruction location"
                  className="min-h-[40px] w-48 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() =>
                    runAction(async () => {
                      if (!alertVehicle.trim()) return;
                      await onSendParkingAlert({ vehicleNo: alertVehicle.trim(), location: alertLocation });
                      setAlertVehicle('');
                    })
                  }
                  className="min-h-[40px] rounded-lg bg-amber-700 px-4 text-xs font-medium text-white hover:bg-amber-800 whitespace-nowrap"
                >
                  Broadcast Parking Alert
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Domestic / House Help Registry, Verification, Ratings & Attendance */}
      {tab === 'househelp' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data.houseHelps || []).map((hh) => {
              const myFlatAssigned = user.flatNumber ? hh.assignedFlats.includes(user.flatNumber) : false;
              return (
                <article
                  key={hh.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono-num font-semibold text-teal-800 dark:text-teal-300">
                            {hh.badgeCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{hh.helpType.replace('_', ' ')}</span>
                          <span aria-hidden="true">·</span>
                          <span className={getStatusTextClass(hh.backgroundCheck)}>
                            BG: {hh.backgroundCheck}
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
                          {hh.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                          {hh.phone} · {hh.idProofType} ({hh.idProofNumber})
                        </p>
                      </div>

                      <span className={`text-xs capitalize ${getStatusTextClass(hh.currentStatus)}`}>
                        {hh.currentStatus === 'inside' ? 'Inside Campus' : 'Outside'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Assigned Flats:{' '}
                        <strong className="font-mono-num">
                          {hh.assignedFlats.length > 0 ? hh.assignedFlats.join(', ') : 'None'}
                        </strong>
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono-num">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        {hh.avgRating ? `${hh.avgRating} / 5 (${hh.reviews.length})` : 'Unrated'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {(isSecurity || isRootSecretary) && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction(() =>
                            onHouseHelpAttendance(hh.id, hh.currentStatus === 'inside' ? 'out' : 'in')
                          )
                        }
                        className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium text-white ${
                          hh.currentStatus === 'inside'
                            ? 'bg-slate-800 hover:bg-slate-900'
                            : 'bg-teal-800 hover:bg-teal-900'
                        }`}
                      >
                        {hh.currentStatus === 'inside' ? 'Gate Check-Out' : 'Gate Check-In'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setQrHelp(hh)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>QR Badge</span>
                    </button>

                    {user.flatNumber && (
                      <button
                        type="button"
                        onClick={() => runAction(() => onAssignHouseHelpFlat(hh.id, user.flatNumber!))}
                        className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        {myFlatAssigned ? `Unlink ${user.flatNumber}` : `Assign to ${user.flatNumber}`}
                      </button>
                    )}

                    {!isSecurity && (
                      <button
                        type="button"
                        onClick={() => setReviewingHelp(hh)}
                        className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        Rate (Anonymous)
                      </button>
                    )}

                    {isRootSecretary && hh.backgroundCheck !== 'cleared' && (
                      <button
                        type="button"
                        onClick={() => runAction(() => onVerifyHouseHelp(hh.id, 'cleared', true))}
                        className="min-h-[38px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Clear Verification</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Gate Attendance Log */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Recent Domestic Staff Gate Attendance Log
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff Member</th>
                    <th className="px-5 py-3 font-medium">Assigned Flats</th>
                    <th className="px-5 py-3 font-medium">Guard</th>
                    <th className="px-5 py-3 font-medium">Check In</th>
                    <th className="px-5 py-3 font-medium">Check Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data.houseHelpLogs || []).map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                        {log.houseHelpName}
                      </td>
                      <td className="px-5 py-3 font-mono-num text-xs text-slate-600 dark:text-slate-400">
                        {log.flatNumber}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {log.guardName}
                      </td>
                      <td className="px-5 py-3 font-mono-num text-xs text-slate-700 dark:text-slate-300">
                        {formatDateTime(log.checkInAt)}
                      </td>
                      <td className="px-5 py-3 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        {log.checkOutAt ? formatDateTime(log.checkOutAt) : 'Inside campus'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Parcel & Courier Custody Locker with 4-digit Pickup OTP */}
      {tab === 'parcels' && (
        <div className="space-y-6">
          {(isSecurity || isRootSecretary) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await onCreateParcel({
                    flatNumber: prcFlat,
                    courierName: prcCourier,
                    trackingNote: prcNote || 'Standard parcel',
                    shelfLocation: prcShelf,
                  });
                  setPrcNote('');
                });
              }}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Log Gate Parcel Custody (Generates 4-Digit Resident Pickup OTP)
              </h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
                <input
                  type="text"
                  required
                  value={prcFlat}
                  onChange={(e) => setPrcFlat(e.target.value)}
                  placeholder="Flat (e.g. A-402)"
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  required
                  value={prcCourier}
                  onChange={(e) => setPrcCourier(e.target.value)}
                  placeholder="Courier (Amazon / BlueDart)"
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={prcNote}
                  onChange={(e) => setPrcNote(e.target.value)}
                  placeholder="Package note / box count"
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={prcShelf}
                  onChange={(e) => setPrcShelf(e.target.value)}
                  placeholder="Rack / Shelf (e.g. B-2)"
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900"
                >
                  Log Package
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
            {(data.parcels || []).map((prc) => (
              <div key={prc.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-semibold text-slate-800 dark:text-slate-200">
                      Flat {prc.flatNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{prc.shelfLocation}</span>
                    <span aria-hidden="true">·</span>
                    <span>Logged {formatDateTime(prc.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {prc.courierName} — {prc.trackingNote}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Custody by {prc.loggedBy}
                    {prc.pickupOtp !== '****' && (
                      <span className="ml-2 font-mono-num font-semibold text-teal-800 dark:text-teal-300">
                        · Pickup OTP: {prc.pickupOtp}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs capitalize mr-2 ${getStatusTextClass(prc.status)}`}>
                    {prc.status.replace('_', ' ')}
                  </span>
                  {prc.status === 'at_gate' && (isSecurity || isRootSecretary || prc.flatId === user.flatId) && (
                    <div className="flex items-center gap-2">
                      {isSecurity && (
                        <input
                          type="text"
                          value={otpInputs[prc.id] || ''}
                          onChange={(e) => setOtpInputs((prev) => ({ ...prev, [prc.id]: e.target.value }))}
                          placeholder="4-digit OTP"
                          className="min-h-[38px] w-28 rounded-lg border border-slate-200 px-2.5 text-xs font-mono-num dark:border-slate-700 dark:bg-slate-950"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          runAction(() =>
                            onCollectParcel(
                              prc.id,
                              otpInputs[prc.id] || (prc.pickupOtp !== '****' ? prc.pickupOtp : '')
                            )
                          )
                        }
                        className="min-h-[38px] rounded-lg bg-teal-800 px-3 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
                      >
                        Mark Collected
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Notices */}
      {tab === 'notices' && (
        <div className="space-y-4">
          {data.notices.map((n) => {
            const acked = user.flatId ? n.acknowledgedBy.includes(user.flatId) : false;
            return (
              <article
                key={n.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span
                    className={
                      n.category === 'emergency_alert'
                        ? 'font-semibold text-red-700 dark:text-red-400'
                        : n.category === 'vendor_promo'
                        ? 'font-medium text-teal-800 dark:text-teal-300'
                        : 'font-semibold text-slate-800 dark:text-slate-200'
                    }
                  >
                    {n.category === 'emergency_alert'
                      ? 'Emergency Broadcast'
                      : n.category === 'vendor_promo'
                      ? 'Vendor Promotion (Opt-In)'
                      : 'Official Society Circular'}
                  </span>
                  <span>
                    Audience: {n.targetAudience} · {formatDateTime(n.publishedAt)}
                  </span>
                </div>

                <h3 className="mt-2 font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {n.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {n.body}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Issued by {n.authorName} ({n.authorRole}) · {n.acknowledgedBy.length} flats acknowledged
                  </span>
                  {user.flatId && (
                    <button
                      type="button"
                      disabled={acked}
                      onClick={() => runAction(() => onAckNotice(n.id))}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 font-medium ${
                        acked
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{acked ? 'Acknowledged' : 'Mark as Read'}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 5: Documents */}
      {tab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{doc.category} · {doc.version}</span>
                  <span className="capitalize">{doc.accessLevel.replace('_', ' ')}</span>
                </div>
                <h4 className="mt-1.5 font-display text-base font-semibold text-slate-900 dark:text-white">
                  {doc.title}
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{doc.summary}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span>Updated {formatDateShort(doc.updatedAt)}</span>
                {doc.expiryDate && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Renewal due {formatDateShort(doc.expiryDate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 6: Assets & Preventive Maintenance */}
      {tab === 'assets' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Society Asset</th>
                  <th className="px-5 py-3 font-medium">Vendor / AMC</th>
                  <th className="px-5 py-3 font-medium">Next Service</th>
                  <th className="px-5 py-3 font-medium">Condition</th>
                  {isManagement && <th className="px-5 py-3 font-medium text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.assets.map((ast) => (
                  <tr key={ast.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-white">{ast.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ast.category} · {ast.location}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                      {ast.vendorName}
                      <span className="block text-slate-400">AMC exp {formatDateShort(ast.amcExpiryDate)}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono-num text-xs text-slate-700 dark:text-slate-300">
                      {formatDateShort(ast.nextServiceDate)}
                    </td>
                    <td className={`px-5 py-3.5 text-xs capitalize ${getStatusTextClass(ast.condition)}`}>
                      {ast.condition.replace('_', ' ')}
                    </td>
                    {isManagement && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => runAction(() => onLogAssetService(ast.id))}
                          className="min-h-[36px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          Log Inspection
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visitor QR Pass Modal */}
      {qrVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Gate Entry QR Pass
              </h3>
              <button
                type="button"
                onClick={() => setQrVisitor(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <QrCodeSvg
                value={`CIVICNEST:PASS:${qrVisitor.passCode}:${qrVisitor.flatNumber}`}
                size={168}
                label={`OTP #${qrVisitor.passCode}`}
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
              {qrVisitor.visitorName}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Flat {qrVisitor.flatNumber} · {qrVisitor.visitorType.replace('_', ' ')}
              {qrVisitor.vehicleNo ? ` · ${qrVisitor.vehicleNo}` : ''}
            </p>
            <button
              type="button"
              onClick={() => setQrVisitor(null)}
              className="mt-5 min-h-[42px] w-full rounded-lg bg-teal-800 text-xs font-medium text-white"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

      {/* House Help QR Badge Modal */}
      {qrHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Verified Staff Gate Badge
              </h3>
              <button
                type="button"
                onClick={() => setQrHelp(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <QrCodeSvg
                value={`CIVICNEST:HELP:${qrHelp.badgeCode}:${qrHelp.name}`}
                size={168}
                label={qrHelp.badgeCode}
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">{qrHelp.name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 capitalize">
              {qrHelp.helpType.replace('_', ' ')} · Flats: {qrHelp.assignedFlats.join(', ') || 'General'}
            </p>
            <button
              type="button"
              onClick={() => setQrHelp(null)}
              className="mt-5 min-h-[42px] w-full rounded-lg bg-teal-800 text-xs font-medium text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* House Help Registration Modal */}
      {hhModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateHouseHelp}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Register Domestic / House Help Staff
              </h3>
              <button
                type="button"
                onClick={() => setHhModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={hhName}
                onChange={(e) => setHhName(e.target.value)}
                placeholder="Full Name"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="tel"
                required
                value={hhPhone}
                onChange={(e) => setHhPhone(e.target.value)}
                placeholder="Mobile Number"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={hhType}
                onChange={(e) => setHhType(e.target.value as HouseHelpRecord['helpType'])}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="maid">Maid / Housekeeping</option>
                <option value="cook">Cook</option>
                <option value="driver">Driver</option>
                <option value="nanny">Nanny / Caregiver</option>
                <option value="car_cleaner">Car Cleaner</option>
                <option value="gardener">Gardener</option>
              </select>
              <input
                type="text"
                value={hhFlats}
                onChange={(e) => setHhFlats(e.target.value)}
                placeholder="Assigned Flats (e.g. A-402, B-704)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={hhProofType}
                onChange={(e) => setHhProofType(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="Aadhaar">Aadhaar Card</option>
                <option value="Police Verification">Police Verification</option>
                <option value="PAN / DL">PAN / Driving License</option>
              </select>
              <input
                type="text"
                value={hhProofNum}
                onChange={(e) => setHhProofNum(e.target.value)}
                placeholder="Masked ID Ref (e.g. XXXX-4821)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setHhModalOpen(false)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900"
              >
                Register Staff &amp; Issue Badge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* House Help Anonymous Rating Modal */}
      {reviewingHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await onReviewHouseHelp(reviewingHelp.id, reviewRating, reviewComment);
                setReviewComment('');
                setReviewingHelp(null);
              });
            }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Anonymous Resident Rating
                </h3>
                <p className="text-xs text-slate-500">{reviewingHelp.name} ({reviewingHelp.badgeCode})</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingHelp(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className={`min-h-[40px] min-w-[40px] rounded-lg border flex items-center justify-center ${
                    reviewRating >= star
                      ? 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/40'
                      : 'border-slate-200 text-slate-400 dark:border-slate-700'
                  }`}
                >
                  <Star className={`h-4 w-4 ${reviewRating >= star ? 'fill-amber-500' : ''}`} />
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Optional anonymous feedback (flat number is not displayed)..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewingHelp(null)}
                className="min-h-[42px] rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900"
              >
                Submit Rating
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Publish Notice Modal */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handlePublishNotice}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Publish Circular or Alert
              </h3>
              <button
                type="button"
                onClick={() => setNoticeModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={ntcTitle}
              onChange={(e) => setNtcTitle(e.target.value)}
              placeholder="Notice headline"
              className="min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={ntcCategory}
                onChange={(e) => setNtcCategory(e.target.value as Notice['category'])}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="official_circular">Official Circular</option>
                <option value="wing_notice">Wing / Tower Notice</option>
                <option value="emergency_alert">Emergency Alert</option>
                <option value="vendor_promo">Vendor Offer (Opt-In)</option>
              </select>
              <input
                type="text"
                value={ntcAudience}
                onChange={(e) => setNtcAudience(e.target.value)}
                placeholder="Audience (e.g. Tower A)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <textarea
              rows={3}
              required
              value={ntcBody}
              onChange={(e) => setNtcBody(e.target.value)}
              placeholder="Circular message..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setNoticeModal(false)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900"
              >
                Publish Notice
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
