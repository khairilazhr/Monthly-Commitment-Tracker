import { useState, useMemo } from 'react';
import { 
  Commitment, 
  Payment, 
  CATEGORY_COLORS, 
  monthToVal, 
  valToMonth, 
  formatMonthReadable, 
  getPaymentCalendarDate 
} from '../types';
import { 
  X, 
  Check, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Edit3, 
  CheckCircle2, 
  CalendarCheck, 
  CalendarDays,
  ChevronRight,
  TrendingDown,
  Info,
  DollarSign
} from 'lucide-react';

export interface InstallmentScheduleItem {
  index: number;
  total: number | 'ongoing';
  budgetMonth: string;
  budgetMonthReadable: string;
  calendarDate: Date;
  calendarDateStr: string;
  dueDateFormatted: string;
  dayOfWeek: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string;
  isOverdue: boolean;
  isDueToday: boolean;
  daysDiff: number;
  statusLabel: string;
}

interface CommitmentDetailModalProps {
  commitment: Commitment | null;
  isOpen: boolean;
  onClose: () => void;
  allPayments: Record<string, Payment>;
  onTogglePayment: (commitmentId: string, month: string) => void | Promise<void>;
  onEdit: (commitment: Commitment) => void;
}

export default function CommitmentDetailModal({
  commitment,
  isOpen,
  onClose,
  allPayments,
  onTogglePayment,
  onEdit
}: CommitmentDetailModalProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'paid' | 'left'>('all');
  const [updatingMonth, setUpdatingMonth] = useState<string | null>(null);

  // Generate schedule items for this commitment
  const scheduleItems = useMemo<InstallmentScheduleItem[]>(() => {
    if (!commitment) return [];

    const startCalVal = monthToVal(commitment.startMonth);
    const startBudgetVal = commitment.dueDay < 25 ? startCalVal - 1 : startCalVal;
    const isOngoing = commitment.durationMonths === 999;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentVal = currentYear * 12 + (currentMonth - 1);

    // If ongoing, show from start up to 12 months ahead from current
    const durationCount = isOngoing 
      ? Math.max(12, Math.max(0, currentVal - startBudgetVal) + 12)
      : commitment.durationMonths;

    const list: InstallmentScheduleItem[] = [];

    for (let i = 0; i < durationCount; i++) {
      const bMonth = valToMonth(startBudgetVal + i);
      const payCal = getPaymentCalendarDate(commitment.dueDay, bMonth);
      const [cYear, cMonth] = payCal.monthStr.split('-').map(Number);
      const calDate = new Date(cYear, cMonth - 1, payCal.day);
      calDate.setHours(0, 0, 0, 0);

      const diffTime = calDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const paymentDoc = allPayments[`${commitment.id}_${bMonth}`];
      const isPaid = paymentDoc?.status === 'paid';
      const isDueToday = diffDays === 0;
      const isOverdue = !isPaid && diffDays < 0;

      let statusLabel = '';
      if (isPaid) {
        statusLabel = 'Paid';
      } else if (isDueToday) {
        statusLabel = 'Due Today';
      } else if (isOverdue) {
        statusLabel = `Overdue (${Math.abs(diffDays)}d ago)`;
      } else {
        statusLabel = `Due in ${diffDays}d`;
      }

      list.push({
        index: i + 1,
        total: isOngoing ? 'ongoing' : commitment.durationMonths,
        budgetMonth: bMonth,
        budgetMonthReadable: formatMonthReadable(bMonth),
        calendarDate: calDate,
        calendarDateStr: `${cYear}-${String(cMonth).padStart(2, '0')}-${String(payCal.day).padStart(2, '0')}`,
        dueDateFormatted: calDate.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' }),
        dayOfWeek: calDate.toLocaleDateString('default', { weekday: 'short' }),
        amount: commitment.amount,
        isPaid,
        paidAt: paymentDoc?.paidAt,
        isOverdue,
        isDueToday,
        daysDiff: diffDays,
        statusLabel
      });
    }

    return list;
  }, [commitment, allPayments]);

  if (!isOpen || !commitment) return null;

  const isOngoing = commitment.durationMonths === 999;
  const badgeStyle = CATEGORY_COLORS[commitment.category] || CATEGORY_COLORS['Other'];

  const paidItems = scheduleItems.filter(item => item.isPaid);
  const leftItems = scheduleItems.filter(item => !item.isPaid);

  const totalPaidAmount = paidItems.reduce((sum, it) => sum + it.amount, 0);
  const totalLeftAmount = leftItems.reduce((sum, it) => sum + it.amount, 0);
  const totalLifetimeAmount = isOngoing 
    ? undefined 
    : commitment.amount * commitment.durationMonths;

  const progressPercent = isOngoing 
    ? (paidItems.length > 0 ? 100 : 0)
    : Math.min(100, Math.round((paidItems.length / commitment.durationMonths) * 100));

  // Find next upcoming due date (first unpaid item whose date is >= today, or the earliest overdue)
  const nextPayment = leftItems.find(it => it.daysDiff >= 0) || leftItems[0];

  // End date calculation for fixed-duration commitments
  const endMonthReadable = useMemo(() => {
    if (isOngoing) return 'Ongoing (No fixed end date)';
    const startCalVal = monthToVal(commitment.startMonth);
    const startBudgetVal = commitment.dueDay < 25 ? startCalVal - 1 : startCalVal;
    const endBudgetVal = startBudgetVal + commitment.durationMonths - 1;
    const endBudgetMonth = valToMonth(endBudgetVal);
    const endCal = getPaymentCalendarDate(commitment.dueDay, endBudgetMonth);
    return `${endCal.readable} (${formatMonthReadable(endBudgetMonth)})`;
  }, [commitment, isOngoing]);

  const filteredItems = useMemo(() => {
    if (filterMode === 'paid') return paidItems;
    if (filterMode === 'left') return leftItems;
    return scheduleItems;
  }, [filterMode, paidItems, leftItems, scheduleItems]);

  const formatCurrency = (val: number) => {
    return 'RM ' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleToggle = async (bMonth: string) => {
    setUpdatingMonth(bMonth);
    try {
      await onTogglePayment(commitment.id, bMonth);
    } finally {
      setUpdatingMonth(null);
    }
  };

  const getIconBackground = (name: string, category: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('grab')) return 'bg-[#00B14F] text-white';
    if (lower.includes('shopee') || lower.includes('spay')) return 'bg-[#EE4D2D] text-white';
    if (lower.includes('netflix')) return 'bg-[#E50914] text-white';
    if (lower.includes('spotify')) return 'bg-[#1DB954] text-white';
    if (lower.includes('apple')) return 'bg-[#000000] text-white';
    if (lower.includes('unifi') || lower.includes('maxis') || lower.includes('celcom') || lower.includes('digi')) return 'bg-[#007AFF] text-white';
    
    switch (category) {
      case 'Installment': return 'bg-[#FF9500] text-white';
      case 'Subscription': return 'bg-[#007AFF] text-white';
      case 'Loan': return 'bg-[#FF3B30] text-white';
      case 'Rent': return 'bg-[#AF52DE] text-white';
      case 'Utility': return 'bg-[#34C759] text-white';
      case 'Insurance': return 'bg-[#5856D6] text-white';
      default: return 'bg-[#8E8E93] text-white';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      id="commitment-detail-modal-backdrop"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-[28px] sm:rounded-[26px] max-w-2xl w-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-black/[0.06] overflow-hidden flex flex-col max-h-[92vh] animate-ios-sheet"
        id="commitment-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Drag Grabber */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 bg-[#D1D1D6] rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#E5E5EA] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-base shadow-2xs ${getIconBackground(commitment.name, commitment.category)}`}>
              {commitment.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#1C1C1E] tracking-tight">
                  {commitment.name}
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${badgeStyle}`}>
                  {commitment.category}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8E8E93] mt-0.5">
                <span className="font-semibold text-[#1C1C1E]">
                  {formatCurrency(commitment.amount)}/month
                </span>
                <span>•</span>
                <span className={`px-1.5 py-0.2 text-[10px] font-semibold rounded-md ${
                  commitment.user === 'Person A'
                    ? 'bg-[#FF2D55]/10 text-[#FF2D55]'
                    : commitment.user === 'Person B'
                    ? 'bg-[#007AFF]/10 text-[#007AFF]'
                    : 'bg-black/5 text-[#8E8E93]'
                }`}>
                  {commitment.user || 'Person A'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(commitment);
              }}
              className="p-2 text-[#007AFF] hover:bg-[#007AFF]/10 rounded-xl transition-colors cursor-pointer"
              title="Edit Commitment"
              id="detail-modal-edit-btn"
            >
              <Edit3 size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] rounded-xl transition-colors cursor-pointer"
              title="Close"
              id="detail-modal-close-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-[#F2F2F7]">
          
          {/* Overview & Progress Card */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-2xs space-y-3.5">
            
            {/* Top Grid: Key Dates & Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#F2F2F7]/70 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-[#8E8E93] block">Duration</span>
                <span className="text-xs font-bold text-[#1C1C1E] mt-0.5 block truncate">
                  {isOngoing ? 'Ongoing' : `${commitment.durationMonths} Months`}
                </span>
              </div>

              <div className="bg-[#F2F2F7]/70 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-[#8E8E93] block">Monthly Due Day</span>
                <span className="text-xs font-bold text-[#1C1C1E] mt-0.5 block truncate">
                  Day {commitment.dueDay} of month
                </span>
              </div>

              <div className="bg-[#F2F2F7]/70 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-[#8E8E93] block">First Month</span>
                <span className="text-xs font-bold text-[#1C1C1E] mt-0.5 block truncate">
                  {formatMonthReadable(commitment.startMonth)}
                </span>
              </div>

              <div className="bg-[#F2F2F7]/70 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-[#8E8E93] block">Final Month</span>
                <span className="text-xs font-bold text-[#1C1C1E] mt-0.5 block truncate">
                  {isOngoing ? 'Continuous' : endMonthReadable.split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Installment Progress & Totals */}
            <div className="pt-1 border-t border-[#E5E5EA]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#1C1C1E]">
                  <CalendarCheck size={15} className="text-[#34C759]" />
                  <span>
                    {isOngoing 
                      ? `${paidItems.length} Installments Paid` 
                      : `${paidItems.length} of ${commitment.durationMonths} Paid (${progressPercent}%)`
                    }
                  </span>
                </div>
                {!isOngoing && (
                  <span className="font-semibold text-[#8E8E93] text-[11px]">
                    {leftItems.length} Left to Pay
                  </span>
                )}
              </div>

              {/* iOS Progress Bar */}
              {!isOngoing && (
                <div className="w-full bg-[#E5E5EA] h-2.5 rounded-full overflow-hidden mb-3">
                  <div 
                    className="bg-[#34C759] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Amount Breakdown Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-emerald-50/70 border border-emerald-200/70 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 uppercase">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Already Paid</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-950 mt-0.5 tabular-nums">
                    {formatCurrency(totalPaidAmount)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    {paidItems.length} date{paidItems.length === 1 ? '' : 's'} settled
                  </span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/70 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 uppercase">
                    <Clock size={12} className="text-amber-600" />
                    <span>Date Left / Due</span>
                  </div>
                  <div className="text-sm font-bold text-amber-950 mt-0.5 tabular-nums">
                    {formatCurrency(totalLeftAmount)}
                  </div>
                  <span className="text-[10px] text-amber-700 font-medium">
                    {leftItems.length} date{leftItems.length === 1 ? '' : 's'} remaining
                  </span>
                </div>

                {!isOngoing && totalLifetimeAmount !== undefined && (
                  <div className="col-span-2 sm:col-span-1 bg-[#F2F2F7] border border-[#E5E5EA] p-2.5 rounded-xl">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#8E8E93] uppercase">
                      <DollarSign size={12} className="text-[#007AFF]" />
                      <span>Total Contract</span>
                    </div>
                    <div className="text-sm font-bold text-[#1C1C1E] mt-0.5 tabular-nums">
                      {formatCurrency(totalLifetimeAmount)}
                    </div>
                    <span className="text-[10px] text-[#8E8E93] font-medium">
                      Full tenure value
                    </span>
                  </div>
                )}
              </div>

              {/* Next Upcoming Due Date Banner */}
              {nextPayment && (
                <div className="mt-3 p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-[#007AFF] shrink-0" />
                    <div>
                      <span className="font-bold text-blue-950">Next Payment Due: </span>
                      <span className="font-semibold text-blue-800">
                        {nextPayment.dueDateFormatted} ({nextPayment.dayOfWeek})
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                    nextPayment.isOverdue 
                      ? 'bg-rose-100 text-rose-700' 
                      : nextPayment.isDueToday 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {nextPayment.statusLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Optional Notes */}
            {commitment.notes && (
              <div className="pt-2 border-t border-[#E5E5EA] flex items-start gap-2 text-xs text-[#3C3C43] bg-[#F2F2F7]/50 p-2.5 rounded-xl">
                <Info size={14} className="text-[#8E8E93] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#8E8E93] uppercase text-[10px] block">Notes / Reference</span>
                  <p className="mt-0.5 leading-relaxed">{commitment.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Detailed Installment Schedule (Which Date Already Paid vs Which Date Left) */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div>
                <h4 className="text-sm font-bold text-[#1C1C1E] tracking-tight flex items-center gap-1.5">
                  <Calendar size={15} className="text-[#007AFF]" />
                  <span>Installment Payment Schedule</span>
                </h4>
                <p className="text-[11px] text-[#8E8E93]">
                  Click the checkmark to mark any date as paid or pending
                </p>
              </div>

              {/* Segmented Filter Control */}
              <div className="flex items-center bg-[#E5E5EA]/80 p-0.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    filterMode === 'all'
                      ? 'bg-white text-[#1C1C1E] shadow-2xs'
                      : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                  }`}
                  id="filter-all-installments-btn"
                >
                  <span>All</span>
                  <span className="text-[10px] opacity-75 font-bold">({scheduleItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('paid')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    filterMode === 'paid'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-[#8E8E93] hover:text-emerald-700'
                  }`}
                  id="filter-paid-installments-btn"
                >
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>Paid</span>
                  <span className="text-[10px] opacity-75 font-bold">({paidItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('left')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    filterMode === 'left'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-[#8E8E93] hover:text-amber-700'
                  }`}
                  id="filter-left-installments-btn"
                >
                  <Clock size={12} className="text-amber-600" />
                  <span>Left</span>
                  <span className="text-[10px] opacity-75 font-bold">({leftItems.length})</span>
                </button>
              </div>
            </div>

            {/* Schedule List */}
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-2xs divide-y divide-[#E5E5EA] overflow-hidden max-h-[380px] overflow-y-auto" id="installments-schedule-list">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8E8E93]">
                  No installments match the "{filterMode}" filter.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isUpdating = updatingMonth === item.budgetMonth;

                  return (
                    <div 
                      key={item.budgetMonth}
                      className={`p-3 sm:px-4 sm:py-3 transition-colors flex items-center justify-between gap-3 ${
                        item.isPaid 
                          ? 'bg-emerald-50/20 hover:bg-emerald-50/40' 
                          : item.isOverdue 
                          ? 'bg-rose-50/20 hover:bg-rose-50/40' 
                          : 'hover:bg-[#F2F2F7]/50'
                      }`}
                      id={`installment-row-${item.budgetMonth}`}
                    >
                      {/* Left: Checkmark & Date Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        
                        {/* Interactive iOS Checkmark Button */}
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggle(item.budgetMonth)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
                            item.isPaid
                              ? 'bg-[#34C759] border-[#34C759] text-white shadow-2xs'
                              : item.isOverdue
                              ? 'border-rose-400 hover:border-rose-600 hover:bg-rose-50'
                              : 'border-[#C7C7CC] hover:border-[#007AFF] hover:bg-[#007AFF]/10'
                          } ${isUpdating ? 'opacity-50 animate-pulse' : ''}`}
                          title={item.isPaid ? "Mark as Pending (Left)" : "Mark as Paid"}
                          id={`toggle-installment-${item.budgetMonth}`}
                        >
                          {item.isPaid && <Check size={13} strokeWidth={3} />}
                        </button>

                        {/* Text info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Installment sequence tag */}
                            <span className="text-[10px] font-bold text-[#8E8E93] bg-[#F2F2F7] px-1.5 py-0.5 rounded-md">
                              {item.total === 'ongoing' ? `#${item.index}` : `#${item.index} of ${item.total}`}
                            </span>

                            {/* Exact Due Date */}
                            <span className={`text-xs sm:text-sm font-bold tracking-tight ${
                              item.isPaid ? 'text-[#8E8E93] line-through' : 'text-[#1C1C1E]'
                            }`}>
                              {item.dueDateFormatted}
                            </span>

                            <span className="text-[11px] text-[#8E8E93] font-medium">
                              ({item.dayOfWeek})
                            </span>

                            {/* Status Badges */}
                            {item.isPaid ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                                <Check size={10} strokeWidth={3} /> Paid
                              </span>
                            ) : item.isOverdue ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-md flex items-center gap-1">
                                <AlertCircle size={10} strokeWidth={2.5} /> Overdue ({Math.abs(item.daysDiff)}d)
                              </span>
                            ) : item.isDueToday ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-md">
                                Due Today
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#F2F2F7] text-[#8E8E93] rounded-md">
                                Scheduled ({item.daysDiff}d)
                              </span>
                            )}
                          </div>

                          {/* Subtitle with budget cycle & paid timestamp */}
                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#8E8E93] mt-0.5">
                            <span>Cycle: {item.budgetMonthReadable}</span>
                            {item.isPaid && item.paidAt && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">
                                  Paid on {new Date(item.paidAt).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount */}
                      <div className="text-right shrink-0">
                        <span className={`text-xs sm:text-sm font-bold tabular-nums ${
                          item.isPaid ? 'text-[#8E8E93] line-through' : 'text-[#1C1C1E]'
                        }`}>
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#E5E5EA] bg-white flex items-center justify-between gap-3">
          <div className="text-xs text-[#8E8E93]">
            <span>{paidItems.length} Paid</span> • <span className="text-amber-700 font-semibold">{leftItems.length} Left</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#007AFF] hover:bg-[#0066D6] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            id="detail-modal-done-btn"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
