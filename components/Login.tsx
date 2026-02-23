
import React, { useState } from 'react';
import { User, AppConfig, Job, Branch } from '../types';
import { UserPlus, LogIn, ShieldAlert, Briefcase, Loader2, Link as LinkIcon, Smartphone, AlertCircle, WifiOff, MapPin } from 'lucide-react';
import { getDeviceFingerprint } from '../utils';

interface LoginProps {
  onLogin: (user: User) => void;
  allUsers: User[];
  adminConfig: AppConfig;
  availableJobs: Job[];
  branches: Branch[];
  setAdminConfig: (cfg: Partial<AppConfig>) => void;
}

export default function Login({ 
  onLogin, 
  allUsers, 
  adminConfig, 
  availableJobs, 
  branches, 
  setAdminConfig 
}: LoginProps) {
  const [mode, setMode] = useState<'register' | 'login' | 'admin' | 'connect'>(adminConfig.syncUrl ? 'login' : 'connect');
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [syncUrlInput, setSyncUrlInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncUrlInput.startsWith('http')) {
      setError('يرجى إدخل رابط صحيح يبدأ بـ https://');
      return;
    }
    setAdminConfig({ syncUrl: syncUrlInput, googleSheetLink: syncUrlInput });
    setMode('register');
    setError('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!navigator.onLine) {
      setError('عذراً، لا يمكن إتمام عملية التسجيل والجهاز غير متصل بالإنترنت.');
      return;
    }

    if (!fullName || !nationalId || !password || !selectedJob || !defaultBranch) {
      setError('يرجى إكمال جميع البيانات واختيار الوظيفة والفرع الأساسي');
      return;
    }
    
    if (nationalId.length !== 14) {
      setError('الرقم القومي يجب أن يكون 14 رقماً');
      return;
    }
    
    if (password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أرقام/حروف');
      return;
    }
    
    const deviceId = getDeviceFingerprint();

    const existingById = allUsers.find(u => u.nationalId === nationalId);
    if (existingById) {
      setError('عذراً، هذا الرقم القومي مسجل مسبقاً في النظام.');
      return;
    }

    // Check if device is already registered to another user (strictly)
    // Note: With multi-device support, a device ideally shouldn't be shared, but strictness can be relaxed if needed.
    // Here we keep it strict: One device = One User identity.
    const deviceOwner = allUsers.find(u => 
      u.deviceId === deviceId || (u.deviceIds && u.deviceIds.includes(deviceId))
    );
    if (deviceOwner) {
      setError(`عذراً، هذا الهاتف مرتبط بالفعل بحساب موظف آخر (${deviceOwner.fullName}).`);
      return;
    }

    setIsLoading(true);

    const branchObj = branches.find(b => b.id === defaultBranch);
    const branchNameForSheet = branchObj ? branchObj.name : defaultBranch;

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      fullName,
      nationalId,
      password,
      role: 'employee',
      deviceId: deviceId, // Legacy
      deviceIds: [deviceId], // New
      allowedDeviceCount: 1, // Default
      jobTitle: selectedJob,
      defaultBranchId: branchNameForSheet,
      registrationDate: new Date().toISOString()
    };

    if (adminConfig.googleSheetLink) {
      try {
        await fetch(adminConfig.googleSheetLink, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'registerUser',
            ...newUser,
            timestamp: newUser.registrationDate
          })
        });
      } catch (err) {
        console.error("Cloud registration failed", err);
      }
    }

    setIsLoading(false);
    onLogin(newUser);
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!navigator.onLine) {
      setError('عذراً، لا يمكن تسجيل الدخول والجهاز غير متصل بالإنترنت.');
      return;
    }
    
    if (allUsers.length === 0 && adminConfig.syncUrl) {
       setError('جاري جلب البيانات، يرجى الانتظار ثوانٍ...');
       return;
    }

    const user = allUsers.find(u => u.nationalId === nationalId && u.password === password);
    
    if (user) {
      const currentDeviceId = getDeviceFingerprint();
      
      // Check if this device belongs to someone else
      const otherDeviceOwner = allUsers.find(u => 
        u.id !== user.id && 
        ((u.deviceId === currentDeviceId) || (u.deviceIds && u.deviceIds.includes(currentDeviceId)))
      );
      
      if (otherDeviceOwner) {
        setError(`عذراً، هذا الهاتف مسجل باسم موظف آخر (${otherDeviceOwner.fullName}).`);
        return;
      }

      // Logic for Multi-Device Support
      const userDevices = user.deviceIds || (user.deviceId ? [user.deviceId] : []);
      const maxDevices = user.allowedDeviceCount || 1;

      if (userDevices.includes(currentDeviceId)) {
        // Device is already linked -> Allow Login
        onLogin(user);
      } else {
        // Device not linked, check if we can add it
        if (userDevices.length < maxDevices) {
          // Add new device
          const updatedDevices = [...userDevices, currentDeviceId];
          // FIX: Create new user object instead of mutating
          const updatedUser = { 
            ...user, 
            deviceIds: updatedDevices,
            deviceId: currentDeviceId
          };
          
          if (adminConfig.googleSheetLink) {
            try {
              setIsLoading(true);
              await fetch(adminConfig.googleSheetLink, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'updateUserDevice',
                  nationalId: updatedUser.nationalId,
                  deviceIds: updatedDevices // Send the full array
                })
              });
              setIsLoading(false);
            } catch (err) {
              console.error("Sync device update failed", err);
              setIsLoading(false);
            }
          }
          onLogin(updatedUser);
        } else {
          // Limit reached
          setError(`عذراً، لقد تجاوزت الحد المسموح من الأجهزة (${userDevices.length}/${maxDevices}). يرجى التواصل مع المسؤول.`);
        }
      }
    } else {
      setError('بيانات الدخول غير صحيحة، تأكد من الرقم القومي وكلمة المرور');
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === adminConfig.adminUsername && adminPassword === adminConfig.adminPassword) {
      onLogin({ id: 'admin-id', fullName: 'المسؤول', nationalId: '000', role: 'admin' });
    } else {
      setError('بيانات المسؤول غير صحيحة');
    }
  };

  const handleUnlink = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في فك الارتباط بالشركة الحالية؟')) {
      setAdminConfig({ syncUrl: '', googleSheetLink: '' });
      setMode('connect');
      setError('');
    }
  };

  const inputClasses = "w-full px-4 py-3.5 rounded-2xl border border-slate-600 bg-slate-900 text-white placeholder:text-slate-500 font-bold outline-none focus:border-blue-500 transition-all shadow-inner";

  return (
    <div className="min-h-full flex items-center justify-center p-0">
      <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700">
        <div className="bg-blue-600 p-8 text-white text-center">
          <h2 className="text-4xl font-black mb-1 italic tracking-tighter uppercase">Uniteam</h2>
          <p className="text-blue-100 text-[10px] font-bold tracking-widest uppercase">
            {mode === 'connect' ? 'Company Connection' : 'System Access'}
          </p>
        </div>

        <div className="p-8">
          {adminConfig.syncUrl ? (
            <div className="flex bg-slate-900/50 p-1 rounded-2xl mb-8 border border-slate-700">
              {['login', 'register', 'admin'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m as any); setError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${mode === m ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {m === 'login' ? 'دخول' : m === 'register' ? 'تسجيل جديد' : 'إدارة'}
                </button>
              ))}
            </div>
          ) : mode !== 'admin' && (
            <div className="mb-8 p-4 bg-orange-900/20 border-r-4 border-orange-500 rounded-xl text-right">
              <p className="text-orange-400 text-xs font-bold leading-relaxed">التطبيق غير مرتبط بشركة حالياً.</p>
            </div>
          )}

          {!navigator.onLine && (
            <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-400 text-[10px] font-black uppercase">
              <WifiOff size={16} /> الهاتف غير متصل بالإنترنت
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border-r-4 border-red-500 text-red-400 text-xs font-bold flex gap-2 items-start text-right">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          {isLoading && (
            <div className="mb-6 p-3 bg-blue-900/20 border border-blue-500/50 rounded-2xl flex items-center justify-center gap-2 text-blue-400 text-xs font-bold animate-pulse">
              <Loader2 className="animate-spin" size={16} /> جاري المعالجة والتحقق...
            </div>
          )}

          {mode === 'connect' && (
            <form onSubmit={handleConnect} className="space-y-4">
              <input type="text" placeholder="https://script.google.com/..." value={syncUrlInput} onChange={e => setSyncUrlInput(e.target.value)} className={inputClasses} />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all">
                <LinkIcon size={20} /> ربط التطبيق بالشركة
              </button>
              <button type="button" onClick={() => setMode('admin')} className="w-full text-slate-500 text-[10px] font-black py-2">أنا مسؤول النظام</button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <input type="text" placeholder="الاسم الرباعي" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClasses} />
              <input type="text" placeholder="الرقم القومي (14 رقم)" maxLength={14} value={nationalId} onChange={e => setNationalId(e.target.value.replace(/\D/g, ''))} className={inputClasses} />
              
              <div className="relative">
                <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)} className={`${inputClasses} appearance-none cursor-pointer text-right`}>
                  <option value="" className="bg-slate-900">-- اختر الوظيفة --</option>
                  {availableJobs.map(job => <option key={job.id} value={job.title} className="bg-slate-900">{job.title}</option>)}
                </select>
                <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select value={defaultBranch} onChange={e => setDefaultBranch(e.target.value)} className={`${inputClasses} appearance-none cursor-pointer text-right`}>
                  <option value="" className="bg-slate-900">-- اختر فرع العمل الأساسي --</option>
                  {branches.map(b => <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>)}
                </select>
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>

              <input type="password" placeholder="تعيين كلمة مرور" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} />
              
              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />} 
                {isLoading ? 'جاري الحفظ...' : 'تسجيل وتأمين الهاتف'}
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <input type="text" placeholder="الرقم القومي" maxLength={14} value={nationalId} onChange={e => setNationalId(e.target.value.replace(/\D/g, ''))} className={inputClasses} />
              <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} />
              <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all text-sm">
                <LogIn size={20} /> دخول الموظف
              </button>
            </form>
          )}

          {mode === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <input type="text" placeholder="اسم مستخدم المسؤول" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className={inputClasses} />
              <input type="password" placeholder="كلمة مرور المسؤول" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className={inputClasses} />
              <button type="submit" className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all border border-slate-500">
                <ShieldAlert size={20} /> دخول لوحة التحكم
              </button>
              <button type="button" onClick={() => setMode(adminConfig.syncUrl ? 'login' : 'connect')} className="w-full text-slate-500 text-[10px] font-black py-2">العودة</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

