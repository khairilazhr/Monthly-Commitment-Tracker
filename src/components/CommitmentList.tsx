import { Commitment, Payment, CATEGORY_COLORS, isCommitmentActive, formatMonthReadable, monthToVal, getPaymentCalendarDate } from '../types';
import { exportCommitmentsToExcel, exportCommitmentsToCSV } from '../utils/excelImportExport';
import { Check, Clock, Calendar, Edit3, Trash2, Tag, AlertCircle, Plus, ChevronDown, ChevronUp, Download, Upload, FileSpreadsheet, Search, X } from 'lucide-react';
import { useState } from 'react';

interface CommitmentListProps {
  commitments: Commitment[];
  payments: Record<string, Payment>;
  selectedMonth: string;
  onTogglePayment: (commitmentId: string) => void;
  onEdit: (commitment: Commitment) => void;
  onDelete: (commitmentId: string) => void;
  onAddClick: () => void;
  userFilter: string;
  onUserFilterChange: (filter: string) => void;
  onImportClick: () => void;
}

export default function CommitmentList({
  commitments,
  payments,
  selectedMonth,
  onTogglePayment,
  onEdit,
  onDelete,
  onAddClick,
  userFilter,
  onUserFilterChange,
  onImportClick,
}: CommitmentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const searchQueryTrimmed = searchQuery.trim().toLowerCase();

  // Filter and sort active commitments for this month
  const activeCommitments = commitments
    .filter(c => isCommitmentActive(c, selectedMonth))
    .filter(c => {
      if (userFilter === 'Both') return true;
      return c.user === userFilter;
    })
    .filter(c => {
      if (!searchQueryTrimmed) return true;
      const nameMatch = (c.name || '').toLowerCase().includes(searchQueryTrimmed);
      const categoryMatch = (c.category || '').toLowerCase().includes(searchQueryTrimmed);
      const notesMatch = c.notes ? c.notes.toLowerCase().includes(searchQueryTrimmed) : false;
      const userMatch = c.user ? c.user.toLowerCase().includes(searchQueryTrimmed) : false;
      const amountMatch = c.amount.toString().includes(searchQueryTrimmed) || `rm ${c.amount}`.includes(searchQueryTrimmed);
      const dueMatch = `due ${c.dueDay}`.includes(searchQueryTrimmed) || c.dueDay.toString() === searchQueryTrimmed;
      return nameMatch || categoryMatch || notesMatch || userMatch || amountMatch || dueMatch;
    })
    .sort((a, b) => a.dueDay - b.dueDay);

  const handleExportXLSX = (allData: boolean = false) => {
    const listToExport = allData ? commitments : activeCommitments;
    exportCommitmentsToExcel(listToExport, selectedMonth, allData ? 'All_Database' : userFilter, payments);
    setIsExportMenuOpen(false);
  };

  const handleExportCSV = (allData: boolean = false) => {
    const listToExport = allData ? commitments : activeCommitments;
    exportCommitmentsToCSV(listToExport, selectedMonth, allData ? 'All_Database' : userFilter, payments);
    setIsExportMenuOpen(false);
  };

  const filteredTotal = activeCommitments.reduce((sum, c) => sum + c.amount, 0);
  const paidFilteredTotal = activeCommitments.reduce((sum, c) => {
    const isPaid = payments[c.id]?.status === 'paid';
    return isPaid ? sum + c.amount : sum;
  }, 0);

  const totalActiveCount = commitments.filter(c => isCommitmentActive(c, selectedMonth)).length;

  const isOverdue = (commitment: Commitment) => {
    const today = new Date();
    const currentYearMonth = today.toISOString().substring(0, 7);
    
    if (selectedMonth > currentYearMonth) return false;
    
    if (selectedMonth < currentYearMonth) {
      return !payments[commitment.id] || payments[commitment.id].status !== 'paid';
    }
    
    const currentDay = today.getDate();
    const isPending = !payments[commitment.id] || payments[commitment.id].status !== 'paid';
    return isPending && commitment.dueDay < currentDay;
  };

  const getInstallmentInfo = (commitment: Commitment) => {
    if (commitment.durationMonths === 999) {
      return 'Ongoing subscription';
    }
    const startVal = monthToVal(commitment.startMonth);
    const selectedVal = monthToVal(selectedMonth);
    const elapsed = selectedVal - startVal + 1;
    return `${elapsed} of ${commitment.durationMonths} mos`;
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatCurrency = (val: number) => {
    return 'RM ' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // iOS App Icon style colors
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
    <div className="space-y-4" id="commitment-list-section">
      
      {/* iOS Section Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1C1C1E] tracking-tight">
            Commitments
          </h2>
          <p className="text-xs text-[#8E8E93] mt-0.5">
            {formatMonthReadable(selectedMonth)} • {activeCommitments.length} item{activeCommitments.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {commitments.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                className="px-3 py-1.5 bg-white hover:bg-[#F2F2F7] active:scale-[0.98] text-[#1C1C1E] border border-black/[0.08] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                id="list-export-excel-btn"
                title="Export Data"
              >
                <Download size={14} className="text-[#007AFF]" />
                <span>Export</span>
                <ChevronDown size={12} className="text-[#8E8E93]" />
              </button>

              {isExportMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsExportMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl border border-black/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.12)] py-1.5 z-30 animate-ios-sheet text-xs font-medium divide-y divide-[#E5E5EA]">
                    <div className="px-3.5 py-1.5 text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                      Current Month ({activeCommitments.length})
                    </div>
                    <button
                      onClick={() => handleExportXLSX(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#F2F2F7] text-[#1C1C1E] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet size={15} className="text-[#34C759]" />
                      <span>Excel Spreadsheet (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => handleExportCSV(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#F2F2F7] text-[#1C1C1E] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download size={15} className="text-[#007AFF]" />
                      <span>CSV Document (.csv)</span>
                    </button>

                    <div className="px-3.5 py-1.5 text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                      All Database ({commitments.length})
                    </div>
                    <button
                      onClick={() => handleExportXLSX(true)}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#F2F2F7] text-[#1C1C1E] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet size={15} className="text-[#34C759]" />
                      <span>Export All to Excel</span>
                    </button>
                    <button
                      onClick={() => handleExportCSV(true)}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#F2F2F7] text-[#1C1C1E] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download size={15} className="text-[#007AFF]" />
                      <span>Export All to CSV</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={onImportClick}
            className="px-3 py-1.5 bg-white hover:bg-[#F2F2F7] active:scale-[0.98] text-[#1C1C1E] border border-black/[0.08] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            id="list-import-excel-btn"
            title="Import Excel or CSV"
          >
            <Upload size={14} className="text-[#34C759]" />
            <span>Import</span>
          </button>

          <button
            onClick={onAddClick}
            className="px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#0066D6] active:scale-[0.98] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(0,122,255,0.25)] cursor-pointer"
            id="list-add-commitment-btn"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Bill</span>
          </button>
        </div>
      </div>

      {/* iOS Segmented Filter & Search Toolbar */}
      {totalActiveCount > 0 && (
        <div className="space-y-3" id="filters-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            
            {/* iOS Segmented Control */}
            <div className="bg-[#767680]/12 p-1 rounded-xl flex items-center w-full sm:w-auto" id="user-filter-bar">
              {['Both', 'Person A', 'Person B'].map((filter) => {
                const count = commitments
                  .filter(c => isCommitmentActive(c, selectedMonth))
                  .filter(c => {
                    if (filter === 'Both') return true;
                    return c.user === filter;
                  }).length;

                const isSelected = userFilter === filter;

                return (
                  <button
                    key={filter}
                    onClick={() => onUserFilterChange(filter)}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                        : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                    }`}
                    id={`filter-btn-${filter.replace(/\s+/g, '-')}`}
                  >
                    <span>{filter === 'Both' ? 'All (A+B)' : filter}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-[#007AFF]/10 text-[#007AFF] font-bold' : 'bg-black/5 text-[#8E8E93]'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* iOS Search Bar */}
            <div className="relative w-full sm:w-72" id="commitment-search-box">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bills..."
                className="w-full pl-8.5 pr-8 py-1.5 bg-[#767680]/12 hover:bg-[#767680]/16 focus:bg-white border border-transparent focus:border-[#007AFF]/30 rounded-xl text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none transition-all"
                id="commitment-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#8E8E93] hover:text-[#1C1C1E] rounded-full hover:bg-black/5 transition-colors cursor-pointer"
                  title="Clear search"
                  id="clear-commitment-search-btn"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* iOS Summary Capsule */}
          <div className="bg-white px-4 py-2.5 rounded-xl border border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs shadow-2xs" id="filter-summary-bar">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#8E8E93] uppercase tracking-wider text-[10px]">
                {userFilter === 'Both' ? 'Month Total' : userFilter}:
              </span>
              <span className="font-bold text-[#1C1C1E] tabular-nums">
                {formatCurrency(filteredTotal)}
              </span>
              {searchQueryTrimmed && (
                <span className="text-[11px] font-semibold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-md">
                  {activeCommitments.length} matching
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-[#34C759]">
                Paid: <span className="tabular-nums">{formatCurrency(paidFilteredTotal)}</span>
              </span>
              <span className="text-[#FF9500]">
                Remaining: <span className="tabular-nums">{formatCurrency(filteredTotal - paidFilteredTotal)}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* iOS Inset Grouped List State Handling */}
      {totalActiveCount === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-black/[0.06] p-6 shadow-2xs animate-fade-in" id="empty-commitments-state">
          <div className="w-12 h-12 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center mx-auto mb-3">
            <Calendar size={22} strokeWidth={2} />
          </div>
          <h4 className="text-base font-bold text-[#1C1C1E]">No Commitments This Month</h4>
          <p className="text-xs text-[#8E8E93] mt-1 max-w-xs mx-auto">
            You don't have any installments, subscriptions, or bills scheduled for {formatMonthReadable(selectedMonth)}.
          </p>
          <button
            onClick={onAddClick}
            className="mt-4 px-4 py-2 bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 active:scale-[0.98]"
            id="empty-state-add-btn"
          >
            <Plus size={14} strokeWidth={2.5} /> Add First Bill
          </button>
        </div>
      ) : activeCommitments.length === 0 ? (
        <div className="py-10 text-center bg-white rounded-2xl border border-black/[0.06] p-6 shadow-2xs animate-fade-in" id="empty-search-state">
          <Search className="mx-auto text-[#8E8E93] mb-2" size={24} />
          <h4 className="text-sm font-bold text-[#1C1C1E]">No Results Found</h4>
          <p className="text-xs text-[#8E8E93] mt-1">
            No bills match "{searchQuery}" under {userFilter === 'Both' ? 'all users' : userFilter}.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-3 px-3 py-1.5 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] text-xs font-semibold rounded-xl transition-all cursor-pointer"
            id="clear-search-empty-btn"
          >
            Clear Search
          </button>
        </div>
      ) : (
        /* iOS Inset Grouped Table Card */
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-[#E5E5EA]" id="commitments-cards-container">
          {activeCommitments.map((commitment) => {
            const payment = payments[commitment.id];
            const isPaid = payment?.status === 'paid';
            const isBillOverdue = isOverdue(commitment);
            const badgeStyle = CATEGORY_COLORS[commitment.category] || CATEGORY_COLORS['Other'];
            const iconBg = getIconBackground(commitment.name, commitment.category);
            const initial = commitment.name.charAt(0).toUpperCase();
            
            return (
              <div 
                key={commitment.id}
                className={`transition-colors duration-150 ${
                  isPaid ? 'bg-[#F2F2F7]/40 hover:bg-[#F2F2F7]/70' : 'hover:bg-[#F2F2F7]/40'
                }`}
                id={`commitment-card-${commitment.id}`}
              >
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Left: Checkmark, App Icon, Name, Category */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    
                    {/* iOS Reminders Checkmark Button */}
                    <button
                      onClick={() => onTogglePayment(commitment.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
                        isPaid 
                          ? 'bg-[#34C759] border-[#34C759] text-white shadow-2xs' 
                          : isBillOverdue
                          ? 'border-[#FF3B30] hover:bg-[#FF3B30]/10'
                          : 'border-[#C7C7CC] hover:border-[#007AFF] hover:bg-[#007AFF]/5'
                      }`}
                      id={`toggle-payment-btn-${commitment.id}`}
                      title={isPaid ? "Mark as Pending" : "Mark as Paid"}
                    >
                      {isPaid && <Check size={13} strokeWidth={3} />}
                    </button>

                    {/* iOS App Squircle Badge */}
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${iconBg}`}>
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-sm font-semibold tracking-tight truncate max-w-[200px] sm:max-w-none ${
                          isPaid ? 'text-[#8E8E93] line-through' : 'text-[#1C1C1E]'
                        }`}>
                          {commitment.name}
                        </span>

                        {/* Category Pill */}
                        <span className={`px-1.5 py-0.2 text-[10px] font-semibold rounded-md border ${badgeStyle}`}>
                          {commitment.category}
                        </span>

                        {/* User Assignment Pill */}
                        <span className={`px-1.5 py-0.2 text-[10px] font-semibold rounded-md ${
                          commitment.user === 'Person A'
                            ? 'bg-[#FF2D55]/10 text-[#FF2D55]'
                            : commitment.user === 'Person B'
                            ? 'bg-[#007AFF]/10 text-[#007AFF]'
                            : 'bg-black/5 text-[#8E8E93]'
                        }`} id={`user-badge-${commitment.id}`}>
                          {commitment.user === 'Both' || !commitment.user ? 'Both' : commitment.user}
                        </span>

                        {/* Overdue Badge */}
                        {isBillOverdue && (
                          <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30] rounded-md flex items-center gap-1">
                            <AlertCircle size={10} strokeWidth={2.5} /> Overdue
                          </span>
                        )}
                      </div>

                      {/* Sub-label */}
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#8E8E93] mt-0.5">
                        <span>Due {getPaymentCalendarDate(commitment.dueDay, selectedMonth).readable}</span>
                        <span>•</span>
                        <span>{getInstallmentInfo(commitment)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <span className={`text-sm sm:text-base font-bold tabular-nums tracking-tight ${
                        isPaid ? 'text-[#8E8E93] line-through' : 'text-[#1C1C1E]'
                      }`}>
                        {formatCurrency(commitment.amount)}
                      </span>
                    </div>

                    {/* iOS Action Buttons */}
                    <div className="flex items-center gap-1">
                      {commitment.notes && (
                        <button
                          onClick={() => toggleNotes(commitment.id)}
                          className="p-1.5 text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                          title="Notes"
                        >
                          {expandedNotes[commitment.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(commitment)}
                        className="p-1.5 text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/10 rounded-lg transition-colors cursor-pointer"
                        id={`edit-commitment-btn-${commitment.id}`}
                        title="Edit"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(commitment.id)}
                        className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-colors cursor-pointer"
                        id={`delete-commitment-btn-${commitment.id}`}
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes Disclosure */}
                {commitment.notes && expandedNotes[commitment.id] && (
                  <div className="px-4 pb-3.5 pt-0.5 animate-ios-sheet">
                    <div className="p-2.5 bg-[#F2F2F7] rounded-xl text-xs text-[#3C3C43] leading-relaxed">
                      <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-0.5">Note:</span>
                      {commitment.notes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
