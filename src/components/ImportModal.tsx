import React, { useState, useRef } from 'react';
import { Commitment, CATEGORIES, CATEGORY_COLORS } from '../types';
import { 
  parseExcelOrCSVFile, 
  convertRowsToCommitments, 
  downloadSampleExcelTemplate,
  ParsedCommitmentItem 
} from '../utils/excelImportExport';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileText, 
  Check, 
  Download, 
  Trash2, 
  Users, 
  RefreshCw,
  Sparkles,
  Info,
  Layers,
  AlertCircle
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (
    newCommitments: Omit<Commitment, 'id' | 'userId' | 'createdAt'>[],
    replaceExisting?: boolean
  ) => Promise<void>;
  onClearAllData?: () => Promise<void> | void;
  defaultMonth: string;
  existingCount: number;
}

export default function ImportModal({ 
  isOpen, 
  onClose, 
  onImport, 
  onClearAllData,
  defaultMonth,
  existingCount 
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ParsedCommitmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // Clear data state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsSuccess(false);

    try {
      const rows = await parseExcelOrCSVFile(selectedFile);
      if (!rows || rows.length === 0) {
        setError("Could not find any readable rows or headers in this file. Please make sure the file contains tabular data.");
        setItems([]);
        return;
      }

      const parsedCommitments = convertRowsToCommitments(rows, defaultMonth);
      if (parsedCommitments.length === 0) {
        setError("No valid commitment records could be extracted from this spreadsheet.");
        setItems([]);
      } else {
        setItems(parsedCommitments);
      }
    } catch (err: any) {
      console.error("Error parsing spreadsheet file:", err);
      setError(err.message || "Failed to read file. Please ensure it is a valid .xlsx, .xls, or .csv file.");
      setItems([]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleResetFile = () => {
    setFile(null);
    setItems([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Row updates
  const handleItemChange = (index: number, field: keyof ParsedCommitmentItem, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleSelect = (index: number) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  // Bulk actions
  const handleSelectAll = (select: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const handleSetAllPerson = (person: 'Person A' | 'Person B' | 'Both') => {
    setItems(prev => prev.map(item => ({ ...item, user: person })));
  };

  // Clear data handler
  const handleExecuteClearAll = async () => {
    if (!onClearAllData) return;
    setIsClearing(true);
    setError(null);
    try {
      await onClearAllData();
      setIsClearing(false);
      setClearSuccess(true);
      setShowClearConfirm(false);
      setTimeout(() => {
        setClearSuccess(false);
      }, 2500);
    } catch (err: any) {
      setIsClearing(false);
      setError(err.message || "Failed to clear existing data from database.");
    }
  };

  // Selected items calculation
  const selectedItems = items.filter(it => it.selected);
  const totalSelectedAmount = selectedItems.reduce((sum, it) => sum + (it.amount || 0), 0);
  const countPersonA = selectedItems.filter(it => it.user === 'Person A').length;
  const countPersonB = selectedItems.filter(it => it.user === 'Person B').length;
  const countBoth = selectedItems.filter(it => it.user === 'Both').length;

  const handleConfirmImport = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one commitment to import.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const commitmentsToSave = selectedItems.map(item => ({
        name: item.name.trim() || 'Untitled Commitment',
        category: item.category || 'Other',
        amount: Math.max(0, item.amount || 0),
        durationMonths: item.durationMonths || 999,
        startMonth: item.startMonth || defaultMonth,
        dueDay: Math.min(31, Math.max(1, item.dueDay || 1)),
        notes: item.notes?.trim() || undefined,
        user: item.user || 'Person A',
      }));

      await onImport(commitmentsToSave, importMode === 'replace');
      setIsSuccess(true);
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(false);
        setFile(null);
        setItems([]);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Error during import execution:", err);
      setError(err.message || "Failed to import commitments into database.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 animate-fade-in" id="import-excel-modal">
      {/* Hidden universal file input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".xlsx, .xls, .csv, .tsv, .txt" 
        onChange={handleFileChange}
        className="hidden" 
        id="universal-excel-input"
      />

      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-100 text-emerald-700 rounded-xl sm:rounded-2xl shrink-0">
              <FileSpreadsheet size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 font-sans tracking-tight">Import Excel / CSV</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Upload, verify person assignments, and manage records</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={downloadSampleExcelTemplate}
              className="px-2.5 sm:px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer shadow-2xs"
              id="download-template-btn"
              title="Download pre-formatted sample Excel file"
            >
              <Download size={12} className="text-indigo-600" />
              <span className="hidden xs:inline">Sample</span> Template
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
              id="close-import-modal-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-5 flex-1">
          
          {/* Clear Success Alert */}
          {clearSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold animate-fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>All commitments and payment records have been successfully cleared from the database!</span>
            </div>
          )}

          {/* Clear Confirmation Prompt Banner */}
          {showClearConfirm && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 animate-fade-in shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-950">Confirm Permanent Database Reset</h4>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    This will permanently delete <strong>all {existingCount} existing commitments</strong> and all payment history from your database. You can then start completely fresh.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleExecuteClearAll}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  id="modal-confirm-wipe-btn"
                >
                  <Trash2 size={13} />
                  {isClearing ? 'Clearing Database...' : 'Yes, Delete All Records'}
                </button>
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Database Reset Action Bar (Only in Import Modal) */}
          {onClearAllData && existingCount > 0 && !showClearConfirm && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <Info size={16} className="text-amber-600 shrink-0" />
                <span>
                  Currently <strong>{existingCount} active commitment{existingCount > 1 ? 's' : ''}</strong> in database.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                id="modal-trigger-clear-btn"
              >
                <Trash2 size={13} className="text-rose-600" />
                Clear All Data
              </button>
            </div>
          )}

          {/* File Upload Zone */}
          {!file || items.length === 0 ? (
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={openFilePicker}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs border border-slate-200 group-hover:scale-105 transition-transform">
                <Upload size={22} />
              </div>
              <p className="text-sm font-bold text-slate-800">Click to upload or drag & drop your Excel / CSV file</p>
              <p className="text-xs text-slate-400 mt-1">Supports modern Excel (.xlsx), legacy (.xls), and CSV files from Excel, Google Sheets, or Numbers</p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600 shadow-2xs">
                <Sparkles size={13} className="text-indigo-600" />
                <span>Accurate auto-detection: Person A, Person B, Both / Shared, Amounts & Due Dates</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">{file.name}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    {(file.size / 1024).toFixed(1)} KB • Detected {items.length} records ({selectedItems.length} selected for import)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button 
                  type="button"
                  onClick={openFilePicker}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
                  id="modal-change-file-btn"
                >
                  <RefreshCw size={12} />
                  Change File
                </button>
                <button 
                  type="button"
                  onClick={handleResetFile}
                  className="text-xs font-bold text-slate-500 hover:text-rose-700 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                  title="Remove file and pick another"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 font-medium animate-shake">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Commitments Table & Controls */}
          {items.length > 0 && (
            <div className="space-y-4">
              {/* Summary Stats & Bulk Assignment Bar */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                {/* Stats Breakdown */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Detected Split:
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs">
                    Total: <span className="text-indigo-600 font-sans">RM {totalSelectedAmount.toFixed(2)}</span>
                  </span>
                  <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                    Person A: {countPersonA}
                  </span>
                  <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-xl text-xs font-bold text-sky-700">
                    Person B: {countPersonB}
                  </span>
                  <span className="px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-700">
                    Both: {countBoth}
                  </span>
                </div>

                {/* Bulk Person Assignment */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                    <Users size={12} /> Assign All:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetAllPerson('Person A')}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Person A
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllPerson('Person B')}
                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Person B
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllPerson('Both')}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Both
                  </button>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Review or adjust any column values before importing
                </span>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.every(i => i.selected)}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Bill Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 w-28">Amount (RM)</th>
                      <th className="py-2.5 px-3 w-20">Due Day</th>
                      <th className="py-2.5 px-3 w-28">Start Month</th>
                      <th className="py-2.5 px-3 w-28">Duration</th>
                      <th className="py-2.5 px-3 w-36">Responsible Person</th>
                      <th className="py-2.5 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {items.map((item, idx) => (
                      <tr 
                        key={item.tempId} 
                        className={`transition-colors ${
                          item.selected ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/50 opacity-60'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelect(idx)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>

                        {/* Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-lg text-xs font-bold text-slate-800 transition-all"
                          />
                        </td>

                        {/* Category */}
                        <td className="py-2 px-3">
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Other']
                            }`}
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="py-2 px-3">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.amount}
                              onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-lg text-xs font-bold font-sans text-slate-800 transition-all"
                            />
                          </div>
                        </td>

                        {/* Due Day */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={item.dueDay}
                            onChange={(e) => handleItemChange(idx, 'dueDay', parseInt(e.target.value, 10) || 1)}
                            className="w-16 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-lg text-xs font-medium text-slate-700 transition-all"
                          />
                        </td>

                        {/* Start Month */}
                        <td className="py-2 px-3">
                          <input
                            type="month"
                            value={item.startMonth}
                            onChange={(e) => handleItemChange(idx, 'startMonth', e.target.value)}
                            className="w-28 px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-lg text-[11px] font-medium text-slate-700 transition-all"
                          />
                        </td>

                        {/* Duration */}
                        <td className="py-2 px-3">
                          <select
                            value={item.durationMonths === 999 ? 'ongoing' : item.durationMonths.toString()}
                            onChange={(e) => {
                              const val = e.target.value === 'ongoing' ? 999 : parseInt(e.target.value, 10);
                              handleItemChange(idx, 'durationMonths', val);
                            }}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                          >
                            <option value="ongoing">Ongoing</option>
                            <option value="3">3 Months</option>
                            <option value="6">6 Months</option>
                            <option value="12">12 Months</option>
                            <option value="24">24 Months</option>
                            <option value="36">36 Months</option>
                            <option value="48">48 Months</option>
                            <option value="60">60 Months</option>
                          </select>
                        </td>

                        {/* Person Selection */}
                        <td className="py-2 px-3">
                          <select
                            value={item.user || 'Person A'}
                            onChange={(e) => handleItemChange(idx, 'user', e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                              item.user === 'Person A'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.user === 'Person B'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            <option value="Person A">Person A</option>
                            <option value="Person B">Person B</option>
                            <option value="Both">Both (Shared)</option>
                          </select>
                        </td>

                        {/* Delete Row Button */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Remove this item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Mode Options (Fresh Start / Clear vs Append) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Database Destination Mode:</span>
                  {existingCount > 0 && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      Currently {existingCount} existing record{existingCount > 1 ? 's' : ''} in database
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    importMode === 'replace' 
                      ? 'bg-rose-50/60 border-rose-300 shadow-2xs' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-rose-600 focus:ring-rose-500 h-4 w-4 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-rose-900">Fresh Clean Import (Wipe & Replace)</p>
                      <p className="text-[11px] text-rose-700/80 mt-0.5">
                        Clears all previous records so your imported sheet is brand new and fresh
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    importMode === 'append' 
                      ? 'bg-indigo-50/60 border-indigo-300 shadow-2xs' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">Append / Add to Existing</p>
                      <p className="text-[11px] text-indigo-700/80 mt-0.5">
                        Keeps current commitments and adds imported records alongside them
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            id="cancel-import-btn"
          >
            Cancel
          </button>
          
          <button
            type="button"
            disabled={selectedItems.length === 0 || isProcessing || isSuccess}
            onClick={handleConfirmImport}
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              isSuccess 
                ? 'bg-emerald-600 shadow-emerald-600/20' 
                : selectedItems.length > 0 
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 active:scale-95' 
                : 'bg-slate-300 shadow-none cursor-not-allowed'
            }`}
            id="confirm-import-btn"
          >
            {isSuccess ? (
              <>
                <Check size={16} /> Successfully Imported!
              </>
            ) : isProcessing ? (
              <>Importing {selectedItems.length} records...</>
            ) : (
              <>
                <CheckCircle2 size={16} /> Confirm & Import {selectedItems.length} Commitment{selectedItems.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
