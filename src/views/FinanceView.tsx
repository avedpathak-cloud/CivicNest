import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  FileCode2,
  FileSpreadsheet,
  Lock,
  Plus,
  Receipt,
  RotateCcw,
  X,
} from 'lucide-react';
import type { BootstrapPayload, Invoice } from '../types/society';
import { formatDateShort, formatINR, getStatusTextClass } from '../utils/format';
import { canManageBilling } from '../utils/permissions';

interface FinanceViewProps {
  data: BootstrapPayload;
  onPayInvoice: (invoiceId: string, paymentMethod: string, idempotencyKey: string) => Promise<void>;
  onDisputeInvoice: (invoiceId: string, reason: string) => Promise<void>;
  onGenerateBatch: (payload: {
    periodLabel: string;
    dueDate: string;
    ratePerSqFt: number;
    sinkingFund: number;
  }) => Promise<void>;
  onApproveExpense: (expenseId: string) => Promise<void>;
  onCreateExpense: (payload: {
    title: string;
    category: string;
    vendorName: string;
    vendorPan: string;
    budgetHead: string;
    amount: number;
    gstAmount: number;
    tdsSection: string;
    invoiceRef: string;
  }) => Promise<void>;
  onPostJournal: (payload: {
    narration?: string;
    debitAccountId?: string;
    creditAccountId?: string;
    amount?: number;
    reversesId?: string;
  }) => Promise<void>;
}

const TDS_OPTIONS = [
  { value: 'NONE', label: 'No TDS (0%)', pct: 0 },
  { value: 'SEC_194C_1', label: 'Sec 194C Individual (1%)', pct: 1 },
  { value: 'SEC_194C_2', label: 'Sec 194C Company/Firm (2%)', pct: 2 },
  { value: 'SEC_194J', label: 'Sec 194J Professional Fees (10%)', pct: 10 },
  { value: 'SEC_194I', label: 'Sec 194I Rent / Equipment (10%)', pct: 10 },
];

export const FinanceView: React.FC<FinanceViewProps> = ({
  data,
  onPayInvoice,
  onDisputeInvoice,
  onGenerateBatch,
  onApproveExpense,
  onCreateExpense,
  onPostJournal,
}) => {
  const user = data.currentUser;
  const isFinanceAdmin = canManageBilling(user);
  const [subTab, setSubTab] = useState<'invoices' | 'admin' | 'ledger'>('invoices');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Batch generator state
  const [periodLabel, setPeriodLabel] = useState('December 2026');
  const [dueDate, setDueDate] = useState('2026-12-20');
  const [ratePerSqFt, setRatePerSqFt] = useState('3.5');
  const [sinkingFund] = useState('750');

  // Vendor Expense + TDS state
  const [expTitle, setExpTitle] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expPan, setExpPan] = useState('');
  const [expCategory, setExpCategory] = useState('repairs');
  const [expBudget, setExpBudget] = useState('Statutory Safety & Lift AMC');
  const [expAmount, setExpAmount] = useState('');
  const [expGst, setExpGst] = useState('0');
  const [expTds, setExpTds] = useState('SEC_194C_2');
  const [expRef, setExpRef] = useState('');

  // Manual Journal Entry state
  const [jeNarration, setJeNarration] = useState('');
  const [jeDebitAcc, setJeDebitAcc] = useState('acc_1100');
  const [jeCreditAcc, setJeCreditAcc] = useState('acc_4300');
  const [jeAmount, setJeAmount] = useState('');

  const selectedTdsRate = TDS_OPTIONS.find((o) => o.value === expTds)?.pct || 0;
  const numericExpAmt = Math.max(0, Number(expAmount) || 0);
  const computedTds = Math.round((numericExpAmt * selectedTdsRate) / 100);
  const computedNet = Math.max(0, numericExpAmt - computedTds);

  const handleConfirmPay = async () => {
    if (!payingInvoice) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const idempotencyKey = `pay_${payingInvoice.id}_${payingInvoice.totalAmount}`;
      await onPayInvoice(payingInvoice.id, paymentMethod, idempotencyKey);
      setPayingInvoice(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (type: 'finance' | 'tally_xml', filename: string) => {
    const res = await fetch(`/api/reports/export?type=${type}`, {
      headers: { 'x-user-id': user.id },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stmt = data.accountingStatements;

  return (
    <div className="space-y-6">
      {/* Header & Admin Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Maintenance Billing, TDS &amp; General Ledger
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {isFinanceAdmin
              ? 'Double-entry CHS accounting, ITR-5 mutual/taxable split, TDS Sec 194C/J/I, and Tally XML export.'
              : `Private financial ledger scoped strictly to Flat ${user.flatNumber}. Raw card numbers are never stored.`}
          </p>
        </div>

        {isFinanceAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSubTab('invoices')}
                className={`min-h-[36px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                  subTab === 'invoices'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Invoices
              </button>
              <button
                type="button"
                onClick={() => setSubTab('admin')}
                className={`min-h-[36px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                  subTab === 'admin'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Expenses &amp; TDS
              </button>
              <button
                type="button"
                onClick={() => setSubTab('ledger')}
                className={`min-h-[36px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                  subTab === 'ledger'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Ledger &amp; Statements
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleExport('finance', 'civicnest-finance-report.csv')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('tally_xml', 'aurelia-crest-tally-vouchers.xml')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 dark:bg-teal-800 dark:hover:bg-teal-900"
            >
              <FileCode2 className="h-3.5 w-3.5" />
              <span>Tally XML</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {/* SUBTAB 1: INVOICES */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          {data.invoices.map((inv) => {
            const due = inv.totalAmount - inv.paidAmount;
            return (
              <div
                key={inv.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                        {inv.invoiceNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Flat {inv.flatNumber} ({inv.tower})</span>
                      <span aria-hidden="true">·</span>
                      <span>Due {formatDateShort(inv.dueDate)}</span>
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
                      {inv.periodLabel} Maintenance Invoice
                    </h3>
                  </div>

                  <div className="text-right">
                    <p className="font-mono-num text-xl font-bold text-slate-900 dark:text-white">
                      {formatINR(inv.totalAmount)}
                    </p>
                    <p className={`text-xs capitalize ${getStatusTextClass(inv.status)}`}>
                      {inv.status}
                      {inv.reconciled ? ' · Reconciled' : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {inv.lineItems.map((li, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">{li.label}</span>
                      <span className="font-mono-num text-slate-900 dark:text-slate-200">
                        {formatINR(li.amount)}
                      </span>
                    </div>
                  ))}
                  {inv.carryForward > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-700 dark:text-amber-400">Carry-forward arrears</span>
                      <span className="font-mono-num text-amber-700 dark:text-amber-400">
                        {formatINR(inv.carryForward)}
                      </span>
                    </div>
                  )}
                  {inv.lateFee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-700 dark:text-red-400">Approved late fee</span>
                      <span className="font-mono-num text-red-700 dark:text-red-400">
                        {formatINR(inv.lateFee)}
                      </span>
                    </div>
                  )}
                </div>

                {inv.disputeReason && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Dispute noted: {inv.disputeReason}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {inv.paymentRef ? (
                      <span className="font-mono-num">
                        Paid via {inv.paymentMethod} · Ref {inv.paymentRef}
                      </span>
                    ) : (
                      <span>Tenant &amp; owner financial policy governed by society bye-laws.</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {inv.status !== 'paid' && user.role !== 'tenant' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDisputingId(disputingId === inv.id ? null : inv.id)}
                          className="min-h-[40px] rounded-lg border border-slate-200 px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          Dispute Charge
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayingInvoice(inv)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-medium text-white hover:bg-teal-900"
                        >
                          <CreditCard className="h-4 w-4" />
                          <span>Pay {formatINR(due)}</span>
                        </button>
                      </>
                    )}
                    {inv.status !== 'paid' && user.role === 'tenant' && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Owner-only payment action per society policy
                      </span>
                    )}
                    {inv.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => setReceiptInvoice(inv)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        <Receipt className="h-4 w-4" />
                        <span>View Receipt</span>
                      </button>
                    )}
                  </div>
                </div>

                {disputingId === inv.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Specify charge head or meter discrepancy..."
                      className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!disputeReason.trim()) return;
                        await onDisputeInvoice(inv.id, disputeReason);
                        setDisputingId(null);
                        setDisputeReason('');
                      }}
                      className="min-h-[40px] rounded-lg bg-amber-700 px-4 text-xs font-medium text-white hover:bg-amber-800"
                    >
                      Submit Dispute
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SUBTAB 2: BATCH BILLING + VENDOR EXPENSES WITH GST & TDS */}
      {subTab === 'admin' && isFinanceAdmin && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <span>Generate Recurring Monthly Invoices (Auto-Posts GL Journal)</span>
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Computes area maintenance + sinking fund + parking charges across all flats and posts balanced Receivable vs Mutual Income vouchers.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Billing Period"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                step="0.25"
                value={ratePerSqFt}
                onChange={(e) => setRatePerSqFt(e.target.value)}
                placeholder="Rate / sq.ft (₹)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() =>
                  onGenerateBatch({
                    periodLabel,
                    dueDate,
                    ratePerSqFt: Number(ratePerSqFt) || 3.5,
                    sinkingFund: Number(sinkingFund) || 750,
                  })
                }
                className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900"
              >
                Generate Batch
              </button>
            </div>
          </section>

          {/* Record New Vendor Bill with TDS */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg(null);
              try {
                await onCreateExpense({
                  title: expTitle,
                  category: expCategory,
                  vendorName: expVendor,
                  vendorPan: expPan,
                  budgetHead: expBudget,
                  amount: numericExpAmt,
                  gstAmount: Number(expGst) || 0,
                  tdsSection: expTds,
                  invoiceRef: expRef,
                });
                setExpTitle('');
                setExpVendor('');
                setExpPan('');
                setExpAmount('');
                setExpRef('');
              } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : 'Unable to record expense.');
              }
            }}
            className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <span>Record Vendor Expense &amp; Indian TDS Deduction</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Computes Section 194C / 194J / 194I TDS withholding and posts balanced Expense, Vendor Payable &amp; TDS Payable entries.
                </p>
              </div>
              {numericExpAmt > 0 && (
                <div className="text-right font-mono-num text-xs">
                  <span className="text-slate-500">TDS: {formatINR(computedTds)} · </span>
                  <span className="font-semibold text-teal-800 dark:text-teal-300">
                    Net Payable: {formatINR(computedNet)}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="Bill description (e.g. DG Servicing)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                required
                value={expVendor}
                onChange={(e) => setExpVendor(e.target.value)}
                placeholder="Vendor Name"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={expPan}
                onChange={(e) => setExpPan(e.target.value)}
                placeholder="Vendor PAN (e.g. AABCS1234K)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm uppercase font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="repairs">Repairs &amp; AMC</option>
                <option value="utilities">Common Utilities</option>
                <option value="security">Security Agency</option>
                <option value="housekeeping">Housekeeping</option>
              </select>
              <input
                type="number"
                required
                min={1}
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="Gross Bill Amount (₹)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                min={0}
                value={expGst}
                onChange={(e) => setExpGst(e.target.value)}
                placeholder="Included GST (₹)"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={expTds}
                onChange={(e) => setExpTds(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {TDS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3 flex-1">
                <input
                  type="text"
                  value={expBudget}
                  onChange={(e) => setExpBudget(e.target.value)}
                  placeholder="Budget Head"
                  className="min-h-[40px] flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={expRef}
                  onChange={(e) => setExpRef(e.target.value)}
                  placeholder="Vendor Invoice Ref"
                  className="min-h-[40px] w-44 rounded-lg border border-slate-200 px-3 text-xs font-mono-num dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <button
                type="submit"
                className="min-h-[42px] rounded-lg bg-teal-800 px-5 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
              >
                Record Bill &amp; Post GL
              </button>
            </div>
          </form>

          {/* Expenses Table */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Society Expenses, TDS Deductions &amp; Vendor Approvals
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Expense &amp; Vendor</th>
                    <th className="px-5 py-3 font-medium text-right">Gross Bill</th>
                    <th className="px-5 py-3 font-medium text-right">TDS Deducted</th>
                    <th className="px-5 py-3 font-medium text-right">Net Payable</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 dark:text-white">{exp.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {exp.vendorName} {exp.vendorPan ? `(${exp.vendorPan})` : ''} · Ref {exp.invoiceRef}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-num text-slate-900 dark:text-white">
                        {formatINR(exp.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-num text-xs text-slate-600 dark:text-slate-300">
                        {exp.tdsAmount ? `${formatINR(exp.tdsAmount)} (${exp.tdsSection})` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatINR(exp.netPayable ?? exp.amount)}
                      </td>
                      <td className={`px-5 py-3.5 text-xs capitalize ${getStatusTextClass(exp.status)}`}>
                        {exp.status.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {exp.status === 'pending_approval' ? (
                          <button
                            type="button"
                            onClick={() => onApproveExpense(exp.id)}
                            className="min-h-[36px] rounded-lg bg-teal-800 px-3 text-xs font-medium text-white hover:bg-teal-900"
                          >
                            Approve Bill
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">{exp.approvedBy || 'Verified'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* SUBTAB 3: DOUBLE-ENTRY GENERAL LEDGER & STATUTORY STATEMENTS */}
      {subTab === 'ledger' && isFinanceAdmin && stmt && (
        <div className="space-y-6">
          {/* Income & Expenditure + Mutuality Split KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mutual Income (Exempt)</p>
              <p className="mt-2 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
                {formatINR(stmt.incomeStatement.mutualIncome)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Member dues &amp; parking</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Non-Mutual (ITR-5 Taxable)</p>
              <p className="mt-2 font-mono-num text-xl font-bold text-amber-700 dark:text-amber-400">
                {formatINR(stmt.incomeStatement.nonMutualTaxableIncome)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Commercial &amp; amenity fees</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Operating Expense</p>
              <p className="mt-2 font-mono-num text-xl font-bold text-slate-900 dark:text-white">
                {formatINR(stmt.incomeStatement.totalExpense)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Utilities, AMC &amp; safety</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Balance Sheet Assets</p>
              <p className="mt-2 font-mono-num text-xl font-bold text-teal-800 dark:text-teal-300">
                {formatINR(stmt.balanceSheet.totalAssets)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Bank + Dues Receivable</p>
            </div>
          </div>

          {/* Arrears Aging Buckets */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Arrears Aging Analysis (Unpaid Member Dues)
            </h3>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stmt.arrearsAging.map((b) => (
                <div
                  key={b.bucket}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {b.bucket} Days Overdue
                  </p>
                  <p className="mt-1 font-mono-num text-lg font-bold text-slate-900 dark:text-white">
                    {formatINR(b.amount)}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono-num">
                    {b.invoiceCount} invoice(s)
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trial Balance */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <span>Statutory Trial Balance (FY 2026–27)</span>
              </h3>
              <span className="text-xs text-slate-500">Double-entry balanced</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Code</th>
                    <th className="px-5 py-3 font-medium">Account Head</th>
                    <th className="px-5 py-3 font-medium">Type · Tax Scope</th>
                    <th className="px-5 py-3 font-medium text-right">Debit (₹)</th>
                    <th className="px-5 py-3 font-medium text-right">Credit (₹)</th>
                    <th className="px-5 py-3 font-medium text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stmt.trialBalance.map((row) => (
                    <tr key={row.accountId}>
                      <td className="px-5 py-3 font-mono-num text-xs text-slate-600 dark:text-slate-400">
                        {row.code}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                        {row.name}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {row.accountType} · {row.isMutual ? 'Mutual' : 'Non-Mutual'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {formatINR(row.debitTotal)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {formatINR(row.creditTotal)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatINR(row.netBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Post Manual Journal Entry */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg(null);
              try {
                await onPostJournal({
                  narration: jeNarration,
                  debitAccountId: jeDebitAcc,
                  creditAccountId: jeCreditAcc,
                  amount: Number(jeAmount) || 0,
                });
                setJeNarration('');
                setJeAmount('');
              } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : 'Unable to post journal entry.');
              }
            }}
            className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Post Balanced Journal Entry (Append-Only Audit Trail)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                required
                value={jeNarration}
                onChange={(e) => setJeNarration(e.target.value)}
                placeholder="Voucher narration"
                className="min-h-[42px] rounded-lg border border-slate-200 px-3 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={jeDebitAcc}
                onChange={(e) => setJeDebitAcc(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                {(data.glAccounts || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    Dr: {a.code} {a.name}
                  </option>
                ))}
              </select>
              <select
                value={jeCreditAcc}
                onChange={(e) => setJeCreditAcc(e.target.value)}
                className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                {(data.glAccounts || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    Cr: {a.code} {a.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min={1}
                  value={jeAmount}
                  onChange={(e) => setJeAmount(e.target.value)}
                  placeholder="Amount (₹)"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
                >
                  Post
                </button>
              </div>
            </div>
          </form>

          {/* Journal Entries Register with Reversal Support */}
          <section className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
            <div className="p-5">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Immutable Journal Register
              </h3>
            </div>
            {(data.journalEntries || []).map((je) => (
              <div key={je.id} className="p-5 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                      {je.entryDate}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{je.sourceType}</span>
                    <span aria-hidden="true">·</span>
                    <span>By {je.createdBy}</span>
                    {je.isReversal && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          Reversal Entry
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {je.narration}
                  </p>
                  <div className="mt-2 space-y-1 text-xs font-mono-num text-slate-600 dark:text-slate-400">
                    {je.lines.map((l, idx) => (
                      <div key={idx} className="flex items-center justify-between max-w-xl">
                        <span>
                          {l.accountCode} {l.accountName}
                        </span>
                        <span>
                          {l.debit > 0 ? `Dr ${formatINR(l.debit)}` : `Cr ${formatINR(l.credit)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {!je.isReversal && (
                  <button
                    type="button"
                    onClick={() => onPostJournal({ reversesId: je.id })}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Post Reversal</span>
                  </button>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {/* Idempotent Payment Gateway Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Pay Maintenance Invoice
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                  {payingInvoice.invoiceNumber} · Flat {payingInvoice.flatNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Payable Amount</span>
              <span className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
                {formatINR(payingInvoice.totalAmount - payingInvoice.paidAmount)}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Select Payment Method (Gateway Tokenised)
              </label>
              {['UPI (GPay / PhonePe / BHIM)', 'NetBanking', 'RuPay / Debit Card'].map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40"
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === m.split(' ')[0]}
                    onChange={() => setPaymentMethod(m.split(' ')[0])}
                    className="accent-teal-800"
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-200">{m}</span>
                </label>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Idempotent gateway checkout prevents duplicate receipts and posts GL voucher automatically.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmPay}
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
              >
                {busy ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {receiptInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-display text-base font-semibold">Official Payment Receipt</span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptInvoice(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Society</span>
                <span className="font-medium text-slate-900 dark:text-white">{data.society.societyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice / Flat</span>
                <span className="font-mono-num text-slate-900 dark:text-white">
                  {receiptInvoice.invoiceNumber} · {receiptInvoice.flatNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Ref</span>
                <span className="font-mono-num text-slate-900 dark:text-white">{receiptInvoice.paymentRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Method &amp; Status</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {receiptInvoice.paymentMethod} · Reconciled
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-white">Amount Received</span>
                <span className="font-mono-num text-lg font-bold text-slate-900 dark:text-white">
                  {formatINR(receiptInvoice.paidAmount)}
                </span>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setReceiptInvoice(null)}
                className="min-h-[42px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
