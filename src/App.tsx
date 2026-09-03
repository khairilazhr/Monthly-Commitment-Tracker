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
import ImportModal, { ImportedCommitmentItem } from './components/ImportModal';
import ProjectionChart from './components/ProjectionChart';
import CalendarView from './components/CalendarView';
import CommitmentDetailModal from './components/CommitmentDetailModal';
import { InstallPwaPrompt } from './components/InstallPwaPrompt';
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
  const [payments, setPayments] = useState<Record<string, Payment>>({}); // commitmentId -> Payment (for selectedMonth)
  const [allPayments, setAllPayments] = useState<Record<string, Payment>>({}); // paymentId -> Payment (across all months)

  // Date and UI state
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'projections'>('dashboard');
  const [userFilter, setUserFilter] = useState<string>('Both');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<Commitment | undefined>(undefined);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedDetailCommitment, setSelectedDetailCommitment] = useState<Commitment | null>(null);

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
      setAllPayments({});
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

      // Load all local payments across all months
      const allPayMap: Record<string, Payment> = {};
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`payments_${user.uid}_`)) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            Object.values(parsed).forEach((p: any) => {
              if (p && p.id && p.commitmentId) {
                allPayMap[p.id] = p;
              }
            });
          } catch (e) {
            console.error("Error reading local payment:", e);
          }
        }
      });
      setAllPayments(allPayMap);
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

    // 2. Listen to Payments across all months for this user
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('userId', '==', user.uid)
    );

    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      const allPayMap: Record<string, Payment> = {};
      snapshot.forEach((docSnap) => {
        const pay = docSnap.data() as Payment;
        allPayMap[pay.id] = pay;
      });
      setAllPayments(allPayMap);
    }, (error) => {
      console.error("Error subscribing to payments:", error);
    });

    return () => {
      unsubscribeCommitments();
      unsubscribePayments();
    };
  }, [user]);

  // Synchronize current selectedMonth payments from allPayments
  useEffect(() => {
    const currentMonthPayments: Record<string, Payment> = {};
    (Object.values(allPayments) as Payment[]).forEach((pay) => {
      if (pay.month === selectedMonth) {
        currentMonthPayments[pay.commitmentId] = pay;
      }
    });
    setPayments(currentMonthPayments);
  }, [allPayments, selectedMonth]);

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

  // Toggle Payment status (paid vs pending) for selectedMonth or a specific targetMonth
  const handleTogglePayment = async (commitmentId: string, targetMonth: string = selectedMonth) => {
    if (!user) return;

    const paymentId = `${commitmentId}_${targetMonth}`;
    const existingPayment = allPayments[paymentId] || (targetMonth === selectedMonth ? payments[commitmentId] : undefined);
    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    if (isLocal) {
      const updatedAll = { ...allPayments };
      const updatedCurrent = { ...payments };
      const monthStorageKey = `payments_${user.uid}_${targetMonth}`;
      let monthPayments: Record<string, Payment> = {};
      try {
        monthPayments = JSON.parse(localStorage.getItem(monthStorageKey) || '{}');
      } catch {}

      if (existingPayment && existingPayment.status === 'paid') {
        delete updatedAll[paymentId];
        delete monthPayments[commitmentId];
        if (targetMonth === selectedMonth) {
          delete updatedCurrent[commitmentId];
        }
      } else {
        const newPayment: Payment = {
          id: paymentId,
          commitmentId,
          userId: user.uid,
          month: targetMonth,
          status: 'paid',
          paidAt: new Date().toISOString(),
        };
        updatedAll[paymentId] = newPayment;
        monthPayments[commitmentId] = newPayment;
        if (targetMonth === selectedMonth) {
          updatedCurrent[commitmentId] = newPayment;
        }
      }

      setAllPayments(updatedAll);
      setPayments(updatedCurrent);
      localStorage.setItem(monthStorageKey, JSON.stringify(monthPayments));
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
          month: targetMonth,
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

  // Batch Import Commitments from Excel / CSV (with Payment Status support)
  const handleBatchImportCommitments = async (
    newCommitments: ImportedCommitmentItem[],
    replaceExisting: boolean = false
  ) => {
    if (!user) return;
    const isLocal = localStorage.getItem('is_local_mode') === 'true';
    const now = new Date().toISOString();

    const createdList: Commitment[] = [];
    const createdPayments: Payment[] = [];

    newCommitments.forEach((formData, idx) => {
      const id = `com_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      const com: Commitment = {
        id,
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
      createdList.push(com);

      // Multi-installment detected payment months
      const paidMonthsSet = new Set<string>(formData.detectedPaidMonths || []);
      if (formData.isPaid) {
        paidMonthsSet.add(selectedMonth);
      }

      paidMonthsSet.forEach(bMonth => {
        const paymentId = `${id}_${bMonth}`;
        const newPayment: Payment = {
          id: paymentId,
          commitmentId: id,
          userId: user.uid,
          month: bMonth,
          status: 'paid',
          paidAt: formData.paidAt || now,
        };
        createdPayments.push(newPayment);
      });
    });

    if (isLocal) {
      const updatedCommitments = replaceExisting ? createdList : [...commitments, ...createdList];
      setCommitments(updatedCommitments);
      localStorage.setItem(`commitments_${user.uid}`, JSON.stringify(updatedCommitments));

      const updatedAll = replaceExisting ? {} : { ...allPayments };
      createdPayments.forEach(p => {
        updatedAll[p.id] = p;
        const monthKey = `payments_${user.uid}_${p.month}`;
        let monthData: Record<string, Payment> = {};
        try {
          monthData = JSON.parse(localStorage.getItem(monthKey) || '{}');
        } catch {}
        monthData[p.commitmentId] = p;
        localStorage.setItem(monthKey, JSON.stringify(monthData));
      });
      setAllPayments(updatedAll);

      if (replaceExisting) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`payments_${user.uid}`) && key !== `payments_${user.uid}_${selectedMonth}`) {
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

      // Save all detected/marked paid records to Firestore
      const paymentSavePromises = createdPayments.map(pay => {
        return setDoc(doc(db, 'payments', pay.id), pay);
      });

      await Promise.all([...savePromises, ...paymentSavePromises]);

      // Update local state
      const updatedList = replaceExisting ? createdList : [...commitments, ...createdList];
      setCommitments(updatedList);

      const updatedPaymentsMap = replaceExisting ? {} : { ...payments };
      createdPayments.forEach(p => {
        updatedPaymentsMap[p.commitmentId] = p;
      });
      setPayments(updatedPaymentsMap);
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

  // Keep selectedDetailCommitment updated with live commitments data
  useEffect(() => {
    if (selectedDetailCommitment) {
      const live = commitments.find(c => c.id === selectedDetailCommitment.id);
      if (live) {
        setSelectedDetailCommitment(live);
      } else {
        setSelectedDetailCommitment(null);
      }
    }
  }, [commitments]);

  // Delete Commitment
  const handleDeleteCommitment = async (commitmentId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this commitment? All history will be deleted.")) return;
    if (selectedDetailCommitment?.id === commitmentId) {
      setSelectedDetailCommitment(null);
    }
    const isLocal = localStorage.getItem('is_local_mode') === 'true';

    if (isLocal) {
      const updatedCommitments = commitments.filter(c => c.id !== commitmentId);
      setCommitments(updatedCommitments);
      localStorage.setItem(`commitments_${user.uid}`, JSON.stringify(updatedCommitments));

      const updatedPayments = { ...payments };
      delete updatedPayments[commitmentId];
      setPayments(updatedPayments);

      const updatedAll = { ...allPayments };
      Object.keys(updatedAll).forEach(key => {
        if (key.startsWith(`${commitmentId}_`)) {
          delete updatedAll[key];
        }
      });
      setAllPayments(updatedAll);

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
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-sans text-[#1C1C1E] antialiased" id="app-dashboard-root">
      
      {/* iOS Translucent Navigation Bar */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] sticky top-0 z-40 transition-colors" id="main-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2.5 sm:py-3 gap-2.5 sm:gap-4">
            
            {/* Top row on mobile: iOS Title + Account Badge */}
            <div className="flex justify-between items-center w-full sm:w-auto">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-b from-[#007AFF] to-[#0051B3] text-white rounded-[10px] sm:rounded-[11px] shadow-[0_2px_8px_rgba(0,122,255,0.25)] flex items-center justify-center shrink-0 border border-white/20">
                  <Landmark size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-[#1C1C1E] tracking-tight leading-none">Commitments</h1>
                  <p className="text-[11px] text-[#8E8E93] font-normal mt-0.5 hidden sm:block">Monthly Financial Tracker</p>
                </div>
              </div>

              {/* Mobile Profile & Sign out */}
              <div className="flex sm:hidden items-center gap-1.5" id="mobile-profile-controls">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#767680]/12 text-[#1C1C1E] max-w-[120px] truncate">
                  {user.isAnonymous ? 'Guest' : user.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                  id="mobile-signout-btn"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {/* Middle: iOS Month Switcher */}
            <div className="flex items-center justify-center gap-1 bg-[#767680]/12 p-1 rounded-xl w-full sm:w-auto" id="month-navigator">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 text-[#007AFF] hover:bg-white/60 active:scale-95 rounded-lg transition-all cursor-pointer h-7 w-7 flex items-center justify-center shrink-0"
                title="Previous Month"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                onClick={handleResetMonth}
                className="flex-1 sm:flex-initial px-3 py-1 bg-white hover:bg-white/90 text-[#1C1C1E] text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] h-7 truncate cursor-pointer"
                title="Jump to current month"
              >
                <CalendarIcon size={13} className="text-[#007AFF] shrink-0" />
                <span>{formatMonthReadable(selectedMonth)}</span>
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 text-[#007AFF] hover:bg-white/60 active:scale-95 rounded-lg transition-all cursor-pointer h-7 w-7 flex items-center justify-center shrink-0"
                title="Next Month"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Desktop Right: Profile Controls */}
            <div className="hidden sm:flex items-center gap-3" id="profile-controls">
              <div className="flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-[#1C1C1E] flex items-center gap-1">
                  <UserCheck size={13} className={user.isAnonymous ? 'text-[#FF9500]' : 'text-[#34C759]'} />
                  {user.isAnonymous ? (localStorage.getItem('is_local_mode') === 'true' ? 'Guest Mode' : 'Guest Account') : user.email}
                </span>
                <span className="text-[10px] font-medium text-[#8E8E93]">
                  {localStorage.getItem('is_local_mode') === 'true' ? 'Local Sandbox' : 'Cloud Sync Active'}
                </span>
              </div>
              
              <button
                onClick={handleSignOut}
                className="p-2 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-xl transition-colors cursor-pointer"
                title="Sign Out"
                id="signout-header-btn"
              >
                <LogOut size={16} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Guest Mode Banner */}
      {user.isAnonymous && (
        <div className="bg-[#FF9500]/10 border-b border-[#FF9500]/20 py-2 px-4" id="guest-account-banner">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[#8E8E93] font-medium">
            <span className="flex items-center gap-2 text-[#1C1C1E]">
              <Info size={14} className="text-[#FF9500] shrink-0" />
              {localStorage.getItem('is_local_mode') === 'true' 
                ? "Local Sandbox: Data is kept securely on this device."
                : "Guest Mode: Sign out and create an account to sync across Apple devices."}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        
        {operationError && (
          <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-medium animate-shake" id="db-operation-error-banner">
            <AlertCircle size={16} className="text-[#FF3B30] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-[#FF3B30]">Sync Notification</p>
              <p className="mt-0.5 text-xs text-[#1C1C1E]">{operationError}</p>
            </div>
            <button onClick={() => setOperationError(null)} className="text-[#8E8E93] hover:text-[#1C1C1E] font-semibold text-xs ml-auto cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* Dashboard Widgets */}
        <DashboardStats 
          commitments={commitments.filter(c => {
            if (userFilter === 'Both') return true;
            return c.user === userFilter;
          })}
          payments={payments}
          selectedMonth={selectedMonth}
          userFilter={userFilter}
        />

        {/* iOS Segmented Navigation Tabs */}
        <div className="bg-[#767680]/12 p-1 rounded-xl flex items-center" id="tabs-navigation">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                : 'text-[#8E8E93] hover:text-[#1C1C1E]'
            }`}
            id="tab-btn-dashboard"
          >
            <LayoutDashboard size={14} className="shrink-0" />
            <span>List</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                : 'text-[#8E8E93] hover:text-[#1C1C1E]'
            }`}
            id="tab-btn-calendar"
          >
            <CalendarIcon size={14} className="shrink-0" />
            <span>Schedule</span>
          </button>
          <button
            onClick={() => setActiveTab('projections')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'projections'
                ? 'bg-white text-[#1C1C1E] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                : 'text-[#8E8E93] hover:text-[#1C1C1E]'
            }`}
            id="tab-btn-projections"
          >
            <TrendingUp size={14} className="shrink-0" />
            <span>12-Mo Projections</span>
          </button>
        </div>

        {/* Tab Views */}
        {dbLoading ? (
          <div className="py-20 text-center text-[#8E8E93]" id="db-loading-state">
            <p className="text-xs font-medium animate-pulse">Syncing commitments...</p>
          </div>
        ) : (
          <div className="space-y-4" id="tab-content-wrapper">
            {activeTab === 'dashboard' && (
              <CommitmentList
                commitments={commitments}
                payments={payments}
                allPayments={allPayments}
                selectedMonth={selectedMonth}
                onTogglePayment={handleTogglePayment}
                onEdit={handleEditClick}
                onDelete={handleDeleteCommitment}
                onAddClick={handleAddClick}
                userFilter={userFilter}
                onUserFilterChange={setUserFilter}
                onImportClick={() => setIsImportOpen(true)}
                onViewDetails={(com) => setSelectedDetailCommitment(com)}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                commitments={commitments}
                payments={payments}
                selectedMonth={selectedMonth}
                onTogglePayment={handleTogglePayment}
                onViewDetails={(com) => setSelectedDetailCommitment(com)}
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

      {/* iOS Minimal Footer */}
      <footer className="py-6 mt-8 text-center text-[11px] text-[#8E8E93] space-y-1" id="main-footer">
        <p>Commitments Tracker</p>
        <p className="text-[10px] text-[#AEAEB2]">
          Crafted by <span className="font-semibold text-[#8E8E93]">Kai</span>
        </p>
      </footer>

      {/* Commitment Add/Edit Form Modal */}
      {isFormOpen && (
        <CommitmentForm
          onSave={handleSaveCommitment}
          onClose={() => setIsFormOpen(false)}
          initialCommitment={editingCommitment}
        />
      )}

      {/* Commitment Detail & Installment Schedule Modal */}
      {selectedDetailCommitment && (
        <CommitmentDetailModal
          commitment={selectedDetailCommitment}
          isOpen={Boolean(selectedDetailCommitment)}
          onClose={() => setSelectedDetailCommitment(null)}
          allPayments={allPayments}
          onTogglePayment={handleTogglePayment}
          onEdit={(com) => {
            setSelectedDetailCommitment(null);
            handleEditClick(com);
          }}
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

      {/* In-App PWA Install Banner */}
      <InstallPwaPrompt />

    </div>
  );
}
