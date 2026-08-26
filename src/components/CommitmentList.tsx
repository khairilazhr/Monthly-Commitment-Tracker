import { Commitment, Payment, CATEGORY_COLORS, isCommitmentActive, formatMonthReadable, monthToVal, getPaymentCalendarDate } from '../types';
import { exportCommitmentsToExcel, exportCommitmentsToCSV } from '../utils/excelImportExport';
import { Check, Clock, Calendar, Edit2, Trash2, Tag, AlertCircle, Plus, ChevronDown, ChevronUp, Download, Upload, FileSpreadsheet, Search, X } from 'lucide-react';
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

  // Helper to check if a due date has passed in the current calendar month
  const isOverdue = (commitment: Commitment) => {
    const today = new Date();
    const currentYearMonth = today.toISOString().substring(0, 7);
    
    // Only check overdue if we are viewing the current month or a past month
    if (selectedMonth > currentYearMonth) return false;
    
    // If it's a past month, any pending is overdue
    if (selectedMonth < currentYearMonth) {
      return !payments[commitment.id] || payments[commitment.id].status !== 'paid';
    }
    
    // If it's the current month, check if dueDay has passed
    const currentDay = today.getDate();
    const isPending = !payments[commitment.id] || payments[commitment.id].status !== 'paid';
    return isPending && commitment.dueDay < currentDay;
  };

  const getInstallmentInfo = (commitment: Commitment) => {
    if (commitment.durationMonths === 999) {
      return 'Continuous billing';
    }
    const startVal = monthToVal(commitment.startMonth);
    const selectedVal = monthToVal(selectedMonth);
    const elapsed = selectedVal - startVal + 1;
    return `${elapsed} of ${commitment.durationMonths} months`;
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

  const getInitialBubbleColors = (name: string, category: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('grab')) return 'bg-orange-100 text-orange-600 border-orange-200';
    if (lower.includes('shopee') || lower.includes('spay')) return 'bg-rose-100 text-rose-600 border-rose-200';
    if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('sub')) return 'bg-emerald-100 text-emerald-600 border-emerald-200';
    
    switch (category) {
      case 'Installment': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Subscription': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Loan': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Rent': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Utility': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'Insurance': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6" id="commitment-list-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 font-sans tracking-tight">Active Commitments</h3>
          <p className="text-xs text-slate-400 mt-0.5">Commitment schedule and settlement list for {formatMonthReadable(selectedMonth)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {commitments.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                id="list-export-excel-btn"
                title="Export commitments to Excel (.xlsx) or CSV"
              >
                <Download size={14} className="text-emerald-600 stroke-[2.5]" />
                Export
                <ChevronDown size={13} className="text-slate-400" />
              </button>

              {isExportMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsExportMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-30 animate-fade-in text-xs font-semibold">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Current Filtered Month ({activeCommitments.length})
                    </div>
                    <button
                      onClick={() => handleExportXLSX(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-600" />
                      Excel Spreadsheet (.xlsx)
                    </button>
                    <button
                      onClick={() => handleExportCSV(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download size={15} className="text-slate-500" />
                      CSV File (.csv)
                    </button>

                    <div className="my-1 border-t border-slate-100" />
                    
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      All Commitments Database ({commitments.length})
                    </div>
                    <button
                      onClick={() => handleExportXLSX(true)}
                      className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-600" />
                      Export All to Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => handleExportCSV(true)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download size={15} className="text-slate-500" />
                      Export All to CSV (.csv)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={onImportClick}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 hover:border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
            id="list-import-excel-btn"
            title="Import commitments from an Excel or CSV file"
          >
            <Upload size={14} className="text-emerald-600 stroke-[2.5]" />
            Import Excel
          </button>
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/10 active:scale-95"
            id="list-add-commitment-btn"
          >
            <Plus size={14} />
            Add Commitment
          </button>
        </div>
      </div>

      {totalActiveCount > 0 && (
        <div className="space-y-4 mb-6" id="filters-container">
          {/* Controls Bar: User Split Filter Toggles + Search Input */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
            {/* User Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-50 border border-slate-100 rounded-2xl w-fit" id="user-filter-bar">
              {['Both', 'Person A', 'Person B'].map((filter) => {
                const count = commitments
                  .filter(c => isCommitmentActive(c, selectedMonth))
                  .filter(c => {
                    if (filter === 'Both') return true;
                    return c.user === filter;
                  }).length;

                return (
                  <button
                    key={filter}
                    onClick={() => onUserFilterChange(filter)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      userFilter === filter
                        ? 'bg-white text-indigo-600 shadow-xs border border-slate-200 font-extrabold'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                    id={`filter-btn-${filter.replace(/\s+/g, '-')}`}
                  >
                    <span>{filter === 'Both' ? 'Both (A + B)' : filter}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      userFilter === filter ? 'bg-indigo-50 text-indigo-600 font-extrabold' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full md:w-80" id="commitment-search-box">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bills, categories, notes..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs"
                id="commitment-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Clear search"
                  id="clear-commitment-search-btn"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Filter & Search Summary Banner */}
          <div className="bg-slate-50/60 border border-slate-200/60 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-fade-in" id="filter-summary-bar">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {userFilter === 'Both' ? 'Both (A + B) Total' : `${userFilter} Total`}:
              </span>
              <span className="text-sm font-extrabold text-slate-800 font-sans tracking-tight">{formatCurrency(filteredTotal)}</span>
              
              {searchQueryTrimmed && (
                <span className="ml-1 text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg">
                  {activeCommitments.length} matching "{searchQuery}"
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="text-emerald-600 flex items-center gap-1">
                Paid: <strong>{formatCurrency(paidFilteredTotal)}</strong>
              </span>
              <span className="text-amber-600 flex items-center gap-1">
                Remaining: <strong>{formatCurrency(filteredTotal - paidFilteredTotal)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {totalActiveCount === 0 ? (
        <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl animate-fade-in" id="empty-commitments-state">
          <Calendar className="mx-auto text-slate-400 mb-3" size={32} />
          <h4 className="text-sm font-semibold text-slate-700">No active commitments this month</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            You don't have any installments, subscriptions, or payments scheduled for this month.
          </p>
          <button
            onClick={onAddClick}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            id="empty-state-add-btn"
          >
            <Plus size={14} /> Add your first commitment
          </button>
        </div>
      ) : activeCommitments.length === 0 ? (
        searchQueryTrimmed ? (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl animate-fade-in" id="empty-search-state">
            <Search className="mx-auto text-slate-400 mb-3" size={32} />
            <h4 className="text-sm font-bold text-slate-700">No commitments match "{searchQuery}"</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              We couldn't find any active commitments matching your search term under {userFilter === 'Both' ? 'all users' : userFilter}.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
              id="clear-search-empty-btn"
            >
              <X size={13} /> Clear Search Query
            </button>
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl animate-fade-in" id="empty-filter-state">
            <Tag className="mx-auto text-slate-400 mb-3" size={32} />
            <h4 className="text-sm font-semibold text-slate-700">No commitments found for this filter</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              There are no bills assigned to {userFilter === 'Both' ? 'Both' : userFilter} this month.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-4 animate-fade-in" id="commitments-cards-container">
          {activeCommitments.map((commitment) => {
            const payment = payments[commitment.id];
            const isPaid = payment?.status === 'paid';
            const isBillOverdue = isOverdue(commitment);
            const badgeStyle = CATEGORY_COLORS[commitment.category] || CATEGORY_COLORS['Other'];
            const bubbleColors = getInitialBubbleColors(commitment.name, commitment.category);
            const initial = commitment.name.charAt(0).toUpperCase();
            
            return (
              <div 
                key={commitment.id}
                className={`group border rounded-2xl transition-all duration-200 overflow-hidden ${
                  isPaid 
                    ? 'border-emerald-100 bg-emerald-50/10' 
                    : isBillOverdue
                    ? 'border-red-100 bg-red-50/5 hover:border-red-200'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
                id={`commitment-card-${commitment.id}`}
              >
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Left Column: Status toggle, Stylish Initial Bubble, and Name details */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Status Toggle Circle */}
                    <button
                      onClick={() => onTogglePayment(commitment.id)}
                      className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        isPaid 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : isBillOverdue
                          ? 'border-red-300 hover:border-red-500 hover:bg-red-50'
                          : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30'
                      }`}
                      id={`toggle-payment-btn-${commitment.id}`}
                      title={isPaid ? "Mark as Pending" : "Mark as Paid"}
                    >
                      {isPaid ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300 hover:bg-indigo-500 transition-colors" />
                      )}
                    </button>

                    {/* Stylish Brand Initial Bubble */}
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 italic ${bubbleColors}`}>
                      {initial}
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`font-bold text-sm md:text-base font-sans tracking-tight transition-all ${isPaid ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {commitment.name}
                        </h4>
                        
                        {/* Category Badge */}
                        <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-md uppercase tracking-wider ${badgeStyle}`}>
                          {commitment.category}
                        </span>

                        {/* User Assignment Badge */}
                        <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-md uppercase tracking-wider ${
                          commitment.user === 'Person A'
                            ? 'bg-rose-50 text-rose-700 border-rose-150'
                            : commitment.user === 'Person B'
                            ? 'bg-sky-50 text-sky-700 border-sky-150'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`} id={`user-badge-${commitment.id}`}>
                          👤 {commitment.user === 'Both' || !commitment.user ? 'Both' : commitment.user}
                        </span>

                        {/* Overdue Badge */}
                        {isBillOverdue && (
                          <span className="px-2 py-0.5 text-[10px] font-bold border border-red-200 bg-red-100 text-red-800 rounded-md flex items-center gap-1">
                            <AlertCircle size={10} /> Overdue
                          </span>
                        )}
                      </div>

                      {/* Sub-info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={12} className="text-slate-400" />
                          Due on {getPaymentCalendarDate(commitment.dueDay, selectedMonth).readable}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="flex items-center gap-1 font-medium text-slate-500">
                          <Clock size={12} className="text-slate-400" />
                          {getInstallmentInfo(commitment)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Amount and Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <p className={`text-lg font-bold font-sans tracking-tight ${isPaid ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {formatCurrency(commitment.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">Monthly commit</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {commitment.notes && (
                        <button
                          onClick={() => toggleNotes(commitment.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View Notes"
                        >
                          {expandedNotes[commitment.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(commitment)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        id={`edit-commitment-btn-${commitment.id}`}
                        title="Edit Commitment"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(commitment.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        id={`delete-commitment-btn-${commitment.id}`}
                        title="Delete Commitment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Notes Section */}
                {commitment.notes && expandedNotes[commitment.id] && (
                  <div className="px-5 pb-4 pt-1 bg-slate-50 border-t border-slate-100 animate-slide-down">
                    <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed font-sans font-medium">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px] block mb-1">Notes:</span>
                      {commitment.notes}
                    </p>
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
