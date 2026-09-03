import * as XLSX from 'xlsx';
import { Commitment, CATEGORIES, Payment, monthToVal, valToMonth, getPaymentCalendarDate } from '../types';

export interface ParsedCommitmentItem extends Omit<Commitment, 'id' | 'userId' | 'createdAt'> {
  tempId: string;
  selected: boolean;
  isPaid?: boolean;
  paidAt?: string;
  detectedPaymentStatusRaw?: string;
  detectedPersonRaw?: string;
  detectedDurationRaw?: string;
  detectedStartRaw?: string;
  // Multi-installment detection
  detectedPaidMonths?: string[];
  detectedPaidCount?: number;
  detectedLeftCount?: number | 'Ongoing';
  detectedPaidDatesStr?: string;
  detectedInstallmentsPaidRaw?: string;
  detectedInstallmentsLeftRaw?: string;
  detectedDatesAlreadyPaidRaw?: string;
}

// ----------------------------------------------------
// EXPORT UTILITIES
// ----------------------------------------------------

export function exportCommitmentsToExcel(
  commitments: Commitment[],
  selectedMonth: string,
  userFilter: string,
  payments?: Record<string, Payment>,
  allPayments?: Record<string, Payment>
) {
  const data = commitments.map(c => {
    const payment = payments ? payments[c.id] : undefined;
    const isPaidThisMonth = payment?.status === 'paid';
    const paymentStatusThisMonth = isPaidThisMonth ? 'Paid' : 'Pending';
    const markedPaidText = isPaidThisMonth ? 'Yes' : 'No';
    const paidDateThisMonth = isPaidThisMonth && payment?.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '';

    // Calculate installment schedule metrics using allPayments
    const startCalVal = monthToVal(c.startMonth);
    const startBudgetVal = c.dueDay < 25 ? startCalVal - 1 : startCalVal;
    const isOngoing = c.durationMonths === 999;

    const paidDatesList: string[] = [];
    let nextDueDateStr = '';

    if (isOngoing) {
      if (allPayments) {
        const sortedPaid = Object.values(allPayments)
          .filter(p => p.commitmentId === c.id && p.status === 'paid')
          .sort((a, b) => a.month.localeCompare(b.month));
        
        sortedPaid.forEach(p => {
          const payCal = getPaymentCalendarDate(c.dueDay, p.month);
          paidDatesList.push(`${payCal.monthStr}-${String(c.dueDay).padStart(2, '0')}`);
        });
      }

      // Next due date from today
      const today = new Date();
      const currentCalVal = today.getFullYear() * 12 + today.getMonth();
      const curBudgetVal = c.dueDay < 25 ? currentCalVal - 1 : currentCalVal;
      for (let offset = 0; offset < 24; offset++) {
        const checkBMonth = valToMonth(curBudgetVal + offset);
        const pKey = `${c.id}_${checkBMonth}`;
        if (!allPayments?.[pKey] || allPayments[pKey].status !== 'paid') {
          const payCal = getPaymentCalendarDate(c.dueDay, checkBMonth);
          nextDueDateStr = `${payCal.monthStr}-${String(c.dueDay).padStart(2, '0')}`;
          break;
        }
      }
    } else {
      // Fixed tenure
      for (let i = 0; i < c.durationMonths; i++) {
        const bMonth = valToMonth(startBudgetVal + i);
        const payCal = getPaymentCalendarDate(c.dueDay, bMonth);
        const dateStr = `${payCal.monthStr}-${String(c.dueDay).padStart(2, '0')}`;
        const pKey = `${c.id}_${bMonth}`;
        const paidDoc = allPayments?.[pKey] || (bMonth === selectedMonth ? payment : undefined);
        if (paidDoc && paidDoc.status === 'paid') {
          paidDatesList.push(dateStr);
        } else if (!nextDueDateStr) {
          nextDueDateStr = dateStr;
        }
      }
    }

    const installmentsPaidCount = paidDatesList.length;
    const installmentsLeftCount = isOngoing ? 'Ongoing' : Math.max(0, c.durationMonths - installmentsPaidCount);
    const totalPaidAmount = installmentsPaidCount * c.amount;
    const remainingBalanceAmount = isOngoing ? 'Ongoing' : (typeof installmentsLeftCount === 'number' ? installmentsLeftCount * c.amount : 0);
    const datesAlreadyPaidStr = paidDatesList.join(', ');

    return {
      'Bill Name': c.name,
      'Category': c.category || 'Other',
      'Amount (RM)': c.amount,
      'Due Day': c.dueDay,
      'Start Month': c.startMonth,
      'Duration (Months)': isOngoing ? 'Ongoing' : c.durationMonths,
      'Installments Paid': installmentsPaidCount,
      'Installments Left': installmentsLeftCount,
      'Total Paid (RM)': totalPaidAmount,
      'Remaining Balance (RM)': remainingBalanceAmount,
      'Dates Already Paid': datesAlreadyPaidStr,
      'Next Due Date': nextDueDateStr,
      'Responsible Person': c.user || 'Person A',
      'Payment Status (This Month)': paymentStatusThisMonth,
      'Marked Paid': markedPaidText,
      'Payment Date': paidDateThisMonth,
      'Notes': c.notes || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 26 }, // Bill Name
    { wch: 15 }, // Category
    { wch: 14 }, // Amount (RM)
    { wch: 10 }, // Due Day
    { wch: 13 }, // Start Month
    { wch: 16 }, // Duration (Months)
    { wch: 16 }, // Installments Paid
    { wch: 16 }, // Installments Left
    { wch: 15 }, // Total Paid (RM)
    { wch: 20 }, // Remaining Balance (RM)
    { wch: 35 }, // Dates Already Paid
    { wch: 15 }, // Next Due Date
    { wch: 18 }, // Responsible Person
    { wch: 24 }, // Payment Status (This Month)
    { wch: 12 }, // Marked Paid
    { wch: 15 }, // Payment Date
    { wch: 30 }  // Notes
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Commitments');

  const filename = `commitments_${userFilter.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportCommitmentsToCSV(
  commitments: Commitment[],
  selectedMonth: string,
  userFilter: string,
  payments?: Record<string, Payment>,
  allPayments?: Record<string, Payment>
) {
  const headers = [
    'Bill Name',
    'Category',
    'Amount (RM)',
    'Due Day',
    'Start Month',
    'Duration (Months)',
    'Installments Paid',
    'Installments Left',
    'Total Paid (RM)',
    'Remaining Balance (RM)',
    'Dates Already Paid',
    'Next Due Date',
    'Responsible Person',
    'Payment Status (This Month)',
    'Marked Paid',
    'Payment Date',
    'Notes'
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
      return `"${str}"`;
    }
    return str;
  };

  const rows = commitments.map(c => {
    const payment = payments ? payments[c.id] : undefined;
    const isPaidThisMonth = payment?.status === 'paid';
    const paymentStatusThisMonth = isPaidThisMonth ? 'Paid' : 'Pending';
    const markedPaidText = isPaidThisMonth ? 'Yes' : 'No';
    const paidDateThisMonth = isPaidThisMonth && payment?.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '';

    const startCalVal = monthToVal(c.startMonth);
    const startBudgetVal = c.dueDay < 25 ? startCalVal - 1 : startCalVal;
    const isOngoing = c.durationMonths === 999;

    const paidDatesList: string[] = [];
    let nextDueDateStr = '';

    if (isOngoing) {
      if (allPayments) {
        const sortedPaid = Object.values(allPayments)
          .filter(p => p.commitmentId === c.id && p.status === 'paid')
          .sort((a, b) => a.month.localeCompare(b.month));
        
        sortedPaid.forEach(p => {
          const payCal = getPaymentCalendarDate(c.dueDay, p.month);
          paidDatesList.push(`${payCal.monthStr}-${String(c.dueDay).padStart(2, '0')}`);
        });
      }

      const today = new Date();
      const currentCalVal = today.getFullYear() * 12 + today.getMonth();
      const curBudgetVal = c.dueDay < 25 ? currentCalVal - 1 : currentCalVal;
      for (let offset = 0; offset < 24; offset++) {
        const checkBMonth = valToMonth(curBudgetVal + offset);
        const pKey = `${c.id}_${checkBMonth}`;
        if (!allPayments?.[pKey] || allPayments[pKey].status !== 'paid') {
          const payCal = getPaymentCalendarDate(c.dueDay, checkBMonth);
          nextDueDateStr = `${payCal.monthStr}-${String(c.dueDay).padStart(2, '0')}`;
          break;
        }
      }
    } else {
      for (let i = 0; i < c.durationMonths; i++) {
        const bMonth = valToMonth(startBudgetVal + i);
        const payCal = getPaymentCalendarDate(c.dueDay, bMonth);
        const dateStr = `${payCal.monthStr}-${String(c.dueDay).padStart(2, '0')}`;
        const pKey = `${c.id}_${bMonth}`;
        const paidDoc = allPayments?.[pKey] || (bMonth === selectedMonth ? payment : undefined);
        if (paidDoc && paidDoc.status === 'paid') {
          paidDatesList.push(dateStr);
        } else if (!nextDueDateStr) {
          nextDueDateStr = dateStr;
        }
      }
    }

    const installmentsPaidCount = paidDatesList.length;
    const installmentsLeftCount = isOngoing ? 'Ongoing' : Math.max(0, c.durationMonths - installmentsPaidCount);
    const totalPaidAmount = installmentsPaidCount * c.amount;
    const remainingBalanceAmount = isOngoing ? 'Ongoing' : (typeof installmentsLeftCount === 'number' ? installmentsLeftCount * c.amount : 0);
    const datesAlreadyPaidStr = paidDatesList.join(', ');

    return [
      escapeCSV(c.name),
      escapeCSV(c.category || 'Other'),
      c.amount,
      c.dueDay,
      escapeCSV(c.startMonth),
      c.durationMonths === 999 ? 'Ongoing' : c.durationMonths,
      installmentsPaidCount,
      typeof installmentsLeftCount === 'number' ? installmentsLeftCount : escapeCSV(installmentsLeftCount),
      totalPaidAmount,
      typeof remainingBalanceAmount === 'number' ? remainingBalanceAmount : escapeCSV(remainingBalanceAmount),
      escapeCSV(datesAlreadyPaidStr),
      escapeCSV(nextDueDateStr),
      escapeCSV(c.user || 'Person A'),
      escapeCSV(paymentStatusThisMonth),
      escapeCSV(markedPaidText),
      escapeCSV(paidDateThisMonth),
      escapeCSV(c.notes || '')
    ];
  });

  const csvContent = "\uFEFF" + [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = `commitments_${userFilter.replace(/\s+/g, '_')}_${selectedMonth}.csv`;
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generates a downloadable sample Excel template
export function downloadSampleExcelTemplate() {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const sampleData = [
    {
      'Bill Name': 'Car Loan (Honda)',
      'Category': 'Loan',
      'Amount (RM)': 850.00,
      'Due Day': 5,
      'Start Month': currentMonth,
      'Duration (Months)': 60,
      'Installments Paid': 5,
      'Installments Left': 55,
      'Total Paid (RM)': 4250.00,
      'Remaining Balance (RM)': 46750.00,
      'Dates Already Paid': `${currentMonth}-05`,
      'Next Due Date': '',
      'Responsible Person': 'Person A',
      'Payment Status (This Month)': 'Paid',
      'Marked Paid': 'Yes',
      'Payment Date': `${currentMonth}-05`,
      'Notes': 'Maybank Auto Loan'
    },
    {
      'Bill Name': 'House Rental',
      'Category': 'Rent',
      'Amount (RM)': 1400.00,
      'Due Day': 1,
      'Start Month': currentMonth,
      'Duration (Months)': 'Ongoing',
      'Installments Paid': 1,
      'Installments Left': 'Ongoing',
      'Total Paid (RM)': 1400.00,
      'Remaining Balance (RM)': 'Ongoing',
      'Dates Already Paid': `${currentMonth}-01`,
      'Next Due Date': '',
      'Responsible Person': 'Both',
      'Payment Status (This Month)': 'Paid',
      'Marked Paid': 'Yes',
      'Payment Date': `${currentMonth}-01`,
      'Notes': 'Transfer to landlord via DuitNow'
    },
    {
      'Bill Name': 'Shopee SpayLater',
      'Category': 'Installment',
      'Amount (RM)': 180.00,
      'Due Day': 10,
      'Start Month': currentMonth,
      'Duration (Months)': 6,
      'Installments Paid': 2,
      'Installments Left': 4,
      'Total Paid (RM)': 360.00,
      'Remaining Balance (RM)': 720.00,
      'Dates Already Paid': `${currentMonth}-10`,
      'Next Due Date': '',
      'Responsible Person': 'Person B',
      'Payment Status (This Month)': 'Paid',
      'Marked Paid': 'Yes',
      'Payment Date': `${currentMonth}-10`,
      'Notes': 'Phone purchase installment'
    },
    {
      'Bill Name': 'Netflix Premium',
      'Category': 'Subscription',
      'Amount (RM)': 55.00,
      'Due Day': 15,
      'Start Month': currentMonth,
      'Duration (Months)': 'Ongoing',
      'Installments Paid': 0,
      'Installments Left': 'Ongoing',
      'Total Paid (RM)': 0,
      'Remaining Balance (RM)': 'Ongoing',
      'Dates Already Paid': '',
      'Next Due Date': `${currentMonth}-15`,
      'Responsible Person': 'Person B',
      'Payment Status (This Month)': 'Pending',
      'Marked Paid': 'No',
      'Payment Date': '',
      'Notes': 'Family plan split'
    },
    {
      'Bill Name': 'TNB Electricity',
      'Category': 'Utility',
      'Amount (RM)': 120.00,
      'Due Day': 20,
      'Start Month': currentMonth,
      'Duration (Months)': 'Ongoing',
      'Installments Paid': 0,
      'Installments Left': 'Ongoing',
      'Total Paid (RM)': 0,
      'Remaining Balance (RM)': 'Ongoing',
      'Dates Already Paid': '',
      'Next Due Date': `${currentMonth}-20`,
      'Responsible Person': 'Person A',
      'Payment Status (This Month)': 'Pending',
      'Marked Paid': 'No',
      'Payment Date': '',
      'Notes': 'Account 2201994821'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 15 }, { wch: 22 }, { wch: 28 }, { wch: 15 },
    { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 30 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sample Commitments');
  XLSX.writeFile(wb, 'Monthly_Commitments_Template.xlsx');
}

// ----------------------------------------------------
// IMPORT & PARSING UTILITIES
// ----------------------------------------------------

/**
 * Universal file parser using SheetJS (XLSX).
 * Supports .xlsx, .xls, .csv, .tsv, .txt
 * Intelligently scans multiple rows to find the true table header row
 */
export async function parseExcelOrCSVFile(file: File): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('No worksheets found in this file.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  
  // Read as 2D matrix of rows first to find the true header row
  const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false
  });

  if (!matrix || matrix.length === 0) {
    throw new Error('Spreadsheet appears to be empty.');
  }

  // Keywords that identify header row
  const headerKeywords = [
    'bill', 'name', 'commitment', 'item', 'description', 'title', 'service',
    'amount', 'rm', 'cost', 'price', 'value', 'total', 'fee',
    'category', 'type', 'group', 'class',
    'due', 'day', 'date', 'month', 'start', 'duration', 'tenure',
    'person', 'responsible', 'user', 'owner', 'payer', 'who', 'whose', 'pic', 'party',
    'status', 'payment', 'paid', 'marked', 'ticked', 'settled',
    'orang', 'penama', 'pemilik', 'bayar', 'pihak', 'statusbayaran', 'sudahbayar'
  ];

  let headerRowIndex = 0;
  let maxScore = -1;

  // Scan the first 15 rows to find the best header candidate
  const scanLimit = Math.min(15, matrix.length);
  for (let r = 0; r < scanLimit; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    for (const cell of row) {
      const cellStr = String(cell || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cellStr) continue;
      for (const kw of headerKeywords) {
        if (cellStr.includes(kw)) {
          score++;
          break;
        }
      }
    }

    if (score > maxScore && score >= 1) {
      maxScore = score;
      headerRowIndex = r;
    }
  }

  // Extract headers
  const headerRow = matrix[headerRowIndex] || [];
  const headers: string[] = headerRow.map((h: any, idx: number) => {
    const str = String(h || '').trim();
    return str || `Column_${idx + 1}`;
  });

  // Convert subsequent data rows into objects
  const records: Record<string, any>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if entire row is empty
    const hasData = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
    if (!hasData) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
    });

    records.push(rowObj);
  }

  return records;
}

/**
 * Normalizes detected person from various strings with strict accuracy
 */
export function normalizePerson(raw: any): 'Person A' | 'Person B' | 'Both' {
  if (raw === undefined || raw === null) return 'Person A';
  const str = String(raw).trim().toLowerCase();
  if (!str) return 'Person A';

  // Clean string: alphanumeric only
  const clean = str.replace(/[^a-z0-9]/g, '');

  // 1. Both / Shared patterns
  if (
    clean === 'both' ||
    clean === 'shared' ||
    clean === 'joint' ||
    clean === 'all' ||
    clean === 'ab' ||
    clean === 'aplusb' ||
    clean === 'aandb' ||
    clean === 'aorb' ||
    clean === 'split' ||
    clean === 'couple' ||
    clean === 'family' ||
    clean === 'together' ||
    clean === 'combine' ||
    clean === 'combined' ||
    clean === 'bersama' ||
    clean === 'kongsi' ||
    clean === 'semua' ||
    clean === 'duadua' ||
    clean === 'keduanya' ||
    clean === '12' ||
    clean === '1plus2' ||
    clean === '1and2' ||
    clean === '3' ||
    str.includes('both') ||
    str.includes('shared') ||
    str.includes('joint') ||
    str.includes('a + b') ||
    str.includes('a+b') ||
    str.includes('a & b') ||
    str.includes('a&b') ||
    str.includes('a and b') ||
    str.includes('a/b') ||
    str.includes('a / b') ||
    str.includes('1 + 2') ||
    str.includes('1+2') ||
    str.includes('1 & 2') ||
    str.includes('1&2') ||
    str.includes('bersama') ||
    str.includes('kongsi')
  ) {
    return 'Both';
  }

  // 2. Person B patterns
  // Direct cleaned match
  if (
    clean === 'b' ||
    clean === 'pb' ||
    clean === 'personb' ||
    clean === 'userb' ||
    clean === 'person2' ||
    clean === 'user2' ||
    clean === 'p2' ||
    clean === '2' ||
    clean === 'partner' ||
    clean === 'wife' ||
    clean === 'husband' ||
    clean === 'spouse' ||
    clean === 'girlfriend' ||
    clean === 'boyfriend' ||
    clean === 'isteri' ||
    clean === 'suami' ||
    clean === 'pasangan' ||
    clean === 'orangb' ||
    clean === 'orang2' ||
    clean === 'individub' ||
    clean === 'individu2' ||
    clean === 'dia'
  ) {
    return 'Person B';
  }

  // Token / Substring checks for Person B
  if (
    str.includes('person b') ||
    str.includes('person_b') ||
    str.includes('person-b') ||
    str.includes('user b') ||
    str.includes('user_b') ||
    str.includes('user-b') ||
    str.includes('person 2') ||
    str.includes('user 2') ||
    str.includes('partner') ||
    str.includes('wife') ||
    str.includes('husband') ||
    str.includes('isteri') ||
    str.includes('suami') ||
    str.includes('pasangan') ||
    str.includes('orang b') ||
    str.startsWith('b ') ||
    str.startsWith('b-') ||
    str.startsWith('b/') ||
    str.startsWith('b:') ||
    str.startsWith('b.') ||
    str.startsWith('(b)') ||
    str.endsWith(' b') ||
    str.endsWith('(b)')
  ) {
    return 'Person B';
  }

  // 3. Person A patterns
  if (
    clean === 'a' ||
    clean === 'pa' ||
    clean === 'persona' ||
    clean === 'usera' ||
    clean === 'person1' ||
    clean === 'user1' ||
    clean === 'p1' ||
    clean === '1' ||
    clean === 'me' ||
    clean === 'self' ||
    clean === 'myself' ||
    clean === 'mine' ||
    clean === 'owner' ||
    clean === 'saya' ||
    clean === 'aku' ||
    clean === 'sendiri' ||
    clean === 'oranga' ||
    clean === 'orang1' ||
    clean === 'individua' ||
    clean === 'individu1'
  ) {
    return 'Person A';
  }

  if (
    str.includes('person a') ||
    str.includes('person_a') ||
    str.includes('person-a') ||
    str.includes('user a') ||
    str.includes('user_a') ||
    str.includes('user-a') ||
    str.includes('person 1') ||
    str.includes('user 1') ||
    str.includes('me') ||
    str.includes('saya') ||
    str.includes('aku') ||
    str.includes('sendiri') ||
    str.includes('orang a') ||
    str.startsWith('a ') ||
    str.startsWith('a-') ||
    str.startsWith('a/') ||
    str.startsWith('a:') ||
    str.startsWith('a.') ||
    str.startsWith('(a)') ||
    str.endsWith(' a') ||
    str.endsWith('(a)')
  ) {
    return 'Person A';
  }

  // Fallback default
  return 'Person A';
}

/**
 * Normalizes duration string or number into months count (or 999 for ongoing)
 */
export function normalizeDuration(raw: any): number {
  if (raw === undefined || raw === null) return 999;
  const str = String(raw).trim().toLowerCase();
  if (!str) return 999;

  if (
    str.includes('ongoing') ||
    str.includes('infinite') ||
    str.includes('forever') ||
    str.includes('subscription') ||
    str.includes('sub') ||
    str.includes('monthly') ||
    str.includes('recurring') ||
    str.includes('berterusan') ||
    str === '-' ||
    str === 'n/a' ||
    str === 'none'
  ) {
    return 999;
  }

  // Handle "Month 3 of 12", "3 of 24", "3/12"
  const ofMatch = str.match(/of\s*(\d+)/i) || str.match(/\/\s*(\d+)/);
  if (ofMatch && ofMatch[1]) {
    const total = parseInt(ofMatch[1], 10);
    if (!isNaN(total) && total > 0) return total;
  }

  // Extract digits
  const digitsMatch = str.match(/(\d+)/);
  if (digitsMatch && digitsMatch[1]) {
    const p = parseInt(digitsMatch[1], 10);
    if (!isNaN(p) && p > 0) return p;
  }

  return 999;
}

/**
 * Normalizes Start Month to YYYY-MM format
 */
export function normalizeStartMonth(raw: any, defaultMonth: string): string {
  if (!raw) return defaultMonth;
  const str = String(raw).trim();
  if (!str) return defaultMonth;

  // Direct YYYY-MM match
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }

  // Full date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 7);
  }

  // DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD
  const slashParts = str.split(/[\/\-\.]/);
  if (slashParts.length === 3) {
    const [p1, p2, p3] = slashParts;
    if (p1.length === 4) {
      // YYYY-MM-DD
      const m = String(parseInt(p2, 10)).padStart(2, '0');
      return `${p1}-${m}`;
    } else if (p3.length === 4) {
      // DD/MM/YYYY or MM/DD/YYYY
      const num1 = parseInt(p1, 10);
      const num2 = parseInt(p2, 10);
      let monthNum = num2;
      if (num1 <= 12 && num2 > 12) {
        monthNum = num1;
      }
      const m = String(monthNum >= 1 && monthNum <= 12 ? monthNum : 1).padStart(2, '0');
      return `${p3}-${m}`;
    }
  }

  // Try standard Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  return defaultMonth;
}

/**
 * Normalizes category name
 */
export function normalizeCategory(raw: any): string {
  if (!raw) return 'Other';
  const str = String(raw).trim();
  if (!str) return 'Other';

  const exact = CATEGORIES.find(c => c.toLowerCase() === str.toLowerCase());
  if (exact) return exact;

  const lower = str.toLowerCase();
  if (lower.includes('install') || lower.includes('spay') || lower.includes('grab') || lower.includes('atome') || lower.includes('bnpl') || lower.includes('ansuran')) {
    return 'Installment';
  }
  if (lower.includes('loan') || lower.includes('car') || lower.includes('auto') || lower.includes('mortgage') || lower.includes('asb') || lower.includes('ptptn') || lower.includes('bank') || lower.includes('pinjaman') || lower.includes('kereta') || lower.includes('rumah')) {
    return 'Loan';
  }
  if (lower.includes('sub') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('youtube') || lower.includes('icloud') || lower.includes('prime') || lower.includes('disney') || lower.includes('langganan')) {
    return 'Subscription';
  }
  if (lower.includes('rent') || lower.includes('sewa') || lower.includes('house') || lower.includes('condo') || lower.includes('room') || lower.includes('bilik')) {
    return 'Rent';
  }
  if (lower.includes('util') || lower.includes('tnb') || lower.includes('electric') || lower.includes('water') || lower.includes('air') || lower.includes('wifi') || lower.includes('internet') || lower.includes('unifi') || lower.includes('celcom') || lower.includes('maxis') || lower.includes('digi') || lower.includes('elektrik')) {
    return 'Utility';
  }
  if (lower.includes('insur') || lower.includes('takaful') || lower.includes('prudential') || lower.includes('great eastern') || lower.includes('aia') || lower.includes('medical') || lower.includes('life') || lower.includes('insuran')) {
    return 'Insurance';
  }

  return 'Other';
}

/**
 * Normalizes payment status and paid date from spreadsheet cells
 * Detects keywords like "paid", "ticked", "yes", "true", "settled", "sudah bayar", "lunas", "selesai",
 * checkmarks (✓, ✔, ☑), boolean values, or valid dates in paid date columns.
 */
export function normalizePaymentStatus(
  rawStatus: any,
  rawPaidDate?: any
): { isPaid: boolean; paidAt?: string } {
  let isPaid = false;
  let paidAt: string | undefined = undefined;

  // 1. Check rawStatus
  if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
    if (typeof rawStatus === 'boolean') {
      isPaid = rawStatus;
    } else if (typeof rawStatus === 'number') {
      isPaid = rawStatus === 1;
    } else {
      const str = String(rawStatus).trim();
      const lower = str.toLowerCase();
      const clean = lower.replace(/[^a-z0-9]/g, '');

      // Explicit negative check
      if (
        clean === 'pending' ||
        clean === 'unpaid' ||
        clean === 'notpaid' ||
        clean === 'no' ||
        clean === 'false' ||
        clean === '0' ||
        clean === 'belum' ||
        clean === 'belumbayar' ||
        clean === 'tertunggak' ||
        str === '-' ||
        str === 'n/a'
      ) {
        isPaid = false;
      } else if (
        clean === 'paid' ||
        clean === 'ispaid' ||
        clean === 'markedpaid' ||
        clean === 'settled' ||
        clean === 'settle' ||
        clean === 'ticked' ||
        clean === 'tick' ||
        clean === 'yes' ||
        clean === 'true' ||
        clean === 'y' ||
        clean === '1' ||
        clean === 'done' ||
        clean === 'checked' ||
        clean === 'check' ||
        clean === 'cleared' ||
        clean === 'complete' ||
        clean === 'completed' ||
        clean === 'sudah' ||
        clean === 'sudahbayar' ||
        clean === 'lunas' ||
        clean === 'selesai' ||
        clean === 'berjaya' ||
        lower.includes('paid') ||
        lower.includes('settle') ||
        lower.includes('sudah') ||
        lower.includes('lunas') ||
        lower.includes('selesai') ||
        str.includes('✓') ||
        str.includes('✔') ||
        str.includes('[x]') ||
        str.includes('☑')
      ) {
        isPaid = true;
      }
    }
  }

  // 2. Check rawPaidDate if provided
  if (rawPaidDate !== undefined && rawPaidDate !== null && rawPaidDate !== '') {
    const dateStr = String(rawPaidDate).trim();
    const lowerDate = dateStr.toLowerCase();
    if (
      dateStr !== '-' &&
      dateStr !== 'N/A' &&
      lowerDate !== 'pending' &&
      lowerDate !== 'unpaid' &&
      lowerDate !== 'no' &&
      lowerDate !== 'false'
    ) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        paidAt = d.toISOString();
        isPaid = true; // If a valid payment date is filled, it is paid
      }
    }
  }

  if (isPaid && !paidAt) {
    paidAt = new Date().toISOString();
  }

  return { isPaid, paidAt: isPaid ? paidAt : undefined };
}

/**
 * Converts parsed raw spreadsheet rows into previewable Commitment items
 * Features multi-layer detection for Person A / Person B / Both and Payment Status (Paid / Pending)
 */
export function convertRowsToCommitments(
  rows: Record<string, any>[],
  defaultMonth: string
): ParsedCommitmentItem[] {
  if (!rows || rows.length === 0) return [];

  // Check if sheet has two distinct columns for Person A and Person B
  const firstRowKeys = Object.keys(rows[0]);
  
  const colPersonA = firstRowKeys.find(k => {
    const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'persona' || clean === 'usera' || clean === 'a' || clean === 'person1' || clean === 'user1' || clean === 'p1';
  });

  const colPersonB = firstRowKeys.find(k => {
    const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'personb' || clean === 'userb' || clean === 'b' || clean === 'person2' || clean === 'user2' || clean === 'p2';
  });

  const hasTwoPersonColumns = Boolean(colPersonA && colPersonB && colPersonA !== colPersonB);

  return rows.map((row, index) => {
    const keys = Object.keys(row);

    // Robust key matching helper
    const getValue = (...aliases: string[]) => {
      // 1. Exact match pass (alphanumeric only)
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        const exactKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlias);
        if (exactKey && row[exactKey] !== undefined && row[exactKey] !== null) {
          const valStr = String(row[exactKey]).trim();
          if (valStr !== '') return valStr;
        }
      }

      // 2. Prefix / contains match pass
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanAlias.length < 3) continue;
        const matchedKey = keys.find(k => {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanK.includes(cleanAlias);
        });
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
          const valStr = String(row[matchedKey]).trim();
          if (valStr !== '') return valStr;
        }
      }

      return '';
    };

    // 1. Bill Name
    const rawName = getValue(
      'billname', 'bill', 'name', 'title', 'commitment', 'item', 
      'description', 'service', 'account', 'label', 'expense', 'subscription', 'nama', 'perkara'
    );
    const name = rawName || `Commitment ${index + 1}`;

    // 2. Category
    const rawCategory = getValue('category', 'type', 'group', 'class', 'tag', 'categorytype', 'kategori', 'jenis');
    const category = normalizeCategory(rawCategory);

    // 3. Amount
    let rawAmount = getValue(
      'amountrm', 'amount', 'monthlyamount', 'monthlyinstallment', 
      'cost', 'price', 'value', 'total', 'rm', 'fee', 'rate', 'jumlah', 'harga', 'bayaran'
    );

    let detectedPerson: 'Person A' | 'Person B' | 'Both' = 'Person A';
    let rawUser = '';

    // If sheet uses two-column format (Person A column and Person B column)
    if (hasTwoPersonColumns && colPersonA && colPersonB) {
      const valA = String(row[colPersonA] || '').trim();
      const valB = String(row[colPersonB] || '').trim();
      
      const numA = parseFloat(valA.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;
      const numB = parseFloat(valB.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;

      if (numA > 0 && numB > 0) {
        detectedPerson = 'Both';
        rawUser = `A: ${valA}, B: ${valB}`;
        if (!rawAmount) rawAmount = String(numA + numB);
      } else if (numB > 0 || (valB !== '' && valB !== '-' && valA === '')) {
        detectedPerson = 'Person B';
        rawUser = valB;
        if (!rawAmount && numB > 0) rawAmount = String(numB);
      } else if (numA > 0 || (valA !== '' && valA !== '-' && valB === '')) {
        detectedPerson = 'Person A';
        rawUser = valA;
        if (!rawAmount && numA > 0) rawAmount = String(numA);
      }
    }

    // 4. Amount parsing
    let amount = 0;
    if (rawAmount) {
      const cleaned = String(rawAmount).replace(/,/g, '').replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) amount = parsed;
    }

    // 5. Due Day (1 - 31)
    const rawDueDay = getValue(
      'dueday', 'duedate', 'due', 'day', 'dayofmonth', 'paymentday', 'billdate', 'cycledate', 'tarikh', 'hari'
    );
    let dueDay = 1;
    if (rawDueDay) {
      const strDue = String(rawDueDay).trim();
      if (strDue.includes('-') || strDue.includes('/')) {
        const d = new Date(strDue);
        if (!isNaN(d.getTime())) {
          dueDay = d.getDate();
        } else {
          const digits = strDue.replace(/[^0-9]/g, '');
          const p = parseInt(digits, 10);
          if (!isNaN(p) && p >= 1 && p <= 31) dueDay = p;
        }
      } else {
        const digits = strDue.replace(/[^0-9]/g, '');
        const p = parseInt(digits, 10);
        if (!isNaN(p) && p >= 1 && p <= 31) dueDay = p;
      }
    }

    // 6. Start Month (YYYY-MM)
    const rawStartMonth = getValue(
      'startmonth', 'startdate', 'start', 'month', 'effectivefrom', 
      'from', 'beginmonth', 'date', 'since', 'mula', 'bulan'
    );
    const startMonth = normalizeStartMonth(rawStartMonth, defaultMonth);

    // 7. Duration Months
    const rawDuration = getValue(
      'durationmonths', 'duration', 'durationinfo', 'months', 'tenure', 
      'period', 'totalmonths', 'installmentmonths', 'installments', 'plan', 'tempoh'
    );
    const durationMonths = normalizeDuration(rawDuration);

    // 8. Responsible Person (if not already determined by two-column layout)
    if (!hasTwoPersonColumns || rawUser === '') {
      rawUser = getValue(
        'responsibleperson', 'responsible', 'person', 'user', 'owner', 'assignedto', 
        'assigned', 'belongsto', 'belongs', 'paidby', 'payby', 'payer', 'who', 'whose', 
        'whom', 'pic', 'member', 'party', 'side', 'ab', 'personab', 'personaorb',
        'penama', 'orang', 'pemilik', 'pembayar', 'bayaroleh', 'pihak', 'individu', 
        'pasangan', 'tanggungan', 'ahli', 'for', 'accountowner'
      );

      if (rawUser) {
        detectedPerson = normalizePerson(rawUser);
      } else {
        // Fallback: Scan every cell value in this row to see if any cell contains Person B or Both indicators
        for (const k of keys) {
          const cellVal = String(row[k] || '').trim();
          if (!cellVal) continue;
          const cleanVal = cellVal.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          if (
            cleanVal === 'b' || 
            cleanVal === 'pb' || 
            cleanVal === 'personb' || 
            cleanVal === 'userb' || 
            cleanVal === 'person2' || 
            cleanVal === 'p2' || 
            cleanVal === 'partner' || 
            cleanVal === 'wife' || 
            cleanVal === 'husband' || 
            cleanVal === 'isteri' || 
            cleanVal === 'suami'
          ) {
            detectedPerson = 'Person B';
            rawUser = cellVal;
            break;
          } else if (
            cleanVal === 'both' || 
            cleanVal === 'shared' || 
            cleanVal === 'joint' || 
            cleanVal === 'ab' || 
            cleanVal === 'aplusb' || 
            cleanVal === 'aandb' || 
            cleanVal === 'bersama' || 
            cleanVal === 'kongsi'
          ) {
            detectedPerson = 'Both';
            rawUser = cellVal;
            break;
          } else if (
            cleanVal === 'a' || 
            cleanVal === 'pa' || 
            cleanVal === 'persona' || 
            cleanVal === 'usera' || 
            cleanVal === 'person1' || 
            cleanVal === 'p1' ||
            cleanVal === 'me' ||
            cleanVal === 'saya'
          ) {
            detectedPerson = 'Person A';
            rawUser = cellVal;
          }
        }
      }
    }

    // 9. Payment Status & Marked / Ticked Paid Detection
    const rawPaymentStatus = getValue(
      'paymentstatus', 'status', 'ispaid', 'paid', 'markedpaid', 'markedaspaid',
      'ticked', 'paidstatus', 'settled', 'settlement', 'sudahbayar', 'statusbayaran',
      'bayar', 'lunas', 'selesai', 'payment', 'bayaran', 'pembayaran', 'done', 'tickedpaid',
      'statusbayar', 'markpaid'
    );

    const rawPaidDate = getValue(
      'paymentdate', 'paiddate', 'datepaid', 'paidat', 'tarikhbayar', 'tarikhbayaran', 'tarikhselesai'
    );

    let { isPaid, paidAt } = normalizePaymentStatus(rawPaymentStatus, rawPaidDate);

    // Fallback: Check if any cell in the row explicitly has checkmark ✓, ✔ or "paid"
    if (!isPaid && !rawPaymentStatus && !rawPaidDate) {
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          cleanK.includes('status') ||
          cleanK.includes('paid') ||
          cleanK.includes('bayar') ||
          cleanK.includes('tick') ||
          cleanK.includes('settle')
        ) {
          const val = String(row[k] || '').trim();
          const check = normalizePaymentStatus(val);
          if (check.isPaid) {
            isPaid = true;
            paidAt = check.paidAt;
            break;
          }
        }
      }
    }

    // 10. Installment Progress & Dates Already Paid Detection
    const rawInstallmentsPaid = getValue(
      'installmentspaid', 'paidinstallments', 'paidcount', 'monthspaid', 'ansurandibayar',
      'telahbayar', 'terbayar', 'bayaran', 'progress', 'settledinstallments', 'installmentsdone',
      'noinstpaid', 'numberofpaidinstallments', 'ansuranselesai'
    );

    const rawInstallmentsLeft = getValue(
      'installmentsleft', 'remaininginstallments', 'leftcount', 'bakiansuran', 'bakibulan',
      'unpaidinstallments', 'monthsleft', 'balanceinstallments', 'remainingmonths', 'balanceleft',
      'left', 'baki'
    );

    const rawDatesAlreadyPaid = getValue(
      'datesalreadypaid', 'paiddates', 'tarikhbayar', 'tarikhbayaran', 'datespaid', 'paidmonths',
      'senaraibayaran', 'paymenthistory', 'tarikhsudahbayar', 'paiddateslist', 'history'
    );

    const startCalVal = monthToVal(startMonth);
    const startBudgetVal = dueDay < 25 ? startCalVal - 1 : startCalVal;
    const detectedBudgetMonths = new Set<string>();

    // A. Parse explicit date list in 'Dates Already Paid'
    if (rawDatesAlreadyPaid) {
      const chunks = String(rawDatesAlreadyPaid).split(/[,;\n\r|]+/);
      for (const chunkRaw of chunks) {
        const chunk = chunkRaw.trim();
        if (!chunk || chunk === '-' || chunk.toLowerCase() === 'n/a') continue;
        if (/^\d{4}-\d{2}-\d{2}$/.test(chunk)) {
          const [y, m] = chunk.split('-').map(Number);
          const bVal = dueDay < 25 ? y * 12 + (m - 1) - 1 : y * 12 + (m - 1);
          detectedBudgetMonths.add(valToMonth(bVal));
        } else if (/^\d{4}-\d{2}$/.test(chunk)) {
          const [y, m] = chunk.split('-').map(Number);
          const bVal = dueDay < 25 ? y * 12 + (m - 1) - 1 : y * 12 + (m - 1);
          detectedBudgetMonths.add(valToMonth(bVal));
        } else {
          const d = new Date(chunk);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const bVal = dueDay < 25 ? y * 12 + (m - 1) - 1 : y * 12 + (m - 1);
            detectedBudgetMonths.add(valToMonth(bVal));
          }
        }
      }
    }

    // B. Parse 'Installments Paid' count or progress (e.g. "5", "5/12", "5 of 12")
    if (rawInstallmentsPaid) {
      const str = String(rawInstallmentsPaid).trim().toLowerCase();
      let paidNum = 0;
      const fracMatch = str.match(/^(\d+)\s*(?:\/|of|daripada)\s*(\d+)/i);
      if (fracMatch) {
        paidNum = parseInt(fracMatch[1], 10);
      } else {
        const digitsMatch = str.match(/(\d+)/);
        if (digitsMatch) {
          paidNum = parseInt(digitsMatch[1], 10);
        }
      }
      if (!isNaN(paidNum) && paidNum > 0) {
        const limit = durationMonths === 999 ? paidNum : Math.min(paidNum, durationMonths);
        for (let k = 0; k < limit; k++) {
          detectedBudgetMonths.add(valToMonth(startBudgetVal + k));
        }
      }
    }

    // C. Parse 'Installments Left' remaining count (e.g. "7" left on a 12 month plan means 5 paid)
    if (rawInstallmentsLeft && durationMonths !== 999 && durationMonths > 0) {
      const strLeft = String(rawInstallmentsLeft).trim().toLowerCase();
      const leftMatch = strLeft.match(/(\d+)/);
      if (leftMatch) {
        const leftNum = parseInt(leftMatch[1], 10);
        if (!isNaN(leftNum) && leftNum >= 0 && leftNum <= durationMonths) {
          const derivedPaid = durationMonths - leftNum;
          if (derivedPaid > 0 && detectedBudgetMonths.size === 0) {
            for (let k = 0; k < derivedPaid; k++) {
              detectedBudgetMonths.add(valToMonth(startBudgetVal + k));
            }
          }
        }
      }
    }

    // D. If current month was marked as paid via single-month payment status or checkmark, add defaultMonth
    if (isPaid) {
      detectedBudgetMonths.add(defaultMonth);
    }

    const sortedBudgetMonths = Array.from(detectedBudgetMonths).sort();
    if (sortedBudgetMonths.includes(defaultMonth)) {
      isPaid = true;
      if (!paidAt) paidAt = new Date().toISOString();
    }

    const detectedPaidCount = sortedBudgetMonths.length;
    const detectedLeftCount = durationMonths === 999 
      ? 'Ongoing' 
      : Math.max(0, durationMonths - detectedPaidCount);

    const dateStrings: string[] = sortedBudgetMonths.map(bMonth => {
      const payCal = getPaymentCalendarDate(dueDay, bMonth);
      return `${payCal.readable}`;
    });
    const detectedPaidDatesStr = dateStrings.join(', ');

    // 11. Notes
    const notes = getValue('notes', 'note', 'remark', 'remarks', 'comments', 'comment', 'details', 'info', 'catatan', 'nota');

    return {
      tempId: `tmp_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      selected: true,
      name,
      category,
      amount,
      durationMonths,
      startMonth,
      dueDay,
      notes: notes || undefined,
      user: detectedPerson,
      isPaid,
      paidAt,
      detectedPaymentStatusRaw: rawPaymentStatus || undefined,
      detectedPersonRaw: rawUser || undefined,
      detectedDurationRaw: rawDuration || undefined,
      detectedStartRaw: rawStartMonth || undefined,
      detectedPaidMonths: sortedBudgetMonths,
      detectedPaidCount,
      detectedLeftCount,
      detectedPaidDatesStr: detectedPaidDatesStr || undefined,
      detectedInstallmentsPaidRaw: rawInstallmentsPaid || undefined,
      detectedInstallmentsLeftRaw: rawInstallmentsLeft || undefined,
      detectedDatesAlreadyPaidRaw: rawDatesAlreadyPaid || undefined
    };
  });
}
