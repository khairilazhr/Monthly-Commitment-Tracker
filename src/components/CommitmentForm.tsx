import React, { useState } from 'react';
import { Commitment, CATEGORIES } from '../types';
import { X, DollarSign, Calendar, Layers, Clock, Info } from 'lucide-react';

interface CommitmentFormProps {
  onSave: (commitment: Omit<Commitment, 'id' | 'userId' | 'createdAt'>) => void;
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
  
  // Current month in YYYY-MM format
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a commitment name.');
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
        setError('Please enter a valid duration of 1 month or more.');
        return;
      }
    }

    onSave({
      name: name.trim(),
      category,
      amount: parsedAmount,
      durationMonths: parsedDuration,
      startMonth,
      dueDay: parsedDueDay,
      notes: notes.trim() || undefined,
      user,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="commitment-form-modal">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden" id="commitment-form-container">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 font-sans tracking-tight">
            {initialCommitment ? 'Edit Commitment' : 'Add Monthly Commitment'}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            id="close-form-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-center gap-2 animate-shake">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {/* Commitment Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Financial Commitment Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grab Installment, Shopee Pay, Netflix"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400 font-sans font-medium"
              id="input-commitment-name"
            />
            <p className="mt-1 text-[10px] text-slate-400 font-medium">Specify the service provider or account name</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium cursor-pointer"
                  id="select-commitment-category"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <Layers size={14} />
                </div>
              </div>
            </div>

            {/* Monthly Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Monthly Amount
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">RM</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-bold"
                  id="input-commitment-amount"
                />
              </div>
            </div>
          </div>

          {/* Commitment Duration */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Type of commitment
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="checkbox-ongoing"
                  checked={isOngoing}
                  onChange={(e) => setIsOngoing(e.target.checked)}
                  className="rounded-md border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="checkbox-ongoing" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Ongoing / Subscription
                </label>
              </div>
            </div>

            {!isOngoing ? (
              <div className="space-y-1 animate-fade-in" id="duration-input-container">
                <label className="block text-[11px] font-bold text-slate-400">
                  Duration (How many months?)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required={!isOngoing}
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    placeholder="e.g. 6, 12, 24"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-semibold"
                    id="input-commitment-duration"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                    Months
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-indigo-600 bg-indigo-50/70 p-2.5 rounded-xl flex items-start gap-2 border border-indigo-100 animate-fade-in" id="ongoing-notice">
                <Clock size={14} className="mt-0.5 shrink-0" />
                <span className="font-semibold">Ongoing commitments have no set end date (e.g. utilities, rent, streaming subscriptions).</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Month */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Start Month
              </label>
              <div className="relative">
                <input
                  type="month"
                  required
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-medium cursor-pointer"
                  id="input-commitment-start"
                />
              </div>
            </div>

            {/* Payment Due Day */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Due Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="e.g. 5"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-sans font-semibold"
                id="input-commitment-dueday"
              />
            </div>
          </div>

          {/* Belongs To User Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Belongs To (For Split Payment)
            </label>
            <div className="grid grid-cols-2 gap-2" id="user-selector-grid">
              {['Person A', 'Person B'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUser(u)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    user === u
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                  id={`btn-user-select-${u.replace(/\s+/g, '-')}`}
                >
                  {u}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400 font-medium">Select who is responsible for this payment</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details, link, account ID, or reminder notes..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder:text-slate-400 font-sans font-semibold resize-none"
              id="input-commitment-notes"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              id="cancel-form-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-md shadow-indigo-600/10"
              id="save-commitment-btn"
            >
              {initialCommitment ? 'Update' : 'Add Commitment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
