import React, { useState } from 'react';
import { Commitment, CATEGORIES } from '../types';
import { Layers, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface CommitmentFormProps {
  onSave: (commitment: Omit<Commitment, 'id' | 'userId' | 'createdAt'>) => Promise<void> | void;
  onClose: () => void;
  initialCommitment?: Commitment;
}

export default function CommitmentForm({ onSave, onClose, initialCommitment }: CommitmentFormProps) {
  const [name, setName] = useState(initialCommitment?.name || '');
  const [category, setCategory] = useState(initialCommitment?.category || 'Installment');
  const [amount, setAmount] = useState(initialCommitment?.amount?.toString() || '');
  const [isOngoing, setIsOngoing] = useState(initialCommitment ? initialCommitment.durationMonths === 999 : false);
  const [durationMonths, setDurationMonths] = useState(
    initialCommitment ? (initialCommitment.durationMonths === 999 ? '12' : initialCommitment.durationMonths.toString()) : '12'
  );
  
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [startMonth, setStartMonth] = useState(initialCommitment?.startMonth || currentMonthStr);
  const [dueDay, setDueDay] = useState(initialCommitment?.dueDay?.toString() || '1');
  const [notes, setNotes] = useState(initialCommitment?.notes || '');
  const [user, setUser] = useState(
    initialCommitment?.user && initialCommitment.user !== 'Both'
      ? initialCommitment.user
      : 'Person A'
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!name.trim()) {
      setError('Please enter a bill or commitment name.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid monthly amount greater than 0.');
      return;
    }

    const parsedDueDay = parseInt(dueDay);
    if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      setError('Please enter a valid due day between 1 and 31.');
      return;
    }

    let parsedDuration = 999;
    if (!isOngoing) {
      parsedDuration = parseInt(durationMonths);
      if (isNaN(parsedDuration) || parsedDuration < 1) {
        setError('Please enter a duration of at least 1 month.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: Omit<Commitment, 'id' | 'userId' | 'createdAt'> = {
        name: name.trim(),
        category,
        amount: parsedAmount,
        durationMonths: parsedDuration,
        startMonth,
        dueDay: parsedDueDay,
        user,
      };
      if (notes.trim()) {
        payload.notes = notes.trim();
      }
      await onSave(payload);
    } catch (err: any) {
      console.error("Error saving commitment:", err);
      setError(err.message || 'Failed to save commitment. Please check your connection.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in" id="commitment-form-modal">
      <div className="bg-white rounded-t-[28px] sm:rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-black/[0.06] max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-ios-sheet" id="commitment-form-container">
        
        {/* iOS Grabber (Mobile) */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 bg-[#D1D1D6] rounded-full" />
        </div>

        {/* iOS Navigation Header */}
        <div className="px-4 py-3 border-b border-[#E5E5EA] flex items-center justify-between shrink-0">
          <button
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm font-normal text-[#007AFF] hover:opacity-75 transition-opacity cursor-pointer disabled:opacity-50"
            id="cancel-form-btn"
          >
            Cancel
          </button>

          <h3 className="text-base font-semibold text-[#1C1C1E] tracking-tight">
            {initialCommitment ? 'Edit Bill' : 'New Commitment'}
          </h3>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit()}
            className="text-sm font-semibold text-[#007AFF] hover:opacity-75 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            id="save-commitment-nav-btn"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            <span>{initialCommitment ? 'Done' : 'Add'}</span>
          </button>
        </div>

        {/* Form Body with iOS Inset Groups */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 bg-[#F2F2F7]">
          
          {error && (
            <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs rounded-xl font-medium flex items-center gap-2 animate-shake">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Group 1: General Info */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider px-2">
              Bill Details
            </span>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-2xs divide-y divide-[#E5E5EA] overflow-hidden">
              
              {/* Name Row */}
              <div className="flex items-center px-4 py-2.5">
                <span className="w-24 text-xs font-semibold text-[#1C1C1E] shrink-0">Name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Grab, Shopee, Netflix"
                  className="w-full bg-transparent text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none"
                  id="input-commitment-name"
                />
              </div>

              {/* Amount Row */}
              <div className="flex items-center px-4 py-2.5">
                <span className="w-24 text-xs font-semibold text-[#1C1C1E] shrink-0">Amount</span>
                <div className="flex items-center flex-1">
                  <span className="text-xs font-bold text-[#8E8E93] mr-1.5">RM</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-sm font-bold text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none tabular-nums"
                    id="input-commitment-amount"
                  />
                </div>
              </div>

              {/* Category Row */}
              <div className="flex items-center px-4 py-2.5">
                <span className="w-24 text-xs font-semibold text-[#1C1C1E] shrink-0">Category</span>
                <div className="relative flex-1">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-transparent text-sm text-[#007AFF] font-medium appearance-none focus:outline-none cursor-pointer"
                    id="select-commitment-category"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="text-[#1C1C1E]">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Schedule & Timing */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider px-2">
              Schedule & Duration
            </span>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-2xs divide-y divide-[#E5E5EA] overflow-hidden">
              
              {/* Due Day */}
              <div className="flex items-center px-4 py-2.5">
                <span className="w-28 text-xs font-semibold text-[#1C1C1E] shrink-0">Due Day</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="1 - 31"
                  className="w-full bg-transparent text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none tabular-nums"
                  id="input-commitment-dueday"
                />
              </div>

              {/* Start Month */}
              <div className="flex items-center px-4 py-2.5">
                <span className="w-28 text-xs font-semibold text-[#1C1C1E] shrink-0">Start Month</span>
                <input
                  type="month"
                  required
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full bg-transparent text-sm text-[#007AFF] font-medium focus:outline-none cursor-pointer"
                  id="input-commitment-start"
                />
              </div>

              {/* Ongoing Switch Row */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-xs font-semibold text-[#1C1C1E] block">Ongoing Subscription</span>
                  <span className="text-[10px] text-[#8E8E93]">No fixed end date</span>
                </div>
                {/* iOS Switch Toggle */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="checkbox-ongoing"
                    checked={isOngoing}
                    onChange={(e) => setIsOngoing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#E5E5EA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#34C759]"></div>
                </label>
              </div>

              {/* Duration in Months (if not ongoing) */}
              {!isOngoing && (
                <div className="flex items-center px-4 py-2.5 animate-fade-in">
                  <span className="w-28 text-xs font-semibold text-[#1C1C1E] shrink-0">Duration</span>
                  <div className="flex items-center flex-1">
                    <input
                      type="number"
                      min="1"
                      required={!isOngoing}
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                      placeholder="12"
                      className="w-full bg-transparent text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none tabular-nums"
                      id="input-commitment-duration"
                    />
                    <span className="text-xs text-[#8E8E93] font-medium ml-2">Months</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Group 3: Split Assignment */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider px-2">
              Assignment
            </span>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-2xs p-2">
              <div className="bg-[#767680]/12 p-1 rounded-xl flex items-center" id="user-selector-grid">
                {['Person A', 'Person B'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUser(u)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      user === u
                        ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                        : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                    }`}
                    id={`btn-user-select-${u.replace(/\s+/g, '-')}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Group 4: Notes */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider px-2">
              Notes (Optional)
            </span>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-2xs p-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Account number, contract ID, cancellation link..."
                rows={2}
                className="w-full bg-transparent text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none resize-none leading-relaxed"
                id="input-commitment-notes"
              />
            </div>
          </div>

          {/* Primary Save Button */}
          <div className="pt-2 pb-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#007AFF] hover:bg-[#0066D6] active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.25)] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              id="save-commitment-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{initialCommitment ? 'Updating Bill...' : 'Adding Bill...'}</span>
                </>
              ) : (
                <span>{initialCommitment ? 'Update Commitment' : 'Add Commitment'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
