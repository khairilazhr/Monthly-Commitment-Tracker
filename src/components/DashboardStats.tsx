import { Commitment, Payment, isCommitmentActive } from '../types';
import { CreditCard, CheckCircle2, AlertCircle, Percent, Coins } from 'lucide-react';

interface DashboardStatsProps {
  commitments: Commitment[];
  payments: Record<string, Payment>;
  selectedMonth: string;
  userFilter: string;
}

export default function DashboardStats({ commitments, payments, selectedMonth, userFilter }: DashboardStatsProps) {
  // Filter commitments active in the selected month
  const activeCommitments = commitments.filter(c => isCommitmentActive(c, selectedMonth));
  
  // Calculations
  const totalAmount = activeCommitments.reduce((sum, c) => sum + c.amount, 0);
  
  const paidAmount = activeCommitments.reduce((sum, c) => {
    const payment = payments[c.id];
    return payment && payment.status === 'paid' ? sum + c.amount : sum;
  }, 0);
  
  const pendingAmount = totalAmount - paidAmount;
  const countPaid = activeCommitments.filter(c => payments[c.id]?.status === 'paid').length;
  const countTotal = activeCommitments.length;
  
  const percentPaid = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  // Overall database calculations (lifetime value / total term contract for all commitments)
  const overallTotalAmount = commitments.reduce((sum, c) => {
    if (c.durationMonths === 999) {
      return sum + c.amount; // Count monthly rate for ongoing subscriptions
    }
    return sum + (c.amount * c.durationMonths);
  }, 0);
  const overallCount = commitments.length;

  // Format currency
  const formatCurrency = (val: number) => {
    return 'RM ' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5 md:gap-4" id="dashboard-stats-grid">
      {/* Overall Total Card */}
      <div className="bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all" id="stat-overall-portfolio">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            Overall ({userFilter === 'Both' ? 'Both' : userFilter})
          </p>
          <div className="p-1.5 sm:p-2 bg-violet-50 text-violet-600 rounded-xl border border-violet-100/50 shrink-0" id="icon-overall">
            <Coins size={15} className="sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-800 font-sans tracking-tight leading-tight">{formatCurrency(overallTotalAmount)}</h4>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium truncate">{overallCount} total items</p>
        </div>
      </div>

      {/* Total Commitment Card */}
      <div className="bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all" id="stat-total-commitments">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            Committed ({userFilter === 'Both' ? 'Both' : userFilter})
          </p>
          <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50 shrink-0" id="icon-total">
            <CreditCard size={15} className="sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-800 font-sans tracking-tight leading-tight">{formatCurrency(totalAmount)}</h4>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium truncate">{countTotal} this month</p>
        </div>
      </div>

      {/* Paid Card */}
      <div className="bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all" id="stat-paid-commitments">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            Paid ({userFilter === 'Both' ? 'Both' : userFilter})
          </p>
          <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shrink-0" id="icon-paid">
            <CheckCircle2 size={15} className="sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-800 font-sans tracking-tight leading-tight">{formatCurrency(paidAmount)}</h4>
          <p className="text-[10px] sm:text-[11px] text-emerald-600 font-bold mt-0.5 truncate">{countPaid} of {countTotal} paid</p>
        </div>
      </div>

      {/* Pending Card */}
      <div className="bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all" id="stat-pending-commitments">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
            Pending ({userFilter === 'Both' ? 'Both' : userFilter})
          </p>
          <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-500 rounded-xl border border-amber-100/50 shrink-0" id="icon-pending">
            <AlertCircle size={15} className="sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-800 font-sans tracking-tight leading-tight">{formatCurrency(pendingAmount)}</h4>
          <p className="text-[10px] sm:text-[11px] text-amber-600 font-bold mt-0.5 truncate">{countTotal - countPaid} remaining</p>
        </div>
      </div>

      {/* Completion Progress Card - spans 2 cols on mobile */}
      <div className="col-span-2 lg:col-span-1 bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all" id="stat-completion-rate">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
            Settled Progress
          </p>
          <span className="text-[11px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-sans border border-indigo-100">{percentPaid}%</span>
        </div>
        
        <div className="mt-2">
          <div className="w-full bg-slate-100 h-2 sm:h-2.5 rounded-full overflow-hidden" id="progress-container">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentPaid}%` }}
              id="progress-bar-fill"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 font-bold truncate">
            {percentPaid === 100 ? '🎉 All commitments settled!' : `${countPaid}/${countTotal} paid (${percentPaid}%)`}
          </p>
        </div>
      </div>
    </div>
  );
}
