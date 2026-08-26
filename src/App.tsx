import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  getDocFromServer 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { Commitment, Payment, isCommitmentActive, monthToVal, valToMonth, formatMonthReadable } from './types';
import AuthScreen from './components/AuthScreen';
import DashboardStats from './components/DashboardStats';
import CommitmentList from './components/CommitmentList';
import CommitmentForm from './components/CommitmentForm';
import ImportModal from './components/ImportModal';
import ProjectionChart from './components/ProjectionChart';
import CalendarView from './components/CalendarView';
import { 
  Landmark, 
  Calendar as CalendarIcon, 
  LogOut, 
  LayoutDashboard, 
  TrendingUp, 
  UserCheck, 
  AlertCircle,
  HelpCircle,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<{ uid: string; email: string | null; isAnonymous: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(true);
  
  // Data state
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({}); // commitmentId -> Payment

  // Date and UI state
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'projections'>('dashboard');
  const [userFilter, setUserFilter] = useState<string>('Both');
  
  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<Commitment | undefined>(undefined);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Database action error state
  const [operationError, setOperationError] = useState<string | null>(null);

  const showError = (msg: string) => {
    setOperationError(msg);
    setTimeout(() => {
      setOperationError(null);
    }, 6000);
  };

  // Connection test - soft warning and safe handling
  useEffect(() => {
    async function testConnection() {
      const isLocal = localStorage.getItem('is_local_mode') === 'true';
      if (isLocal) return;
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.warn("Firestore connection offline or restricted. The application will continue utilizing standard cached or localized states.");
        }
      }
    }
    testConnection();
  }, []);

  // Monitor Authentication State
  useEffect(() => {
    const isLocal = localStorage.getItem('is_local_mode') === 'true';
    if (isLocal) {
      const localUserStr = localStorage.getItem('local_user');
      if (localUserStr) {
        setUser(JSON.parse(localUserStr));
        setAuthLoading(false);
        return;
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          isAnonymous: currentUser.isAnonymous
        });
        localStorage.setItem('is_local_mode', 'false');
      } else {
        const stillLocal = localStorage.getItem('is_local_mode') === 'true';
        if (stillLocal) {
          const localUserStr = localStorage.getItem('local_user');
          if (localUserStr) {
            setUser(JSON.parse(localUserStr));
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle Authentication success directly (both cloud and local fallback)
  const handleAuthSuccess = () => {
    const isLocal = localStorage.getItem('is_local_mode') === 'true';
    if (isLocal) {
      const localUserStr = localStorage.getItem('local_user');
      if (localUserStr) {
        setUser(JSON.parse(localUserStr));
      }
    } else if (auth.currentUser) {
      setUser({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        isAnonymous: auth.currentUser.isAnonymous
      });
    }
  };

  // Sync Commitments and Payments in real-time from Firestore or LocalStorage
  useEffect(() => {
    if (!user) {
      setCommitments([]);
      setPayments({});
      setDbLoading(false);
      return;
    }

    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    if (isLocal) {
      setDbLoading(true);
      // Load commitments
      const localComsKey = `commitments_${user.uid}`;
      const localComs = localStorage.getItem(localComsKey);
      const comsList: Commitment[] = localComs ? JSON.parse(localComs) : [];
      setCommitments(comsList);

      // Load payments
      const localPaysKey = `payments_${user.uid}_${selectedMonth}`;
      const localPays = localStorage.getItem(localPaysKey);
      const paymentsMap: Record<string, Payment> = localPays ? JSON.parse(localPays) : {};
      setPayments(paymentsMap);
      setDbLoading(false);
      return;
    }

    setDbLoading(true);

    // 1. Listen to Commitments
    const commitmentsQuery = query(
      collection(db, 'commitments'),
      where('userId', '==', user.uid)
    );

    const unsubscribeCommitments = onSnapshot(commitmentsQuery, (snapshot) => {
      const comsList: Commitment[] = [];
      snapshot.forEach((docSnap) => {
        comsList.push(docSnap.data() as Commitment);
      });
      setCommitments(comsList);
      setDbLoading(false);
    }, (error) => {
      console.error("Error subscribing to commitments:", error);
      setDbLoading(false);
    });

    // 2. Listen to Payments for current selected month
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('userId', '==', user.uid),
      where('month', '==', selectedMonth)
    );

    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsMap: Record<string, Payment> = {};
      snapshot.forEach((docSnap) => {
        const pay = docSnap.data() as Payment;
        paymentsMap[pay.commitmentId] = pay;
      });
      setPayments(paymentsMap);
    }, (error) => {
      console.error("Error subscribing to payments:", error);
    });

    return () => {
      unsubscribeCommitments();
      unsubscribePayments();
    };
  }, [user, selectedMonth]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    }
    localStorage.removeItem('is_local_mode');
    localStorage.removeItem('local_user');
    setUser(null);
  };

  // Month navigation: previous and next
  const handlePrevMonth = () => {
    const val = monthToVal(selectedMonth);
    setSelectedMonth(valToMonth(val - 1));
  };

  const handleNextMonth = () => {
    const val = monthToVal(selectedMonth);
    setSelectedMonth(valToMonth(val + 1));
  };

  const handleResetMonth = () => {
    setSelectedMonth(currentMonthStr);
  };

  // Toggle Payment status (paid vs pending)
  const handleTogglePayment = async (commitmentId: string) => {
    if (!user) return;

    const paymentId = `${commitmentId}_${selectedMonth}`;
    const existingPayment = payments[commitmentId];
    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    if (isLocal) {
      const updatedPayments = { ...payments };
      if (existingPayment && existingPayment.status === 'paid') {
        delete updatedPayments[commitmentId];
      } else {
        const newPayment: Payment = {
          id: paymentId,
          commitmentId,
          userId: user.uid,
          month: selectedMonth,
          status: 'paid',
          paidAt: new Date().toISOString(),
        };
        updatedPayments[commitmentId] = newPayment;
      }
      setPayments(updatedPayments);
      localStorage.setItem(`payments_${user.uid}_${selectedMonth}`, JSON.stringify(updatedPayments));
      return;
    }

    try {
      if (existingPayment && existingPayment.status === 'paid') {
        // Toggle to pending/unpaid (delete the payment document)
        await deleteDoc(doc(db, 'payments', paymentId));
      } else {
        // Save as paid
        const newPayment: Payment = {
          id: paymentId,
          commitmentId,
          userId: user.uid,
          month: selectedMonth,
          status: 'paid',
          paidAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'payments', paymentId), newPayment);
      }
    } catch (err: any) {
      console.error("Error toggling payment:", err);
      showError(err.message || "Failed to update payment status. Please check your cloud rules.");
    }
  };

  // Create or Update Commitment
  const handleSaveCommitment = async (formData: Omit<Commitment, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return;
    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    const id = editingCommitment?.id || `com_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const commitmentData: Commitment = {
      ...formData,
      id,
      userId: user.uid,
      createdAt: editingCommitment?.createdAt || new Date().toISOString(),
    };

    if (isLocal) {
      const updatedCommitments = commitments.filter(c => c.id !== id);
      updatedCommitments.push(commitmentData);
      setCommitments(updatedCommitments);
      localStorage.setItem(`commitments_${user.uid}`, JSON.stringify(updatedCommitments));
      setIsFormOpen(false);
      setEditingCommitment(undefined);
      return;
    }

    try {
      await setDoc(doc(db, 'commitments', id), commitmentData);
      setIsFormOpen(false);
      setEditingCommitment(undefined);
    } catch (err: any) {
      console.error("Error saving commitment:", err);
      showError(err.message || "Failed to save commitment. Please check your database permissions.");
    }
  };

  // Batch Import Commitments from Excel / CSV
  const handleBatchImportCommitments = async (
    newCommitments: Omit<Commitment, 'id' | 'userId' | 'createdAt'>[],
    replaceExisting: boolean = false
  ) => {
    if (!user) return;
    const isLocal = localStorage.getItem('is_local_mode') === 'true';
    const now = new Date().toISOString();

    const createdList: Commitment[] = newCommitments.map((formData, idx) => {
      const com: Commitment = {
        id: `com_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.uid,
        name: String(formData.name || '').trim() || `Commitment ${idx + 1}`,
        category: formData.category || 'Other',
        amount: typeof formData.amount === 'number' && !isNaN(formData.amount) ? Math.max(0, formData.amount) : 0,
        durationMonths: typeof formData.durationMonths === 'number' && !isNaN(formData.durationMonths) ? formData.durationMonths : 999,
        startMonth: /^\d{4}-\d{2}$/.test(formData.startMonth) ? formData.startMonth : selectedMonth,
        dueDay: typeof formData.dueDay === 'number' && !isNaN(formData.dueDay) ? Math.min(31, Math.max(1, formData.dueDay)) : 1,
        createdAt: now,
        user: formData.user === 'Person B' ? 'Person B' : formData.user === 'Both' ? 'Both' : 'Person A',
      };
      if (formData.notes && String(formData.notes).trim() !== '') {
        com.notes = String(formData.notes).trim().substring(0, 500);
      }
      return com;
    });

    if (isLocal) {
      const updatedCommitments = replaceExisting ? createdList : [...commitments, ...createdList];
      setCommitments(updatedCommitments);
      localStorage.setItem(`commitments_${user.uid}`, JSON.stringify(updatedCommitments));
      if (replaceExisting) {
        setPayments({});
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`payments_${user.uid}`)) {
            localStorage.removeItem(key);
          }
        });
      }
      return;
    }

    try {
      if (replaceExisting) {
        // Query and delete all existing user commitments
        const existingDocs = await getDocs(
          query(collection(db, 'commitments'), where('userId', '==', user.uid))
        );
        const deletePromises: Promise<any>[] = [];
        existingDocs.forEach(d => {
          deletePromises.push(deleteDoc(doc(db, 'commitments', d.id)));
        });

        // Also clean up any prior payments if doing a fresh replace
        const paymentDocs = await getDocs(
          query(collection(db, 'payments'), where('userId', '==', user.uid))
        );
        paymentDocs.forEach(d => {
          deletePromises.push(deleteDoc(doc(db, 'payments', d.id)));
        });

        await Promise.all(deletePromises);
        setPayments({});
      }

      // Save each new commitment with strictly sanitized payload (no undefined values)
      const savePromises = createdList.map(item => {
        const payload: any = {
          id: item.id,
          userId: user.uid,
          name: item.name,
          category: item.category,
          amount: item.amount,
          durationMonths: item.durationMonths,
          startMonth: item.startMonth,
          dueDay: item.dueDay,
          createdAt: item.createdAt,
          user: item.user,
        };
        if (item.notes) {
          payload.notes = item.notes;
        }
        return setDoc(doc(db, 'commitments', item.id), payload);
      });

      await Promise.all(savePromises);

      // Update local state
      const updatedList = replaceExisting ? createdList : [...commitments, ...createdList];
      setCommitments(updatedList);
    } catch (err: any) {
      console.error("Error importing commitments:", err);
      throw new Error(err.message || "Failed to save imported commitments to database.");
    }
  };

  // Clear All Commitments and Payment History (Fresh Database Reset)
  const handleClearAllData = async () => {
    if (!user) return;
    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    if (isLocal) {
      setCommitments([]);
      setPayments({});
      localStorage.removeItem(`commitments_${user.uid}`);
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`payments_${user.uid}`)) {
          localStorage.removeItem(key);
        }
      });
      return;
    }

    try {
      // 1. Fetch and delete all user commitments
      const commitmentsSnapshot = await getDocs(
        query(collection(db, 'commitments'), where('userId', '==', user.uid))
      );
      const deleteComPromises: Promise<any>[] = [];
      commitmentsSnapshot.forEach(docSnap => {
        deleteComPromises.push(deleteDoc(doc(db, 'commitments', docSnap.id)));
      });
      await Promise.all(deleteComPromises);
      
      // 2. Fetch and delete all user payment records
      const paymentsSnapshot = await getDocs(
        query(collection(db, 'payments'), where('userId', '==', user.uid))
      );
      const deletePayPromises: Promise<any>[] = [];
      paymentsSnapshot.forEach(docSnap => {
        deletePayPromises.push(deleteDoc(doc(db, 'payments', docSnap.id)));
      });
      await Promise.all(deletePayPromises);

      // Clean local storage cache
      localStorage.removeItem(`commitments_${user.uid}`);
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`payments_${user.uid}`)) {
          localStorage.removeItem(key);
        }
      });

      setCommitments([]);
      setPayments({});
    } catch (err: any) {
      console.error("Error clearing all data:", err);
      showError(err.message || "Failed to clear data from database. Please check your permissions.");
      throw err;
    }
  };

  // Delete Commitment
  const handleDeleteCommitment = async (commitmentId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this commitment? All history will be deleted.")) return;
    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    if (isLocal) {
      const updatedCommitments = commitments.filter(c => c.id !== commitmentId);
      setCommitments(updatedCommitments);
      localStorage.setItem(`commitments_${user.uid}`, JSON.stringify(updatedCommitments));

      const updatedPayments = { ...payments };
      delete updatedPayments[commitmentId];
      setPayments(updatedPayments);
      localStorage.setItem(`payments_${user.uid}_${selectedMonth}`, JSON.stringify(updatedPayments));
      return;
    }

    try {
      await deleteDoc(doc(db, 'commitments', commitmentId));
      // Delete corresponding payment document for this month if it exists
      await deleteDoc(doc(db, 'payments', `${commitmentId}_${selectedMonth}`));
    } catch (err: any) {
      console.error("Error deleting commitment:", err);
      showError(err.message || "Failed to delete commitment. Please check your database permissions.");
    }
  };

  const handleEditClick = (commitment: Commitment) => {
    setEditingCommitment(commitment);
    setIsFormOpen(true);
  };

  const handleAddClick = () => {
    setEditingCommitment(undefined);
    setIsFormOpen(true);
  };

  // Authentication screens
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center" id="app-loading-screen">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl animate-bounce mb-4">
          <Landmark size={36} />
        </div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse font-sans">Connecting to commitment cloud...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-dashboard-root">
      
      {/* Top Banner & Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40" id="main-header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2.5 sm:py-0 sm:h-16 gap-2 sm:gap-4">
            
            {/* Top row on mobile: Logo + User / Sign out */}
            <div className="flex justify-between items-center w-full sm:w-auto">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/10 shrink-0">
                  <Landmark size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight leading-tight">Monthly Commitments</h1>
                  <p className="text-[10px] text-slate-400 font-semibold hidden sm:block">Installment & Subscription Tracker</p>
                </div>
              </div>

              {/* Mobile Right Controls */}
              <div className="flex sm:hidden items-center gap-1.5" id="mobile-profile-controls">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 max-w-[120px] truncate">
                  {user.isAnonymous ? 'Guest' : user.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                  id="mobile-signout-btn"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {/* Middle: Month Navigation */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-50/90 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200 animate-fade-in w-full sm:w-auto" id="month-navigator">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 sm:p-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg sm:rounded-xl transition-all cursor-pointer active:scale-95 border border-indigo-100/50 shadow-2xs flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                title="Previous Month"
              >
                <ChevronLeft size={16} className="stroke-[2.5]" />
              </button>
              <button
                onClick={handleResetMonth}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-1 sm:py-2 bg-white hover:bg-slate-50 text-slate-800 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs border border-slate-200 h-8 sm:h-9 truncate"
                title="Go to current month"
              >
                <CalendarIcon size={12} className="text-indigo-600 animate-pulse shrink-0" />
                <span>{formatMonthReadable(selectedMonth)}</span>
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 sm:p-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg sm:rounded-xl transition-all cursor-pointer active:scale-95 border border-indigo-100/50 shadow-2xs flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                title="Next Month"
              >
                <ChevronRight size={16} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Desktop Right: Auth Profile and controls */}
            <div className="hidden sm:flex items-center gap-3" id="profile-controls">
              <div className="flex flex-col items-end text-right">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <UserCheck size={12} className={user.isAnonymous ? 'text-amber-500' : 'text-indigo-600'} />
                  {user.isAnonymous ? (localStorage.getItem('is_local_mode') === 'true' ? 'Local Sandbox Guest' : 'Guest Account') : user.email}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {localStorage.getItem('is_local_mode') === 'true' ? 'Local Sandbox' : user.isAnonymous ? 'Temporary Sync' : 'Cloud Sync Active'}
                </span>
              </div>
              
              <button
                onClick={handleSignOut}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                title="Sign Out"
                id="signout-header-btn"
              >
                <LogOut size={18} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Guest warning banner if anonymous */}
      {user.isAnonymous && (
        <div className="bg-amber-50/70 border-b border-amber-200 py-2.5 px-3 sm:px-4" id="guest-account-banner">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] sm:text-xs text-amber-800 font-bold">
            <span className="flex items-center gap-2">
              <Info size={14} className="text-amber-600 shrink-0" />
              {localStorage.getItem('is_local_mode') === 'true' 
                ? "Running in Local Sandbox Mode. Data is stored safely on this browser."
                : "Using Guest Mode. To sync across devices, sign out and register an account."}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
        
        {operationError && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 sm:p-4 rounded-2xl flex items-start gap-2.5 sm:gap-3 text-xs font-bold animate-shake" id="db-operation-error-banner">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-extrabold text-red-900">Database Action Failed</p>
              <p className="mt-0.5 font-medium text-red-700">{operationError}</p>
            </div>
            <button onClick={() => setOperationError(null)} className="text-red-500 hover:text-red-700 font-bold ml-auto cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* Statistics Banner */}
        <DashboardStats 
          commitments={commitments.filter(c => {
            if (userFilter === 'Both') return true;
            return c.user === userFilter;
          })}
          payments={payments}
          selectedMonth={selectedMonth}
          userFilter={userFilter}
        />

        {/* Tab Navigation Controls */}
        <div className="border-b border-slate-200 pb-0" id="tabs-navigation">
          <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-3 sm:pb-4 px-2 sm:px-1 border-b-2 font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              id="tab-btn-dashboard"
            >
              <LayoutDashboard size={14} className="shrink-0" />
              <span><span className="hidden xs:inline">Dashboard & </span>List</span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`pb-3 sm:pb-4 px-2 sm:px-1 border-b-2 font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              id="tab-btn-calendar"
            >
              <CalendarIcon size={14} className="shrink-0" />
              <span>Due <span className="hidden xs:inline">Schedule </span>Calendar</span>
            </button>
            <button
              onClick={() => setActiveTab('projections')}
              className={`pb-3 sm:pb-4 px-2 sm:px-1 border-b-2 font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'projections'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              id="tab-btn-projections"
            >
              <TrendingUp size={14} className="shrink-0" />
              <span>12-Month Proj<span className="hidden xs:inline">ection</span></span>
            </button>
          </nav>
        </div>

        {/* Tab Contents */}
        {dbLoading ? (
          <div className="py-16 sm:py-24 text-center text-slate-400" id="db-loading-state">
            <p className="text-xs sm:text-sm font-bold animate-pulse">Syncing transactions database...</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6" id="tab-content-wrapper">
            {activeTab === 'dashboard' && (
              <CommitmentList
                commitments={commitments}
                payments={payments}
                selectedMonth={selectedMonth}
                onTogglePayment={handleTogglePayment}
                onEdit={handleEditClick}
                onDelete={handleDeleteCommitment}
                onAddClick={handleAddClick}
                userFilter={userFilter}
                onUserFilterChange={setUserFilter}
                onImportClick={() => setIsImportOpen(true)}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                commitments={commitments}
                payments={payments}
                selectedMonth={selectedMonth}
                onTogglePayment={handleTogglePayment}
              />
            )}

            {activeTab === 'projections' && (
              <ProjectionChart
                commitments={commitments}
                selectedMonth={selectedMonth}
              />
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 sm:py-6 mt-8 sm:mt-12" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[10px] text-slate-400 font-bold">
          <p>© 2026 Monthly Commitments Financial Tracker. All connections secured on the cloud.</p>
        </div>
      </footer>

      {/* Commitment Add/Edit Form Modal */}
      {isFormOpen && (
        <CommitmentForm
          onSave={handleSaveCommitment}
          onClose={() => setIsFormOpen(false)}
          initialCommitment={editingCommitment}
        />
      )}

      {/* Excel/CSV Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleBatchImportCommitments}
        onClearAllData={handleClearAllData}
        defaultMonth={selectedMonth}
        existingCount={commitments.length}
      />

    </div>
  );
}
