
import React, { useState, useRef, useEffect } from 'react';
import { Branch, AttendanceRecord, AppConfig, User, Job, ReportAccount } from '../types';
import { MapPin, Table, Trash2, Shield, CloudUpload, Briefcase, RotateCcw, Globe, Users, Plus, FileSpreadsheet, Download, Share2, Smartphone, RefreshCw, Edit2, Check, X, Unlink, Key, Lock, Eye, EyeOff, Clock, Monitor, UserCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  records: AttendanceRecord[];
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  allUsers: User[];
  setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
  reportAccounts?: ReportAccount[];
  setReportAccounts?: React.Dispatch<React.SetStateAction<ReportAccount[]>>;
  onRefresh: () => void;
  isSyncing: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  branches, setBranches, jobs, setJobs, records, config, setConfig, allUsers, setAllUsers, 
  reportAccounts = [], setReportAccounts, onRefresh, isSyncing
}) => {
  const [activeTab, setActiveTab] = useState<'branches' | 'jobs' | 'users' | 'report-access' | 'settings'>('branches');
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({ name: '', latitude: 0, longitude: 0, radius: 100 });
  const [newJobTitle, setNewJobTitle] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserData, setEditUserData] = useState<Partial<User>>({});

  const [newRepUser, setNewRepUser] = useState('');
  const [newRepPass, setNewRepPass] = useState('');
  const [selectedJobsForAcc, setSelectedJobsForAcc] = useState<string[]>([]);
  const [selectedUsersForAcc, setSelectedUsersForAcc] = useState<string[]>([]); // New state for selected employees
  
  const [showPass, setShowPass] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editReportData, setEditReportData] = useState<Partial<ReportAccount>>({});
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editBranchData, setEditBranchData] = useState<Partial<Branch>>({});
  const [adminUser, setAdminUser] = useState(config.adminUsername);
  const [adminPass, setAdminPass] = useState(config.adminPassword || '');
  const [syncUrl, setSyncUrl] = useState(config.syncUrl || '');
  
  // State for Branch Bulk Delete
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobFileInputRef = useRef<HTMLInputElement>(null);
  const userFileInputRef = useRef<HTMLInputElement>(null);

  // وظيفة لتنسيق الوقت للعرض (AM/PM)
  const formatTimeDisplay = (timeStr: string | undefined) => {
    if (!timeStr) return '--:--';
    if (timeStr.includes('GMT') || timeStr.includes('1899')) {
      try {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      } catch(e) {}
    }
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      const [h, m] = timeStr.split(':').map(Number);
      const suffix = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${suffix}`;
    }
    return timeStr;
  };

  const normalizeToTimeInput = (timeStr: string | undefined): string => {
    if (!timeStr) return "09:00";
    if (timeStr.includes('GMT') || timeStr.includes('1899')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      }
    }
    const match = timeStr.match(/(\d{2}:\d{2})/);
    return match ? match[1] : timeStr;
  };

  const pushToCloud = async () => {
    if (!config.syncUrl) return alert("يرجى ضبط رابط المزامنة أولاً");
    setIsPushing(true);
    try {
      await fetch(config.syncUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateSystem',
          branches: branches,
          jobs: jobs,
          users: allUsers,
          reportAccounts: reportAccounts,
          adminUsername: config.adminUsername,
          adminPassword: config.adminPassword
        })
      });
      alert("تم إرسال البيانات للسحابة بنجاح!");
    } catch (err) { alert("حدث خطأ أثناء الاتصال بالسحابة"); }
    finally { setIsPushing(false); }
  };

  const saveEditUser = (id: string) => {
    setAllUsers(prev => prev.map(u => u.id === id ? { ...u, ...editUserData } as User : u));
    setEditingUserId(null);
  };

  const inputClasses = "px-4 py-3 rounded-xl border border-slate-600 bg-slate-900 text-white font-bold outline-none focus:border-blue-500 w-full transition-all";

  const shareInviteLink = async () => {
    const link = window.location.origin + window.location.pathname + (config.syncUrl ? `?c=${btoa(config.syncUrl)}` : '');
    if (navigator.share) { try { await navigator.share({ title: 'نظام الحضور - Uniteam', text: 'رابط تسجيل الموظفين:', url: link }); } catch (err) {} }
    else { navigator.clipboard.writeText(link).then(() => alert("تم نسخ الرابط!")); }
  };

  const downloadTemplate = (type: 'branches' | 'jobs' | 'users') => {
    let data: any[] = [];
    let fileName = "";
    
    if (type === 'branches') {
      data = [{ "اسم الفرع": "الفرع الرئيسي", "خط العرض": 30.05, "خط الطول": 31.23, "النطاق بالمتر": 100 }];
      fileName = "template_branches.xlsx";
    } else if (type === 'jobs') {
      data = [{ "اسم الوظيفة": "مهندس" }];
      fileName = "template_jobs.xlsx";
    } else if (type === 'users') {
      data = [{
        "الاسم بالكامل": "محمد احمد",
        "الرقم القومي": "29010101234567",
        "كلمة المرور": "123456",
        "الوظيفة": "مهندس",
        "الفرع الافتراضي": "الفرع الرئيسي",
        "موعد الحضور": "09:00",
        "موعد الانصراف": "17:00",
        "عدد الاجهزة": 1
      }];
      fileName = "template_users.xlsx";
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, fileName);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'branches' | 'jobs' | 'users') => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        if (type === 'branches') { 
          setBranches(prev => [...prev, ...data.map((item: any) => ({ id: Math.random().toString(36).substr(2, 9), name: item["اسم الفرع"] || 'فرع جديد', latitude: parseFloat(item["خط العرض"] || 0), longitude: parseFloat(item["خط الطول"] || 0), radius: parseInt(item["النطاق بالمتر"] || 100) }))]); 
        } else if (type === 'jobs') { 
          setJobs(prev => [...prev, ...data.map((item: any) => ({ id: Math.random().toString(36).substr(2, 9), title: item["اسم الوظيفة"] || 'موظف' }))]); 
        } else if (type === 'users') {
          const existingNids = new Set(allUsers.map(u => u.nationalId));
          let duplicateCount = 0;

          const newUsers = data.map((item: any) => {
             const nid = (item["الرقم القومي"] || "").toString();
             if (existingNids.has(nid)) {
               duplicateCount++;
               return null;
             }
             existingNids.add(nid);

             const newUser: User = {
              id: Math.random().toString(36).substr(2, 9),
              fullName: item["الاسم بالكامل"] || "موظف جديد",
              nationalId: nid,
              password: (item["كلمة المرور"] || "123456").toString(),
              jobTitle: item["الوظيفة"] || "موظف",
              defaultBranchId: item["الفرع الافتراضي"] || "",
              role: 'employee',
              deviceId: "",
              deviceIds: [],
              allowedDeviceCount: parseInt(item["عدد الاجهزة"] || "1"),
              checkInTime: item["موعد الحضور"] || "09:00",
              checkOutTime: item["موعد الانصراف"] || "17:00",
              registrationDate: new Date().toISOString()
            };
            return newUser;
          }).filter((u) => u !== null) as User[];

          if (newUsers.length > 0) {
            setAllUsers(prev => [...prev, ...newUsers]);
            let msg = `تم استيراد ${newUsers.length} موظف بنجاح.`;
            if (duplicateCount > 0) msg += ` تم تجاهل ${duplicateCount} موظف لوجودهم مسبقاً.`;
            msg += " يرجى النقر على 'حفظ في السحابة' لتأكيد التغييرات.";
            alert(msg);
          } else {
            alert("لم يتم استيراد أي موظف. جميع البيانات موجودة مسبقاً أو الملف فارغ.");
          }
        } else {
           alert("تم استيراد البيانات بنجاح! يرجى النقر على 'حفظ في السحابة' لتأكيد التغييرات.");
        }
      } catch (err) { alert("خطأ في قراءة ملف الإكسل. تأكد من صحة البيانات."); }
      if(e.target) e.target.value = '';
    }; reader.readAsBinaryString(file);
  };

  const saveEditBranch = (id: string) => { setBranches(prev => prev.map(b => b.id === id ? { ...b, ...editBranchData } as Branch : b)); setEditingBranchId(null); };

  const addReportAccount = () => {
    if (!newRepUser || !newRepPass || (selectedJobsForAcc.length === 0 && selectedUsersForAcc.length === 0)) return alert("يرجى ملء كافة البيانات واختيار وظيفة أو موظف واحد على الأقل");
    const newAcc: ReportAccount = { 
      id: Math.random().toString(36).substr(2, 9), 
      username: newRepUser, 
      password: newRepPass, 
      allowedJobs: selectedJobsForAcc,
      allowedEmployees: selectedUsersForAcc 
    };
    setReportAccounts?.([...reportAccounts, newAcc]); 
    setNewRepUser(''); setNewRepPass(''); setSelectedJobsForAcc([]); setSelectedUsersForAcc([]);
  };

  const saveEditReportAcc = (id: string) => {
    if (!editReportData.username || !editReportData.password) { alert("يرجى التأكد من اسم المستخدم وكلمة المرور"); return; }
    // Ensure arrays are initialized if they were undefined in the edit state
    const updatedAcc = {
      ...editReportData,
      allowedJobs: editReportData.allowedJobs || [],
      allowedEmployees: editReportData.allowedEmployees || []
    };
    setReportAccounts?.(prev => prev.map(acc => acc.id === id ? { ...acc, ...updatedAcc } as ReportAccount : acc)); setEditingReportId(null);
  };

  // Branch Bulk Actions
  const toggleSelectBranch = (id: string) => {
    const newSelected = new Set(selectedBranches);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedBranches(newSelected);
  };

  const toggleSelectAllBranches = () => {
    if (selectedBranches.size === branches.length) setSelectedBranches(new Set());
    else setSelectedBranches(new Set(branches.map(b => b.id)));
  };

  const deleteSelectedBranches = () => {
    if (window.confirm(`هل أنت متأكد من حذف ${selectedBranches.size} فرع؟`)) {
      setBranches(branches.filter(b => !selectedBranches.has(b.id)));
      setSelectedBranches(new Set());
    }
  };

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'branches')} />
      <input type="file" ref={jobFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'jobs')} />
      <input type="file" ref={userFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'users')} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
        <div className="text-white">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-blue-400 flex items-center gap-2">
            <Shield size={24} /> Uniteam Admin
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase">لوحة إدارة السحابة</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <button onClick={onRefresh} disabled={isSyncing} className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black bg-slate-900 text-blue-400 border border-blue-900/30 text-xs hover:bg-slate-800 transition-all">
             <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> تحديث البيانات
           </button>
           <button onClick={shareInviteLink} className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black bg-blue-600 hover:bg-blue-500 text-white text-xs shadow-xl transition-all">
             <Share2 size={16} /> مشاركة الرابط
           </button>
           <button onClick={pushToCloud} disabled={isPushing} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black bg-orange-600 hover:bg-orange-500 text-white shadow-xl text-xs transition-all">
             {isPushing ? <RotateCcw size={16} className="animate-spin" /> : <CloudUpload size={16} />} حفظ في السحابة
           </button>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'branches', label: 'الفروع', icon: MapPin },
          { id: 'jobs', label: 'الوظائف', icon: Briefcase },
          { id: 'users', label: 'الموظفين', icon: Users },
          { id: 'report-access', label: 'صلاحيات التقارير', icon: Key },
          { id: 'settings', label: 'الإعدادات', icon: Shield }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all border shrink-0 ${
              activeTab === tab.id ? 'bg-blue-600 text-white border-blue-500 shadow-xl' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden p-6 text-white min-h-[400px]">
        {activeTab === 'users' && (
           <div className="space-y-6">
             <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
               <div className="flex items-center gap-3">
                 <Users size={20} className="text-blue-400" />
                 <h3 className="text-sm font-black text-white uppercase tracking-tighter">سجل الموظفين</h3>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => downloadTemplate('users')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-[10px] font-black"><Download size={14}/> نموذج استيراد</button>
                  <button onClick={() => userFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-[10px] font-black"><FileSpreadsheet size={14}/> استيراد موظفين</button>
                  <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-900/30 rounded-xl text-[10px] font-black"><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> تحديث</button>
               </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-right min-w-[1000px]">
                 <thead>
                    <tr className="border-b border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                      <th className="py-4 px-2 text-right">الموظف والوظيفة</th>
                      <th className="py-4 px-2">الرقم القومي</th>
                      <th className="py-4 px-2">الفرع الافتراضي</th>
                      <th className="py-4 px-2">الحضور (Default)</th>
                      <th className="py-4 px-2">الانصراف (Default)</th>
                      <th className="py-4 px-2">الأجهزة المرتبطة</th>
                      <th className="py-4 px-2">إجراءات</th>
                    </tr>
                 </thead>
                 <tbody>
                  {allUsers.map(user => {
                   // Calculate device count properly considering both legacy and new array
                   const deviceCount = user.deviceIds ? user.deviceIds.length : (user.deviceId ? 1 : 0);
                   const allowedCount = user.allowedDeviceCount || 1;

                   return (
                   <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-900/30 transition-all text-center">
                     <td className="py-4 px-2 text-right">
                        {editingUserId === user.id ? (
                          <div className="space-y-1">
                            <input className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-full text-white" value={editUserData.fullName || ''} onChange={e => setEditUserData({...editUserData, fullName: e.target.value})} />
                            <select className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-[10px] w-full text-white" value={editUserData.jobTitle || ''} onChange={e => setEditUserData({...editUserData, jobTitle: e.target.value})}>
                              {jobs.map(j => <option key={j.id} value={j.title}>{j.title}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-white">{user.fullName}</span>
                            <span className="text-blue-400 text-[10px] font-black uppercase">{user.jobTitle}</span>
                          </div>
                        )}
                     </td>
                     <td className="py-4 px-2 text-slate-400 text-xs font-mono">
                        {editingUserId === user.id ? (
                          <input className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-full text-center text-white" value={editUserData.nationalId || ''} onChange={e => setEditUserData({...editUserData, nationalId: e.target.value})} />
                        ) : user.nationalId}
                     </td>
                     <td className="py-4 px-2">
                        {editingUserId === user.id ? (
                          <select className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-[10px] w-full text-white" value={editUserData.defaultBranchId || ''} onChange={e => setEditUserData({...editUserData, defaultBranchId: e.target.value})}>
                            {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-300 font-bold">{user.defaultBranchId || 'غير محدد'}</span>
                        )}
                     </td>
                     <td className="py-4 px-2">
                        {editingUserId === user.id ? (
                          <input type="time" className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-full text-center text-white" value={editUserData.checkInTime || ''} onChange={e => setEditUserData({...editUserData, checkInTime: e.target.value})} />
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-green-400 font-bold text-xs"><Clock size={12}/> {formatTimeDisplay(user.checkInTime || '09:00')}</div>
                        )}
                     </td>
                     <td className="py-4 px-2">
                        {editingUserId === user.id ? (
                          <input type="time" className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-full text-center text-white" value={editUserData.checkOutTime || ''} onChange={e => setEditUserData({...editUserData, checkOutTime: e.target.value})} />
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-orange-400 font-bold text-xs"><Clock size={12}/> {formatTimeDisplay(user.checkOutTime || '17:00')}</div>
                        )}
                     </td>
                     <td className="py-4 px-2">
                        {editingUserId === user.id ? (
                           <div className="flex items-center gap-1 justify-center">
                             <span className="text-[10px] text-slate-500">الحد:</span>
                             <input type="number" min="1" max="10" className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-12 text-center text-white" value={editUserData.allowedDeviceCount || 1} onChange={e => setEditUserData({...editUserData, allowedDeviceCount: parseInt(e.target.value) || 1})} />
                           </div>
                        ) : (
                           <div className={`flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[9px] font-black border mx-auto w-fit ${deviceCount > 0 ? 'bg-green-600/10 text-green-400 border-green-900/30' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
                             <Smartphone size={10} /> {deviceCount} / {allowedCount}
                           </div>
                        )}
                     </td>
                     <td className="py-4 px-2">
                        <div className="flex justify-center gap-2">
                           {editingUserId === user.id ? (
                             <>
                               <button onClick={() => saveEditUser(user.id)} className="text-green-500 hover:bg-green-900/20 p-1.5 rounded"><Check size={18}/></button>
                               <button onClick={() => setEditingUserId(null)} className="text-red-500 hover:bg-red-900/20 p-1.5 rounded"><X size={18}/></button>
                             </>
                           ) : (
                             <>
                               <button onClick={() => { 
                                 setEditingUserId(user.id); 
                                 setEditUserData({
                                   ...user,
                                   checkInTime: normalizeToTimeInput(user.checkInTime),
                                   checkOutTime: normalizeToTimeInput(user.checkOutTime),
                                   allowedDeviceCount: user.allowedDeviceCount || 1
                                 }); 
                               }} className="text-blue-400 hover:bg-blue-900/20 p-1.5 rounded"><Edit2 size={16}/></button>
                               
                               {deviceCount > 0 && (
                                 <button onClick={() => {
                                   if(confirm('هل أنت متأكد من فك ارتباط جميع الأجهزة لهذا الموظف؟')) {
                                     setAllUsers(allUsers.map(u => u.id === user.id ? {...u, deviceId: "", deviceIds: []} : u));
                                   }
                                 }} className="text-orange-400 hover:bg-orange-900/20 p-1.5 rounded" title="فك ارتباط جميع الأجهزة"><Unlink size={16}/></button>
                               )}
                               
                               <button onClick={() => { if(confirm('حذف الموظف؟')) setAllUsers(allUsers.filter(u => u.id !== user.id)) }} className="text-slate-500 hover:text-red-400 p-1.5"><Trash2 size={16}/></button>
                             </>
                           )}
                        </div>
                     </td>
                   </tr>
                  );
                  })}</tbody>
               </table>
             </div>
           </div>
        )}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
               <h4 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">الفروع الحالية</h4>
               <div className="flex gap-2">
                  {selectedBranches.size > 0 && (
                     <button onClick={deleteSelectedBranches} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black animate-pulse">
                        <Trash2 size={14}/> حذف المحدد ({selectedBranches.size})
                     </button>
                  )}
                  <button onClick={() => downloadTemplate('branches')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-[10px] font-black"><Download size={14}/> نموذج</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-[10px] font-black"><FileSpreadsheet size={14}/> استيراد</button>
               </div>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 grid grid-cols-1 md:grid-cols-5 gap-4">
               <input type="text" placeholder="الاسم" className={inputClasses} value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} />
               <input type="number" placeholder="Lat" className={inputClasses} value={newBranch.latitude || ''} onChange={e => setNewBranch({...newBranch, latitude: parseFloat(e.target.value)})} />
               <input type="number" placeholder="Lng" className={inputClasses} value={newBranch.longitude || ''} onChange={e => setNewBranch({...newBranch, longitude: parseFloat(e.target.value)})} />
               <input type="number" placeholder="المسافة" className={inputClasses} value={newBranch.radius || ''} onChange={e => setNewBranch({...newBranch, radius: parseInt(e.target.value)})} />
               <button onClick={() => {
                 if (newBranch.name) {
                   setBranches([...branches, { ...newBranch, id: Math.random().toString(36).substr(2, 9), radius: newBranch.radius || 100 } as Branch]);
                   setNewBranch({ name: '', latitude: 0, longitude: 0, radius: 100 });
                 }
               }} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black py-3 flex items-center justify-center gap-2 transition-all">
                 <Plus size={18}/> إضافة
               </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right min-w-[700px]">
                <thead><tr className="border-b border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-4 px-2 w-10 text-center"><input type="checkbox" checked={selectedBranches.size === branches.length && branches.length > 0} onChange={toggleSelectAllBranches} className="accent-blue-600 cursor-pointer" /></th>
                  <th className="py-4 px-2">اسم الفرع</th><th className="py-4 px-2">إحداثيات (Lat, Lng)</th><th className="py-4 px-2 text-center">النطاق</th><th className="py-4 px-2 text-center">إجراءات</th></tr></thead>
                <tbody>{branches.map(b => (
                  <tr key={b.id} className="border-b border-slate-700/50 hover:bg-slate-900/30 transition-colors">
                    <td className="py-4 px-2 text-center"><input type="checkbox" checked={selectedBranches.has(b.id)} onChange={() => toggleSelectBranch(b.id)} className="accent-blue-600 cursor-pointer" /></td>
                    <td className="py-4 px-2 font-black">{editingBranchId === b.id ? (<input className="bg-slate-900 border border-blue-500 rounded px-3 py-1.5 text-xs w-full outline-none text-white" value={editBranchData.name || ''} onChange={e => setEditBranchData({...editBranchData, name: e.target.value})} />) : (<span className="text-emerald-400">{b.name}</span>)}</td>
                    <td className="py-4 px-2">{editingBranchId === b.id ? (<div className="flex gap-1"><input type="number" step="0.000001" className="bg-slate-900 border border-blue-500 rounded px-2 py-1.5 text-[10px] w-full font-mono outline-none text-white" placeholder="Lat" value={editBranchData.latitude || ''} onChange={e => setEditBranchData({...editBranchData, latitude: parseFloat(e.target.value)})} /><input type="number" step="0.000001" className="bg-slate-900 border border-blue-500 rounded px-2 py-1.5 text-[10px] w-full font-mono outline-none text-white" placeholder="Lng" value={editBranchData.longitude || ''} onChange={e => setEditBranchData({...editBranchData, longitude: parseFloat(e.target.value)})} /></div>) : (<span className="text-[10px] text-slate-400 font-mono">{b.latitude.toFixed(6)}, {b.longitude.toFixed(6)}</span>)}</td>
                    <td className="py-4 px-2 text-center">{editingBranchId === b.id ? (<input type="number" className="bg-slate-900 border border-blue-500 rounded px-2 py-1.5 text-xs w-20 text-center outline-none text-white" value={editBranchData.radius || ''} onChange={e => setEditBranchData({...editBranchData, radius: parseInt(e.target.value)})} />) : (<span className="text-blue-400 font-black text-xs">{b.radius}م</span>)}</td>
                    <td className="py-4 px-2 text-center"><div className="flex justify-center gap-2">{editingBranchId === b.id ? (<><button onClick={() => saveEditBranch(b.id)} className="text-green-500 hover:bg-green-500/10 p-2 rounded-lg transition-all"><Check size={18}/></button><button onClick={() => setEditingBranchId(null)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all"><X size={18}/></button></>) : (<><button onClick={() => { setEditingBranchId(b.id); setEditBranchData(b); }} className="text-blue-400 hover:bg-blue-400/10 p-2 rounded-lg transition-all"><Edit2 size={16}/></button><button onClick={() => setBranches(branches.filter(x => x.id !== b.id))} className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-all"><Trash2 size={16}/></button></>)}</div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
               <h4 className="text-sm font-black text-blue-400 uppercase tracking-widest">الوظائف المتاحة</h4>
               <div className="flex gap-2">
                  <button onClick={() => downloadTemplate('jobs')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-[10px] font-black"><Download size={14}/> نموذج</button>
                  <button onClick={() => jobFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-[10px] font-black"><FileSpreadsheet size={14}/> استيراد</button>
               </div>
            </div>
            <div className="flex gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-700">
               <input type="text" placeholder="عنوان الوظيفة" className={inputClasses} value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} />
               <button onClick={() => { if(newJobTitle.trim()) { setJobs([...jobs, { id: Math.random().toString(36).substr(2, 9), title: newJobTitle }]); setNewJobTitle(''); } }} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 font-black flex items-center gap-2 transition-all"><Plus size={20}/> إضافة</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {jobs.map(j => (
                 <div key={j.id} className="p-4 bg-slate-900 rounded-2xl border border-slate-700 flex justify-between items-center hover:border-blue-500 transition-all">
                   <span className="text-xs font-bold">{j.title}</span>
                   <button onClick={() => setJobs(jobs.filter(x => x.id !== j.id))} className="text-slate-600 hover:text-red-500"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
          </div>
        )}
        {activeTab === 'report-access' && (
          <div className="space-y-6">
            <h4 className="text-sm font-black text-blue-400 flex items-center gap-2 uppercase tracking-widest"><Key size={20}/> حسابات متابعي التقارير</h4>
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input type="text" placeholder="اسم المستخدم" className={inputClasses} value={newRepUser} onChange={e => setNewRepUser(e.target.value)} /><input type="password" placeholder="كلمة المرور" className={inputClasses} value={newRepPass} onChange={e => setNewRepPass(e.target.value)} /></div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 mr-2 uppercase flex items-center gap-1"><Briefcase size={12}/> الوظائف المسموح بمتابعتها</label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-900 border border-slate-700 rounded-xl h-24 overflow-y-auto scrollbar-hide">
                  {jobs.map(j => (
                    <button key={j.id} onClick={() => { if (selectedJobsForAcc.includes(j.title)) { setSelectedJobsForAcc(selectedJobsForAcc.filter(t => t !== j.title)); } else { setSelectedJobsForAcc([...selectedJobsForAcc, j.title]); } }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${selectedJobsForAcc.includes(j.title) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}>
                      {j.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 mr-2 uppercase flex items-center gap-1"><UserCheck size={12}/> الموظفين المسموح بمتابعتهم (تحديد خاص)</label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-900 border border-slate-700 rounded-xl h-24 overflow-y-auto scrollbar-hide">
                  {allUsers.filter(u => u.role !== 'admin').map(u => (
                    <button key={u.id} onClick={() => { if (selectedUsersForAcc.includes(u.fullName)) { setSelectedUsersForAcc(selectedUsersForAcc.filter(t => t !== u.fullName)); } else { setSelectedUsersForAcc([...selectedUsersForAcc, u.fullName]); } }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${selectedUsersForAcc.includes(u.fullName) ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}>
                      {u.fullName}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={addReportAccount} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"><Plus size={20} /> إنشاء الحساب</button>
            </div>
            <div className="overflow-x-auto mt-6"><table className="w-full text-right"><thead><tr className="border-b border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest"><th className="py-4 px-2">اسم المستخدم</th><th className="py-4 px-2">كلمة المرور</th><th className="py-4 px-2">الوظائف المسموح بها</th><th className="py-4 px-2">الموظفين المسموح بهم</th><th className="py-4 px-2 text-center">إجراءات</th></tr></thead><tbody>{reportAccounts.map(acc => (<tr key={acc.id} className="border-b border-slate-700/50 hover:bg-slate-900/30 transition-all"><td className="py-4 px-2 font-bold text-sm text-white">{editingReportId === acc.id ? (<input className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-full text-white" value={editReportData.username || ''} onChange={e => setEditReportData({...editReportData, username: e.target.value})} />) : acc.username}</td><td className="py-4 px-2 font-mono text-xs text-slate-400">{editingReportId === acc.id ? (<input type="text" className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs w-full text-white" value={editReportData.password || ''} onChange={e => setEditReportData({...editReportData, password: e.target.value})} />) : (<div className="flex items-center gap-2">{showPass === acc.id ? acc.password : '••••••••'}<button onClick={() => setShowPass(showPass === acc.id ? null : acc.id)} className="text-slate-600 hover:text-blue-400">{showPass === acc.id ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div>)}</td><td className="py-4 px-2">{editingReportId === acc.id ? (<div className="flex flex-wrap gap-1 max-w-[200px]">{jobs.map(j => (<button key={j.id} onClick={() => { const current = editReportData.allowedJobs || []; if (current.includes(j.title)) { setEditReportData({...editReportData, allowedJobs: current.filter(t => t !== j.title)}); } else { setEditReportData({...editReportData, allowedJobs: [...current, j.title]}); } }} className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${editReportData.allowedJobs?.includes(j.title) ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{j.title}</button>))}</div>) : (<div className="flex flex-wrap gap-1">{acc.allowedJobs.map((j, i) => <span key={i} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-[9px] font-black rounded border border-blue-800/30">{j}</span>)}</div>)}</td><td className="py-4 px-2">{editingReportId === acc.id ? (<div className="flex flex-wrap gap-1 max-w-[200px] max-h-32 overflow-y-auto">{allUsers.filter(u => u.role !== 'admin').map(u => (<button key={u.id} onClick={() => { const current = editReportData.allowedEmployees || []; if (current.includes(u.fullName)) { setEditReportData({...editReportData, allowedEmployees: current.filter(t => t !== u.fullName)}); } else { setEditReportData({...editReportData, allowedEmployees: [...current, u.fullName]}); } }} className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${editReportData.allowedEmployees?.includes(u.fullName) ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{u.fullName}</button>))}</div>) : (<div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">{acc.allowedEmployees && acc.allowedEmployees.length > 0 ? acc.allowedEmployees.map((e, i) => <span key={i} className="px-2 py-0.5 bg-green-900/30 text-green-400 text-[9px] font-black rounded border border-green-800/30">{e}</span>) : <span className="text-[9px] text-slate-600">الكل (حسب الوظيفة)</span>}</div>)}</td><td className="py-4 px-2 text-center"><div className="flex justify-center gap-2">{editingReportId === acc.id ? (<><button onClick={() => saveEditReportAcc(acc.id)} className="text-green-500"><Check size={18}/></button><button onClick={() => setEditingReportId(null)} className="text-red-500"><X size={18}/></button></>) : (<><button onClick={() => { setEditingReportId(acc.id); setEditReportData(acc); }} className="text-blue-400 hover:bg-blue-900/20 p-1.5 rounded"><Edit2 size={16}/></button><button onClick={() => setReportAccounts?.(reportAccounts.filter(x => x.id !== acc.id))} className="text-slate-500 hover:text-red-400 p-1.5"><Trash2 size={16}/></button></>)}</div></td></tr>))}</tbody></table></div>
          </div>
        )}
        {activeTab === 'settings' && (
           <div className="space-y-10 max-w-2xl mx-auto py-4"><div className="space-y-4"><h4 className="text-sm font-black text-orange-400 flex items-center gap-2 tracking-widest uppercase"><Globe size={20}/> الربط السحابي</h4><div className="p-8 bg-slate-900 rounded-3xl border border-slate-700 space-y-6 shadow-inner"><div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase">رابط الـ Web App (Apps Script)</label><input type="text" className={inputClasses} value={syncUrl} onChange={e => setSyncUrl(e.target.value)} placeholder="https://script.google.com/..." /></div></div></div><button onClick={() => { const newConfig = { ...config, adminUsername: adminUser, adminPassword: adminPass, syncUrl: syncUrl, googleSheetLink: syncUrl }; setConfig(newConfig); localStorage.setItem('attendance_config', JSON.stringify(newConfig)); alert("تم حفظ الإعدادات!"); }} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all">حفظ التغييرات</button></div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
