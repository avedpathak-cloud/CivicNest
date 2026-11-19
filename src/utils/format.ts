export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPriorityTextClass(priority: string): string {
  switch (priority) {
    case 'emergency':
      return 'text-red-700 dark:text-red-400 font-semibold';
    case 'high':
      return 'text-amber-700 dark:text-amber-400 font-semibold';
    case 'normal':
      return 'text-teal-800 dark:text-teal-300 font-medium';
    default:
      return 'text-slate-600 dark:text-slate-400 font-medium';
  }
}

export function getStatusTextClass(status: string): string {
  switch (status) {
    case 'Resolved':
    case 'resolved':
    case 'Closed':
    case 'paid':
    case 'approved':
    case 'confirmed':
    case 'optimal':
    case 'completed':
    case 'threshold_met':
    case 'checked_in':
    case 'cleared':
    case 'inside':
    case 'collected':
    case 'on_duty':
      return 'text-emerald-700 dark:text-emerald-400 font-medium';
    case 'Waiting for Approval':
    case 'pending_approval':
    case 'pending':
    case 'attention':
    case 'unpaid':
    case 'Reopened':
    case 'disputed':
    case 'in_progress':
    case 'pre_approved':
    case 'at_gate':
    case 'acknowledged':
      return 'text-amber-700 dark:text-amber-400 font-medium';
    case 'maintenance_due':
    case 'cancelled':
    case 'denied':
    case 'flagged':
    case 'active':
      return 'text-red-700 dark:text-red-400 font-medium';
    default:
      return 'text-slate-700 dark:text-slate-300 font-medium';
  }
}
