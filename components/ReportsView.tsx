
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileSpreadsheet, Download, LogIn, Loader2, Table, Calendar as CalendarIcon, MapPin, User as UserIcon, Briefcase, Filter, RefreshCw, ChevronRight, ChevronLeft, X, Link as LinkIcon, AlertCircle, Check, ShieldCheck, ChevronDown, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppConfig } from '../types';

interface ReportsViewProps {
  syncUrl: string;
  adminConfig: AppConfig;
  onUpdateConfig?: (cfg: Partial<AppConfig>) => void;
}

const MultiSelect = ({ label, options, selected, onToggle, placeholder, icon: Icon }: { label: string, options: string[], selected: string[], onToggle: (val: string) => void, placeholder: string, icon: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative space-y-1 w-full text-right" ref={wrapperRef}>
      <label className="text-[9px] font-black text-white mr-2 uppercase flex items-center gap-1"><Icon size={10} /> {label}</label>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold text-right flex justify-between items-center hover:border-blue-500 transition-all shadow-inner"
      >
        <span className="truncate max-w-[150px]">
          {selected.length === 0 ? placeholder : 
           selected.length === 1 ? selected[0] : 
           `${selected.length} مختار`}
        </span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 p-2 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-full left-0 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative mb-2">
            <input 
              type="text" 
              placeholder="بحث..." 
              className="w-full bg-slate-900 border border-slate-700 text-white px-8 py-2 rounded-lg text-[10px] outline-none focus:border-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-hide space-y-1">
            {filtered.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-2 italic">لا توجد نتائج</div>
            ) : (
              filtered.map(opt => (
                <button 
                  key={opt}
                  type="button"
                  onClick={() => onToggle(opt)}
                  className={`w-full text-right px-3 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between ${selected.includes(opt) ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                >
                  <span>{opt}</span>
                  {selected.includes(opt) && <Check size={12} />}
                </button>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <button 
              type="button"
              onClick={() => { selected.slice().forEach(s => onToggle(s)); setIsOpen(false); }} 
              className="w-full mt-2 py-1.5 text-[8px] text-red-400 hover:bg-red-900/20 font-black uppercase rounded-lg border border-red-900/30"
            >
              مسح المختار
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CustomDatePicker = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (val: string) => void, placeholder: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const handleDateClick = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const offset = selected.getTimezoneOffset();
    const adjustedDate = new Date(selected.getTime() - (offset * 60 * 1000));
    onChange(adjustedDate.toISOString().split('T')[0]);
    setIsOpen(false);
  };
  const changeMonth = (offset: number) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (
    <div className="relative space-y-1 w-full text-right">
      <label className="text-[9px] font-black text-white mr-2 uppercase">{label}</label>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold text-right flex justify-between items-center hover:border-blue-500 transition-all shadow-inner"><span>{value || placeholder}</span><CalendarIcon size={14} className="text-slate-500" /></button>
      {isOpen && (<div className="absolute z-50 mt-2 p-4 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-64 right-0"><div className="flex justify-between items-center mb-4"><button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-700 rounded-lg text-white"><ChevronRight size={18} /></button><span className="text-xs font-black text-blue-400">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span><button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-700 rounded-lg text-white"><ChevronLeft size={18} /></button></div><div className="grid grid-cols-7 gap-1 text-center mb-2">{["S", "M", "T", "W", "T", "F", "S"].map(d => (<span key={d} className="text-[10px] text-slate-500 font-bold">{d}</span>))}</div><div className="grid grid-cols-7 gap-1 text-center">{Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (<div key={`empty-${i}`} />))}{Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => { const day = i + 1; const isSelected = value === new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split('T')[0]; return (<button key={day} type="button" onClick={() => handleDateClick(day)} className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}>{day}</button>); })}</div><button type="button" onClick={() => setIsOpen(false)} className="w-full mt-4 py-1 text-[9px] text-slate-500 hover:text-white font-black uppercase tracking-widest border-t border-slate-700 pt-2">إغلاق</button></div>)}
    </div>
  );
};

export default function ReportsView({ syncUrl: initialSyncUrl, adminConfig, onUpdateConfig }: ReportsViewProps) {
  const [localSyncUrl, setLocalSyncUrl] = useState(initialSyncUrl || localStorage.getItem('attendance_temp_sync_url') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<any[]>([]); // New state for users
  const [error, setError] = useState('');
  const [showUrlField, setShowUrlField] = useState(!initialSyncUrl);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const activeSyncUrl = localSyncUrl || initialSyncUrl;

  const fetchData = async (showLoading = true) => {
    if (!activeSyncUrl) { setError('يرجى إدخال رابط المزامنة الخاص بالشركة أولاً'); setShowUrlField(true); return; }
    if (!username || !password) { setError('يرجى إدخل اسم المستخدم وكلمة المرور'); return; }
    if (showLoading) setIsLoading(true); else setIsRefreshing(true);
    setError('');
    try {
      const response = await fetch(`${activeSyncUrl}?action=getReportData&user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}`);
      const data = await response.json();
      if (data.error) { 
        setError('بيانات الدخول غير صحيحة'); 
        if (showLoading) setIsLoggedIn(false); 
      } else { 
        // Handle new response format { records: [], users: [] }
        if (Array.isArray(data)) {
           // Backward compatibility
           setRecords(data); 
           setAuthorizedUsers([]);
        } else {
           setRecords(data.records || []);
           setAuthorizedUsers(data.users || []);
        }
        setIsLoggedIn(true); 
        if (adminConfig && username === adminConfig.adminUsername && password === adminConfig.adminPassword) setIsAdminLogin(true); 
        else setIsAdminLogin(false); 
        localStorage.setItem('attendance_temp_sync_url', activeSyncUrl); 
        setShowUrlField(false); 
      }
    } catch (err) { setError('خطأ في الاتصال'); setShowUrlField(true); } finally { setIsLoading(false); setIsRefreshing(false); }
  };

  const handleUnlink = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في فك الارتباط بالشركة الحالية؟')) {
      onUpdateConfig?.({ syncUrl: '', googleSheetLink: '' });
      setIsLoggedIn(false);
      setLocalSyncUrl('');
      setShowUrlField(true);
      setError('');
    }
  };

  const exportToExcel = () => {
    if (!fromDate || !toDate) {
      alert('يرجى تحديد الفترة (من تاريخ / إلى تاريخ) لاستخراج تقرير البيانات الشاملة');
      return;
    }

    const dataToExport = filteredRecords.map(r => ({
      'Date': new Date(r.date).toLocaleDateString('en-US'),
      'Time': new Date(r.time).toLocaleTimeString('en-US'),
      'Employee Name': r.name,
      'Serial Number': r.serialNumber || 'N/A', 
      'Job': r.job,
      'Branch': r.branch,
      'Type': r.type === 'check-in' ? 'Check-In' : 'Check-Out',
      'Time Diff': r.timeDiff || '', 
      'Reason/Notes': r.reason || '',
      'GPS Location': r.gps
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `AllData_${username}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportSummaryExcel = () => {
    if (!fromDate || !toDate) { alert('يرجى تحديد الفترة (من تاريخ / إلى تاريخ) لحساب الملخص'); return; }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const selectedEnd = new Date(toDate);
    selectedEnd.setHours(0, 0, 0, 0);
    const actualEnd = selectedEnd > today ? today : selectedEnd;

    let workingDaysCount = 0;
    const workingDaysSet = new Set<string>();
    const currentDay = new Date(start);
    while (currentDay <= actualEnd) {
      if (currentDay.getDay() !== 5) { // 5 = Friday
        workingDaysCount++;
        workingDaysSet.add(currentDay.toISOString().split('T')[0]);
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Determine target users to include (All filtered authorized users, even if they have no records)
    const targetUsers = authorizedUsers.length > 0 ? authorizedUsers.filter(u => {
        let match = true;
        if (selectedJobs.length > 0) match = match && selectedJobs.includes(u.jobTitle);
        if (selectedEmployees.length > 0) match = match && selectedEmployees.includes(u.fullName);
        if (selectedBranches.length > 0) match = match && selectedBranches.includes(u.defaultBranch);
        return match;
    }) : [];

    // Fallback if authorizedUsers is empty (old backend), use records
    const usersToProcess = targetUsers.length > 0 ? targetUsers : 
      Array.from(new Set(filteredRecords.map(r => r.name))).map(name => {
         const r = filteredRecords.find(x => x.name === name);
         return { fullName: name, jobTitle: r?.job || 'N/A', defaultBranch: r?.branch || 'N/A', serialNumber: r?.serialNumber || 'N/A' };
      });

    const employeeSummary: Record<string, any> = {};
    const parseTimeStr = (str: string) => {
      if (!str) return { h: 0, m: 0 };
      const hoursMatch = str.match(/(\d+)\s*ساعة/);
      const minsMatch = str.match(/(\d+)\s*دقيقة/);
      return {
        h: hoursMatch ? parseInt(hoursMatch[1]) : 0,
        m: minsMatch ? parseInt(minsMatch[1]) : 0
      };
    };

    // Initialize summary for all target users
    usersToProcess.forEach(u => {
      // Use Serial Number as key if available, else Name
      const userId = u.serialNumber && u.serialNumber !== 'undefined' ? u.serialNumber : u.fullName;
      employeeSummary[userId] = {
            name: u.fullName,
            branchName: u.defaultBranch,
            jobTitle: u.jobTitle,
            attendanceDates: new Set<string>(),
            departureDates: new Set<string>(),
            lateArrivalDays: 0,
            earlyDepartureDays: 0,
            totalLateH: 0, totalLateM: 0,
            totalEarlyH: 0, totalEarlyM: 0,
            totalOvertimeH: 0, totalOvertimeM: 0
      };
    });

    // Populate with attendance records
    const dailyRecords: Record<string, Record<string, { firstIn?: any, lastOut?: any }>> = {};

    filteredRecords.forEach(r => {
      const userId = r.serialNumber && r.serialNumber !== 'undefined' ? r.serialNumber : r.name;
      // Skip if this record doesn't belong to our filtered user list (shouldn't happen if filters match, but safety check)
      if (!employeeSummary[userId]) return;

      const recordDateObj = new Date(r.date);
      recordDateObj.setHours(0, 0, 0, 0);
      const dateKey = recordDateObj.toISOString().split('T')[0];

      if (!dailyRecords[userId]) dailyRecords[userId] = {};
      if (!dailyRecords[userId][dateKey]) dailyRecords[userId][dateKey] = {};

      const currentDayData = dailyRecords[userId][dateKey];
      const recordTime = new Date(r.time).getTime();

      if (r.type === 'check-in') {
        if (!currentDayData.firstIn || recordTime < new Date(currentDayData.firstIn.time).getTime()) {
          currentDayData.firstIn = r;
        }
      } else if (r.type === 'check-out') {
        if (!currentDayData.lastOut || recordTime > new Date(currentDayData.lastOut.time).getTime()) {
          currentDayData.lastOut = r;
        }
      }
    });

    // Process summarized daily data
    Object.keys(dailyRecords).forEach(userId => {
      const dates = dailyRecords[userId];
      const s = employeeSummary[userId];
      
      Object.keys(dates).forEach(dateKey => {
        const dayData = dates[dateKey];
        
        // Only count if it's a valid working day
        if (workingDaysSet.has(dateKey)) {
          // Process First Check-In
          if (dayData.firstIn) {
            s.attendanceDates.add(dateKey); // Count this day for attendance
            if (dayData.firstIn.timeDiff.includes('متأخر')) {
              s.lateArrivalDays++;
              const t = parseTimeStr(dayData.firstIn.timeDiff);
              s.totalLateH += t.h;
              s.totalLateM += t.m;
            }
          }

          // Process Last Check-Out
          if (dayData.lastOut) {
            s.departureDates.add(dateKey); // Count this day for departure
            const t = parseTimeStr(dayData.lastOut.timeDiff);
            if (dayData.lastOut.timeDiff.includes('مبكر')) {
              s.earlyDepartureDays++;
              s.totalEarlyH += t.h;
              s.totalEarlyM += t.m;
            } else if (dayData.lastOut.timeDiff.includes('متأخر')) {
              s.totalOvertimeH += t.h;
              s.totalOvertimeM += t.m;
            }
          }
        }
      });
    });

    const summaryData = Object.values(employeeSummary).map(s => {
      const lateTotalH = s.totalLateH + Math.floor(s.totalLateM / 60);
      const earlyTotalH = s.totalEarlyH + Math.floor(s.totalEarlyM / 60);
      const overtimeTotalH = s.totalOvertimeH + Math.floor(s.totalOvertimeM / 60);
      const attDaysCount = s.attendanceDates.size;
      const depDaysCount = s.departureDates.size;

      return {
        'اسم الموظف': s.name,
        'اسم الفرع': s.branchName,
        'الوظيفة': s.jobTitle,
        'عدد أيام العمل المتاحة': workingDaysCount,
        'عدد أيام الحضور': attDaysCount,
        'عدد أيام الانصراف': depDaysCount,
        'عدد أيام الغياب': Math.max(0, workingDaysCount - Math.max(attDaysCount, depDaysCount)),
        'عدد أيام الحضور متأخر': s.lateArrivalDays,
        'عدد أيام الانصراف المبكر': s.earlyDepartureDays,
        'ساعات الحضور المتأخر': `${lateTotalH}:${(s.totalLateM % 60).toString().padStart(2, '0')}`,
        'ساعات الانصراف المبكر': `${earlyTotalH}:${(s.totalEarlyM % 60).toString().padStart(2, '0')}`,
        'ساعات الانصراف المتأخر (الإضافي)': `${overtimeTotalH}:${(s.totalOvertimeM % 60).toString().padStart(2, '0')}`
      };
    });

    const ws = XLSX.utils.json_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary Report");
    XLSX.writeFile(wb, `Summary_${username}_${fromDate}_to_${toDate}.xlsx`);
  };

  const availableJobs = useMemo(() => {
    // Merge jobs from records and authorized users
    const jobsFromRecords = new Set(records.map(r => r.job));
    const jobsFromUsers = new Set(authorizedUsers.map(u => u.jobTitle));
    return Array.from(new Set([...jobsFromRecords, ...jobsFromUsers])).filter(Boolean).sort() as string[];
  }, [records, authorizedUsers]);

  const availableEmployees = useMemo(() => {
    const namesFromRecords = new Set(records.map(r => r.name));
    const namesFromUsers = new Set(authorizedUsers.map(u => u.fullName));
    return Array.from(new Set([...namesFromRecords, ...namesFromUsers])).filter(Boolean).sort() as string[];
  }, [records, authorizedUsers]);
  
  const availableBranches = useMemo(() => {
     const branchesFromRecords = new Set(records.map(r => r.branch));
     const branchesFromUsers = new Set(authorizedUsers.map(u => u.defaultBranch));
     return Array.from(new Set([...branchesFromRecords, ...branchesFromUsers])).filter(Boolean).sort() as string[];
  }, [records, authorizedUsers]);

  const filteredRecords = useMemo(() => records.filter(r => { 
    const rd = new Date(r.date); 
    rd.setHours(0,0,0,0); 
    let m = true; 
    if (fromDate) { const f = new Date(fromDate); f.setHours(0,0,0,0); m = m && rd >= f; } 
    if (toDate) { const t = new Date(toDate); t.setHours(0,0,0,0); m = m && rd <= t; } 
    if (selectedJobs.length > 0) m = m && selectedJobs.includes(r.job); 
    if (selectedEmployees.length > 0) m = m && selectedEmployees.includes(r.name);
    if (selectedBranches.length > 0) m = m && selectedBranches.includes(r.branch);
    return m; 
  }), [records, fromDate, toDate, selectedJobs, selectedEmployees, selectedBranches]);

  const toggleJobSelection = (val: string) => setSelectedJobs(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const toggleEmployeeSelection = (val: string) => setSelectedEmployees(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const toggleBranchSelection = (val: string) => setSelectedBranches(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/20">
              <FileSpreadsheet size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Reports Access</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase mt-1">نظام متابعة التقارير والوظائف</p>
          </div>
          <form onSubmit={(e) => {e.preventDefault(); fetchData();}} className="space-y-4">
            {showUrlField && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-white mr-2 uppercase tracking-widest flex items-center gap-1">
                  <LinkIcon size={12} /> رابط المزامنة (Sync URL)
                </label>
                <input 
                  type="text" 
                  placeholder="https://script.google.com/..." 
                  className="w-full bg-slate-900 border border-slate-700 text-white px-5 py-3.5 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all text-xs shadow-inner" 
                  value={localSyncUrl} 
                  onChange={e => setLocalSyncUrl(e.target.value)} 
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white mr-2 uppercase tracking-widest">اسم المستخدم</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 text-white px-5 py-3.5 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all shadow-inner" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white mr-2 uppercase tracking-widest">كلمة المرور</label>
              <input type="password" className="w-full bg-slate-900 border border-slate-700 text-white px-5 py-3.5 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all shadow-inner" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-[10px] font-bold flex gap-2 items-center">
                <AlertCircle size={16} /><span>{error}</span>
              </div>
            )}
            <button disabled={isLoading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              دخول واستعراض التقارير
            </button>
          </form>

          <button 
            type="button" 
            onClick={handleUnlink} 
            className="mt-6 w-full text-slate-500 hover:text-red-400 text-[10px] font-black py-2 border-t border-slate-700/50 pt-4 uppercase flex items-center justify-center gap-1.5 transition-colors"
          >
            <LinkIcon size={12} className="rotate-45" /> تغيير رابط الشركة / فك الارتباط
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
        <div className="text-right w-full md:w-auto"><h2 className="text-xl font-black text-blue-400 flex items-center gap-2">{isAdminLogin ? <ShieldCheck size={24} className="text-orange-400" /> : <Table size={24} />} متابعة التقارير والوظائف {isAdminLogin && <span className="text-[10px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-lg border border-orange-400/20 mr-2">Admin Mode</span>}</h2><p className="text-slate-500 text-[10px] font-black uppercase">المسؤول: {username}</p></div>
        <div className="flex flex-wrap gap-2 justify-center">
          <button type="button" onClick={() => fetchData(false)} disabled={isRefreshing} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-blue-400 border border-slate-700 rounded-xl text-[10px] font-black hover:bg-slate-700 transition-all"><RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> تحديث البيانات</button>
          <button type="button" onClick={() => setIsLoggedIn(false)} className="px-4 py-2 bg-slate-900/50 text-slate-400 border border-slate-700/50 rounded-xl text-[10px] font-black hover:text-red-400">خروج</button>
          <div className="flex gap-1">
            <button type="button" onClick={exportToExcel} className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-black text-[10px] shadow-xl transition-all border border-slate-600">
              <Download size={14} /> All Data
            </button>
            <button type="button" onClick={exportSummaryExcel} className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-[10px] shadow-xl transition-all">
              <FileSpreadsheet size={14} /> Summary Data
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-lg space-y-6">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest text-right"><Filter size={14} /> تصفية السجلات قبل التحميل</h3>
          <button 
            type="button" 
            onClick={handleUnlink} 
            className="text-slate-500 hover:text-red-400 text-[8px] font-black uppercase flex items-center gap-1 transition-colors"
          >
            <LinkIcon size={10} className="rotate-45" /> فك الارتباط
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CustomDatePicker label="من تاريخ" value={fromDate} onChange={setFromDate} placeholder="اختر البداية" />
          <CustomDatePicker label="إلى تاريخ" value={toDate} onChange={setToDate} placeholder="اختر النهاية" />
          
          <MultiSelect 
            label="تصفية بالوظائف" 
            options={availableJobs} 
            selected={selectedJobs} 
            onToggle={toggleJobSelection} 
            placeholder="الكل" 
            icon={Briefcase} 
          />
          
          <MultiSelect 
            label="تصفية بالموظفين" 
            options={availableEmployees} 
            selected={selectedEmployees} 
            onToggle={toggleEmployeeSelection} 
            placeholder="الكل" 
            icon={UserIcon} 
          />

          <MultiSelect 
            label="تصفية بالفروع" 
            options={availableBranches} 
            selected={selectedBranches} 
            onToggle={toggleBranchSelection} 
            placeholder="الكل" 
            icon={MapPin} 
          />

          <div className="flex items-end">
            <button type="button" onClick={() => { setFromDate(''); setToDate(''); setSelectedJobs([]); setSelectedEmployees([]); setSelectedBranches([]); }} className="w-full px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase transition-all flex justify-center items-center gap-2 border border-slate-700">
              <X size={14} /> مسح جميع الفلاتر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
