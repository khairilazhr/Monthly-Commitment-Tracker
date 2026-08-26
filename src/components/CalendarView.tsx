import { Commitment, Payment, isCommitmentActive, formatMonthReadable, getPaymentCalendarDate } from '../types';
import { useState } from 'react';
import { Check, Clock, AlertCircle, Calendar } from 'lucide-react';

interface CalendarViewProps {
  commitments: Commitment[];
  payments: Record<string, Payment>;
  selectedMonth: string;
  onTogglePayment: (commitmentId: string) => void;
}

export default function CalendarView({ commitments, payments, selectedMonth, onTogglePayment }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Parse selected month
  const [year, month] = selectedMonth.split('-').map(Number);
  
  // Billing cycle runs from 25th of selected month to 24th of the NEXT month.
  // E.g., for June 2026 (YYYY-MM = 2026-06): June 25th to July 24th.
  const startDate = new Date(year, month - 1, 25);
  
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  const endDate = new Date(nextYear, nextMonth - 1, 24);

  // Get all dates in this billing cycle
  const cycleDates: Date[] = [];
  const tempDate = new Date(startDate);
  while (tempDate <= endDate) {
    cycleDates.push(new Date(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Day of the week for the first day of the cycle (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = startDate.getDay();

  // Active commitments for this month
  const activeCommitments = commitments.filter(c => isCommitmentActive(c, selectedMonth));

  // Find commitments due on a specific date
  const getCommitmentsForDate = (date: Date) => {
    const dayOfMonth = date.getDate();
    return activeCommitments.filter(c => c.dueDay === dayOfMonth);
  };

  // Get status details for a specific date
  const getDateStatus = (date: Date) => {
    const coms = getCommitmentsForDate(date);
    if (coms.length === 0) return null;

    const allPaid = coms.every(c => payments[c.id]?.status === 'paid');
    
    // Check if overdue
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

  // Generate calendar grid array
  const calendarCells = [];
  
  // Add blank empty cells for offset
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  
  // Add days of the cycle
  for (const d of cycleDates) {
    calendarCells.push(d);
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedDayCommitments = selectedDay ? getCommitmentsForDate(selectedDay) : [];

  const formatCurrency = (val: number) => {
    return 'RM ' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6" id="calendar-view-section">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/30">
          <Calendar size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 font-sans tracking-tight">Payment Due Schedule</h3>
          <p className="text-xs text-slate-400 mt-0.5">Interactive billing cycle calendar showing due dates for {formatMonthReadable(selectedMonth)} (25th to 24th)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="calendar-grid-layout">
        {/* Calendar Grid */}
        <div className="lg:col-span-7 space-y-4" id="calendar-wrapper">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            {daysOfWeek.map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Calendar days grid */}
          <div className="grid grid-cols-7 gap-1.5" id="calendar-days-grid">
            {calendarCells.map((date, idx) => {
              if (date === null) {
                return <div key={`empty-${idx}`} className="aspect-square bg-slate-50/40 rounded-xl border border-dashed border-slate-100" />;
              }

              const day = date.getDate();
              const status = getDateStatus(date);
              
              const today = new Date();
              const isTodayCell = today.getDate() === day && today.getMonth() === date.getMonth() && today.getFullYear() === date.getFullYear();
              
              const isSelected = selectedDay && 
                                 selectedDay.getDate() === date.getDate() && 
                                 selectedDay.getMonth() === date.getMonth() && 
                                 selectedDay.getFullYear() === date.getFullYear();

              let cellStyle = 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700';
              let badgeStyle = '';

              if (status) {
                if (status.allPaid) {
                  cellStyle = 'bg-emerald-50 hover:bg-emerald-100/75 border-emerald-200 text-emerald-800';
                  badgeStyle = 'bg-emerald-500 text-white';
                } else if (status.isAnyOverdue) {
                  cellStyle = 'bg-red-50 hover:bg-red-100/75 border-red-200 text-red-900 font-semibold';
                  badgeStyle = 'bg-red-500 text-white animate-pulse';
                } else {
                  cellStyle = 'bg-indigo-50 hover:bg-indigo-100/75 border-indigo-200 text-indigo-900 font-semibold';
                  badgeStyle = 'bg-indigo-600 text-white';
                }
              }

              if (isTodayCell) {
                cellStyle += ' ring-2 ring-indigo-600/50 ring-offset-2';
              }

              if (isSelected) {
                cellStyle += ' border-2 border-slate-700 shadow-xs';
              }

              return (
                <button
                  key={`date-${date.toISOString()}`}
                  onClick={() => setSelectedDay(date)}
                  className={`aspect-square p-1.5 flex flex-col justify-between items-center rounded-xl border transition-all relative cursor-pointer ${cellStyle}`}
                  id={`calendar-day-cell-${date.toISOString()}`}
                >
                  <span className={`text-xs font-semibold rounded-md w-5 h-5 flex items-center justify-center ${isTodayCell ? 'bg-indigo-600 text-white font-bold' : ''}`}>
                    {day}
                  </span>
                  
                  {status && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${badgeStyle}`}>
                      {status.count} due
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 justify-center font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>Paid Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
              <span>Pending Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span>Overdue Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border border-indigo-600 ring-1 ring-indigo-600" />
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="lg:col-span-5 bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-col justify-between min-h-[300px]" id="calendar-details-panel">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {selectedDay ? `Due on ${getPaymentCalendarDate(selectedDay.getDate(), selectedMonth).readable}` : 'Select a calendar day'}
            </h4>

            {!selectedDay ? (
              <div className="text-center py-12 text-slate-400" id="empty-day-selection">
                <p className="text-xs">Click a day on the calendar to inspect or settle commitments due on that day.</p>
              </div>
            ) : selectedDayCommitments.length === 0 ? (
              <div className="text-center py-12 text-slate-400" id="empty-commitments-for-day">
                <p className="text-xs">No commitments are scheduled due on {getPaymentCalendarDate(selectedDay.getDate(), selectedMonth).readable}.</p>
              </div>
            ) : (
              <div className="space-y-3" id="calendar-day-commitments-list">
                {selectedDayCommitments.map((commitment) => {
                  const payment = payments[commitment.id];
                  const isPaid = payment?.status === 'paid';

                  return (
                    <div 
                      key={commitment.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 truncate">{commitment.name}</p>
                        <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">{commitment.category}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{formatCurrency(commitment.amount)} / month</p>
                      </div>

                      <button
                        onClick={() => onTogglePayment(commitment.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                          isPaid 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/10'
                        }`}
                        id={`calendar-quick-pay-${commitment.id}`}
                      >
                        {isPaid ? (
                          <>
                            <Check size={10} strokeWidth={3} /> Paid
                          </>
                        ) : (
                          <>
                            <Clock size={10} /> Pay Bill
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedDay && selectedDayCommitments.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 flex items-center gap-1 font-medium">
              <AlertCircle size={12} />
              <span>Payments toggled here immediately update your monthly progress metrics.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
