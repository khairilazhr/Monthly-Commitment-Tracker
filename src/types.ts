export interface Commitment {
  id: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  durationMonths: number; // e.g. 12 for 1 year, 999 for infinite/ongoing subscriptions
  startMonth: string; // YYYY-MM
  dueDay: number; // 1 - 31
  notes?: string;
  user?: string; // indicates who the commitment belongs to (for split payment / multi-person mapping)
  createdAt: string;
}

export interface Payment {
  id: string; // Usually `${commitmentId}_${month}`
  commitmentId: string;
  userId: string;
  month: string; // YYYY-MM
  status: 'paid' | 'pending';
  paidAt?: string;
}

export type CommitmentCategory = 
  | 'Installment' 
  | 'Subscription' 
  | 'Loan' 
  | 'Rent' 
  | 'Utility' 
  | 'Insurance' 
  | 'Other';

export const CATEGORIES: CommitmentCategory[] = [
  'Installment',
  'Subscription',
  'Loan',
  'Rent',
  'Utility',
  'Insurance',
  'Other'
];

export const CATEGORY_COLORS: Record<string, string> = {
  Installment: 'bg-amber-100 text-amber-800 border-amber-200',
  Subscription: 'bg-blue-100 text-blue-800 border-blue-200',
  Loan: 'bg-red-100 text-red-800 border-red-200',
  Rent: 'bg-purple-100 text-purple-800 border-purple-200',
  Utility: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Insurance: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Other: 'bg-slate-100 text-slate-800 border-slate-200',
};

// Converts YYYY-MM to an absolute month index for easy calculations
export function monthToVal(monthStr: string): number {
  const [year, month] = monthStr.split('-').map(Number);
  return year * 12 + (month - 1);
}

// Converts absolute month index back to YYYY-MM
export function valToMonth(val: number): string {
  const year = Math.floor(val / 12);
  const month = (val % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Check if a commitment is active in a given month (YYYY-MM)
export function isCommitmentActive(commitment: Commitment, targetMonth: string): boolean {
  // Find start budget month based on start calendar month and dueDay (payday 25th)
  const startCalVal = monthToVal(commitment.startMonth);
  const startBudgetVal = commitment.dueDay < 25 ? startCalVal - 1 : startCalVal;
  
  const targetVal = monthToVal(targetMonth);
  const diff = targetVal - startBudgetVal;
  
  if (diff < 0) return false;
  if (commitment.durationMonths === 999) return true; // Ongoing
  return diff < commitment.durationMonths;
}

// Formats YYYY-MM to a readable string (e.g. "June 2026")
export function formatMonthReadable(monthStr: string): string {
  const [yearStr, monthIndexStr] = monthStr.split('-');
  const date = new Date(Number(yearStr), Number(monthIndexStr) - 1, 1);
  return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
}

export function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function getPaymentCalendarDate(dueDay: number, budgetMonthStr: string): { day: number; monthStr: string; readable: string } {
  const [year, month] = budgetMonthStr.split('-').map(Number);
  let calYear = year;
  let calMonth = month;

  if (dueDay < 25) {
    // If dueDay < 25, the calendar payment date is in the next calendar month
    calMonth = month + 1;
    if (calMonth > 12) {
      calMonth = 1;
      calYear = year + 1;
    }
  }

  const calMonthStr = `${calYear}-${String(calMonth).padStart(2, '0')}`;
  
  const tempDate = new Date(calYear, calMonth - 1, 1);
  const monthName = tempDate.toLocaleDateString('default', { month: 'long' });
  const suffix = getOrdinalSuffix(dueDay);
  
  return {
    day: dueDay,
    monthStr: calMonthStr,
    readable: `${dueDay}${suffix} ${monthName}`
  };
}
