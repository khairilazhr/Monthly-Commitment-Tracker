import { Commitment, Payment, isCommitmentActive, formatMonthReadable } from '../types';
import { useState } from 'react';
import { Check, Clock, AlertCircle, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  commitments: Commitment[];
  payments: Record<string, Payment>;
  selectedMonth: string;
  onTogglePayment: (commitmentId: string) => void;
}

export default function CalendarView({ commitments, payments, selectedMonth, onTogglePayment }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [year, month] = selectedMonth.split('-').map(Number);
  
  // Billing cycle runs from 25th of selected month to 24th of the NEXT month.
  const startDate = new Date(year, month - 1, 25);
  
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  const endDate = new Date(nextYear, nextMonth - 1, 24);

  const cycleDates: Date[] = [];
  const tempDate = new Date(startDate);
  while (tempDate <= endDate) {
    cycleDates.push(new Date(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const firstDayOfWeek = startDate.getDay();
  const activeCommitments = commitments.filter(c => isCommitmentActive(c, selectedMonth));

  const getCommitmentsForDate = (date: Date) => {
    const dayOfMonth = date.getDate();
    return activeCommitments.filter(c => c.dueDay === dayOfMonth);
  };

  const getDateStatus = (date: Date) => {
    const coms = getCommitmentsForDate(date);
    if (coms.length === 0) return null;

    const allPaid = coms.every(c => payments[c.id]?.status === 'paid');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    const isPastOrToday = compareDate <= today;
    
    let isAnyOverdue = false;
    if (isPastOrToday) {
      isAnyOverdue = coms.some(c => !payments[c.id] || payments[c.id].status !== 'paid');
    }

    return {
      count: coms.length,
      allPaid,
      isAnyOverdue,
    };
  };

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (const d of cycleDates) {
    calendarCells.push(d);
  }

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const selectedDayCommitments = selectedDay ? getCommitmentsForDate(selectedDay) : [];

  const formatCurrency = (val: number) => {
    return 'RM ' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-4" id="calendar-view-section">
      
      {/* iOS Section Title */}
      <div className="px-1">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1C1C1E] tracking-tight">
          Schedule
        </h2>
        <p className="text-xs text-[#8E8E93] mt-0.5">
          Billing cycle {formatMonthReadable(selectedMonth)} (25th – 24th)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="calendar-grid-layout">
        
        {/* Apple Calendar Grid Inset Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 sm:p-5" id="calendar-wrapper">
          
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#8E8E93] mb-2">
            {daysOfWeek.map((d, i) => (
              <div key={i} className="py-1">{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5" id="calendar-days-grid">
            {calendarCells.map((date, idx) => {
              if (date === null) {
                return <div key={`empty-${idx}`} className="aspect-square rounded-xl" />;
              }

              const day = date.getDate();
              const status = getDateStatus(date);
              
              const today = new Date();
              const isTodayCell = today.getDate() === day && today.getMonth() === date.getMonth() && today.getFullYear() === date.getFullYear();
              
              const isSelected = selectedDay && 
                                 selectedDay.getDate() === date.getDate() && 
                                 selectedDay.getMonth() === date.getMonth() && 
                                 selectedDay.getFullYear() === date.getFullYear();

              let cellBg = 'hover:bg-[#F2F2F7] text-[#1C1C1E]';
              let indicatorColor = '';

              if (status) {
                if (status.allPaid) {
                  cellBg = 'bg-[#34C759]/10 text-[#1C1C1E]';
                  indicatorColor = 'bg-[#34C759]';
                } else if (status.isAnyOverdue) {
                  cellBg = 'bg-[#FF3B30]/10 text-[#FF3B30] font-bold';
                  indicatorColor = 'bg-[#FF3B30]';
                } else {
                  cellBg = 'bg-[#007AFF]/10 text-[#007AFF] font-semibold';
                  indicatorColor = 'bg-[#007AFF]';
                }
              }

              return (
                <button
                  key={`day-${day}-${date.getMonth()}`}
                  onClick={() => setSelectedDay(date)}
                  className={`aspect-square p-1 sm:p-1.5 rounded-xl flex flex-col items-center justify-between transition-all cursor-pointer relative ${cellBg} ${
                    isSelected ? 'ring-2 ring-[#007AFF] bg-[#007AFF]/15 shadow-2xs' : ''
                  } ${isTodayCell ? 'font-bold' : ''}`}
                >
                  <span className={`text-xs sm:text-sm leading-none mt-0.5 ${
                    isTodayCell ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#007AFF] text-white flex items-center justify-center -mt-0.5' : ''
                  }`}>
                    {day}
                  </span>

                  {status ? (
                    <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
                      {status.count > 1 && (
                        <span className="text-[9px] font-bold text-[#8E8E93] leading-none">
                          {status.count}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="w-1.5 h-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Status Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#8E8E93] font-medium pt-4 mt-4 border-t border-[#E5E5EA]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" /> Settled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#007AFF]" /> Scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF3B30]" /> Overdue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#007AFF]" /> Today
            </span>
          </div>
        </div>

        {/* Selected Day Inspector Inset Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex flex-col" id="calendar-day-inspector">
          <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-3 mb-3">
            <h3 className="text-sm font-bold text-[#1C1C1E] flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#007AFF]" />
              <span>
                {selectedDay 
                  ? selectedDay.toLocaleDateString('default', { month: 'short', day: 'numeric', weekday: 'short' })
                  : 'Select a Date'}
              </span>
            </h3>
            {selectedDay && (
              <span className="text-xs font-semibold text-[#8E8E93]">
                {selectedDayCommitments.length} item{selectedDayCommitments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {!selectedDay ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-[#8E8E93]">
              <CalendarIcon size={28} strokeWidth={1.5} className="mb-2 opacity-50" />
              <p className="text-xs font-medium">Tap any date on the calendar to inspect due bills.</p>
            </div>
          ) : selectedDayCommitments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-[#8E8E93]">
              <p className="text-xs font-medium">No payments due on this date.</p>
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {selectedDayCommitments.map(c => {
                const isPaid = payments[c.id]?.status === 'paid';
                return (
                  <div 
                    key={c.id}
                    className="p-3 bg-[#F2F2F7] rounded-xl flex items-center justify-between gap-3 border border-[#E5E5EA]"
                  >
                    <div className="min-w-0 flex-1">
                      <h5 className={`text-xs font-bold truncate ${isPaid ? 'text-[#8E8E93] line-through' : 'text-[#1C1C1E]'}`}>
                        {c.name}
                      </h5>
                      <p className="text-[10px] text-[#8E8E93] mt-0.5">
                        {c.category} • {c.user || 'Both'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-bold tabular-nums ${isPaid ? 'text-[#8E8E93] line-through' : 'text-[#1C1C1E]'}`}>
                        {formatCurrency(c.amount)}
                      </span>
                      <button
                        onClick={() => onTogglePayment(c.id)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                          isPaid 
                            ? 'bg-[#34C759] border-[#34C759] text-white' 
                            : 'border-[#C7C7CC] bg-white hover:border-[#007AFF]'
                        }`}
                      >
                        {isPaid && <Check size={12} strokeWidth={3} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
