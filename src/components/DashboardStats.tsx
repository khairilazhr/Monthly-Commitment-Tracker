import { Commitment, Payment, isCommitmentActive } from '../types';
import { CreditCard, CheckCircle2, AlertCircle, Coins, ArrowUpRight } from 'lucide-react';

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

  // Overall database calculations
  const overallTotalAmount = commitments.reduce((sum, c) => {
    if (c.durationMonths === 999) {
      return sum + c.amount;
    }
    return sum + (c.amount * c.durationMonths);
  }, 0);
  const overallCount = commitments.length;

  const formatCurrency = (val: number) => {
    return 'RM ' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5" id="dashboard-stats-grid">
      
      {/* Total Database Obligation Widget */}
      <div 
        className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
        id="stat-overall-portfolio"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider truncate">
            Lifetime Value
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center shrink-0">
            <Coins size={15} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl font-bold text-[#1C1C1E] tracking-tight tabular-nums">
            {formatCurrency(overallTotalAmount)}
          </h4>
          <p className="text-[11px] text-[#8E8E93] mt-0.5 font-medium truncate">
            {overallCount} total commitments
          </p>
        </div>
      </div>

      {/* Monthly Total Commitment Widget */}
      <div 
        className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
        id="stat-total-commitments"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider truncate">
            Due This Month
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
            <CreditCard size={15} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl font-bold text-[#1C1C1E] tracking-tight tabular-nums">
            {formatCurrency(totalAmount)}
          </h4>
          <p className="text-[11px] text-[#8E8E93] mt-0.5 font-medium truncate">
            {countTotal} active {userFilter === 'Both' ? 'bills' : `for ${userFilter}`}
          </p>
        </div>
      </div>

      {/* Paid Widget */}
      <div 
        className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
        id="stat-paid-commitments"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider truncate">
            Paid
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center shrink-0">
            <CheckCircle2 size={15} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl font-bold text-[#1C1C1E] tracking-tight tabular-nums">
            {formatCurrency(paidAmount)}
          </h4>
          <p className="text-[11px] text-[#34C759] font-semibold mt-0.5 truncate">
            {countPaid} of {countTotal} settled
          </p>
        </div>
      </div>

      {/* Pending Widget */}
      <div 
        className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
        id="stat-pending-commitments"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider truncate">
            Remaining
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center shrink-0">
            <AlertCircle size={15} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <h4 className="text-base sm:text-xl font-bold text-[#1C1C1E] tracking-tight tabular-nums">
            {formatCurrency(pendingAmount)}
          </h4>
          <p className="text-[11px] text-[#FF9500] font-semibold mt-0.5 truncate">
            {countTotal - countPaid} uncollected
          </p>
        </div>
      </div>

      {/* Settlement Rate Progress Widget */}
      <div 
        className="col-span-2 lg:col-span-1 bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
        id="stat-completion-rate"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
            Settled Rate
          </span>
          <span className="text-xs font-bold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full">
            {percentPaid}%
          </span>
        </div>
        
        <div className="mt-1">
          <div className="w-full bg-[#E5E5EA] h-2 rounded-full overflow-hidden" id="progress-container">
            <div 
              className="bg-gradient-to-r from-[#007AFF] to-[#34C759] h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentPaid}%` }}
              id="progress-bar-fill"
            />
          </div>
          <p className="text-[11px] text-[#8E8E93] mt-1.5 font-medium truncate">
            {percentPaid === 100 ? 'All bills settled' : `${countPaid}/${countTotal} completed`}
          </p>
        </div>
      </div>
    </div>
  );
}
