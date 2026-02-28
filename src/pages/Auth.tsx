import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Eye, EyeOff, Mail, Lock, User, Package, Cpu, AlertTriangle, DollarSign, ArrowRight, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';

export const Auth = () => {
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });

  useEffect(() => {
    if (user && !loading) navigate('/dashboard');
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await signIn(signInData.email, signInData.password);
      if (error) {
        toast({ title: 'שגיאה בהתחברות', description: error.message === 'Invalid login credentials' ? 'פרטי ההתחברות שגויים' : 'אירעה שגיאה בעת ההתחברות', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'שגיאה', description: 'אירעה שגיאה בלתי צפויה', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpData.password !== signUpData.confirmPassword) { toast({ title: 'שגיאה', description: 'הסיסמאות אינן תואמות', variant: 'destructive' }); return; }
    if (signUpData.password.length < 6) { toast({ title: 'שגיאה', description: 'הסיסמה חייבת להכיל לפחות 6 תווים', variant: 'destructive' }); return; }
    setIsLoading(true);
    try {
      const { error } = await signUp(signUpData.email, signUpData.password, signUpData.firstName, signUpData.lastName);
      if (error) {
        toast({ title: 'שגיאה בהרשמה', description: error.message.includes('already registered') ? 'משתמש עם כתובת אימייל זו כבר קיים' : 'אירעה שגיאה בעת ההרשמה', variant: 'destructive' });
      } else {
        toast({ title: 'הרשמה בוצעה בהצלחה!', description: 'בדוק את תיבת המייל שלך לאישור החשבון' });
      }
    } catch {
      toast({ title: 'שגיאה', description: 'אירעה שגיאה בלתי צפויה', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const openAuth = (tab: 'signin' | 'signup') => { setActiveTab(tab); setIsAuthOpen(true); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#14B8A6' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC' }}>
      {/* ─── NAVBAR ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 lg:px-10"
        style={{ height: '64px', background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(15,23,42,0.06)' }}
      >
        <div />
        <div className="flex items-center gap-5" dir="rtl">
          <button onClick={() => openAuth('signin')} className="text-sm font-medium transition-colors" style={{ color: '#475569' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#0F172A')} onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}>התחברות</button>
          <button onClick={() => openAuth('signup')} className="text-sm font-medium px-4 py-2 rounded-lg transition-all" style={{ background: '#14B8A6', color: '#FFFFFF' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#0D9488')} onMouseLeave={(e) => (e.currentTarget.style.background = '#14B8A6')}>הרשמה</button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <main className="flex-1 flex items-center" style={{ paddingTop: '64px' }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 w-full flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20 py-16 lg:py-0">
          {/* LEFT: Dashboard Preview */}
          <div className="w-full lg:w-[55%]" dir="ltr">
            <div
              className="w-full rounded-2xl p-5 lg:p-7"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 8px 30px rgba(15,23,42,0.06)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>Dashboard</p>
                  <p className="text-base font-semibold mt-0.5" style={{ color: '#0F172A' }}>Operations Center</p>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#E2E8F0' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#E2E8F0' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#14B8A6' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <MockStat icon={Package} label="Stock Health" value="94%" color="#14B8A6" bg="rgba(20,184,166,0.08)" />
                <MockStat icon={Cpu} label="AI Procurement" value="Active" color="#8B5CF6" bg="rgba(139,92,246,0.08)" />
                <MockStat icon={AlertTriangle} label="Alerts Today" value="2" color="#F59E0B" bg="rgba(245,158,11,0.08)" />
                <MockStat icon={DollarSign} label="Revenue MTD" value="₪48.2K" color="#10B981" bg="rgba(16,185,129,0.08)" />
              </div>

              <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.04)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>Weekly Inventory Flow</p>
                  <p className="text-[10px] font-medium" style={{ color: '#14B8A6' }}>+12.4%</p>
                </div>
                <div className="flex items-end gap-1.5 h-11">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded" style={{ height: `${h}%`, background: i === 5 ? '#14B8A6' : 'rgba(20,184,166,0.15)' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Copy + CTA */}
          <div className="w-full lg:w-[45%] flex flex-col items-start" dir="ltr">
            <img src="/lovable-uploads/5d780163-bc98-49af-94ab-14ac38bf11f4.png" alt="Mlaiko" className="h-[30px] w-auto object-contain mb-4" />
            <h1 className="text-[2.5rem] lg:text-[3.25rem] leading-[1.1] tracking-[-0.03em]" style={{ color: '#0F172A', fontWeight: 800 }}>
              Inventory Intelligence
              <br />
              Built for Operational
              <br />
              <span style={{ color: '#14B8A6' }}>Precision</span>
            </h1>
            <p className="mt-5 text-base lg:text-lg leading-relaxed max-w-[400px]" style={{ color: '#64748B' }}>
              Real-time monitoring, automated procurement, and AI-powered insights — infrastructure for teams that scale.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={() => openAuth('signup')}
                className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl transition-all duration-200"
                style={{ background: '#14B8A6', color: '#FFFFFF', boxShadow: '0 2px 10px rgba(20,184,166,0.25)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(20,184,166,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(20,184,166,0.25)'; }}
              >
                Get Started <ArrowRight size={15} strokeWidth={2} />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="text-sm font-medium transition-colors duration-150"
                style={{ color: '#64748B' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0F172A')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
              >
                Sign In →
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-8 flex justify-center">
        <a href="https://www.triggex.net" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs transition-colors duration-150" style={{ color: '#94A3B8' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#475569'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}>
          <img src="/images/triggex-logo.png" alt="TriggeX" className="h-[20px] w-auto object-contain" />
          TriggeX Technologies © 2026
        </a>
      </footer>

      {/* ─── AUTH MODAL OVERLAY ─── */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'authOverlayIn 200ms ease-out both' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)' }} onClick={() => setIsAuthOpen(false)} />
          <div
            className="relative w-full max-w-[420px]"
            dir="rtl"
            style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 24px 48px rgba(15,23,42,0.12)', padding: '36px', animation: 'authCardIn 200ms ease-out both' }}
          >
            <button onClick={() => setIsAuthOpen(false)} className="absolute top-4 left-4 p-1.5 rounded-lg transition-colors" style={{ color: '#94A3B8' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#475569')} onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}>
              <X size={18} />
            </button>

            {/* Tabs */}
            <div className="flex gap-6 mb-7" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
              {(['signin', 'signup'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className="pb-3 text-sm font-medium relative" style={{ color: activeTab === tab ? '#14B8A6' : '#475569' }}>
                  {tab === 'signin' ? 'התחברות' : 'הרשמה'}
                  {activeTab === tab && <span className="absolute bottom-0 right-0 left-0 h-0.5 rounded-full" style={{ background: '#14B8A6' }} />}
                </button>
              ))}
            </div>

            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="flex flex-col gap-5">
                <AuthInput id="signin-email" type="email" label="כתובת אימייל" placeholder="name@example.com" icon={<Mail size={18} strokeWidth={1.5} />} value={signInData.email} onChange={(v) => setSignInData((p) => ({ ...p, email: v }))} />
                <AuthInput id="signin-password" type={showPassword ? 'text' : 'password'} label="סיסמה" placeholder="הכנס סיסמה" icon={<Lock size={18} strokeWidth={1.5} />} value={signInData.password} onChange={(v) => setSignInData((p) => ({ ...p, password: v }))} trailing={<button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1">{showPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}</button>} />
                <div className="text-right"><Link to="/forgot-password" className="text-xs font-medium" style={{ color: '#14B8A6' }}>שכחתי את הסיסמה</Link></div>
                <SubmitButton loading={isLoading} />
              </form>
            )}

            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <AuthInput id="signup-firstname" type="text" label="שם פרטי" placeholder="שם פרטי" icon={<User size={18} strokeWidth={1.5} />} value={signUpData.firstName} onChange={(v) => setSignUpData((p) => ({ ...p, firstName: v }))} />
                  <AuthInput id="signup-lastname" type="text" label="שם משפחה" placeholder="שם משפחה" icon={<User size={18} strokeWidth={1.5} />} value={signUpData.lastName} onChange={(v) => setSignUpData((p) => ({ ...p, lastName: v }))} />
                </div>
                <AuthInput id="signup-email" type="email" label="כתובת אימייל" placeholder="name@example.com" icon={<Mail size={18} strokeWidth={1.5} />} value={signUpData.email} onChange={(v) => setSignUpData((p) => ({ ...p, email: v }))} />
                <AuthInput id="signup-password" type={showPassword ? 'text' : 'password'} label="סיסמה" placeholder="לפחות 6 תווים" icon={<Lock size={18} strokeWidth={1.5} />} value={signUpData.password} onChange={(v) => setSignUpData((p) => ({ ...p, password: v }))} trailing={<button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1">{showPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}</button>} />
                <AuthInput id="signup-confirm-password" type={showConfirmPassword ? 'text' : 'password'} label="אישור סיסמה" placeholder="הכנס שוב את הסיסמה" icon={<Lock size={18} strokeWidth={1.5} />} value={signUpData.confirmPassword} onChange={(v) => setSignUpData((p) => ({ ...p, confirmPassword: v }))} trailing={<button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="p-1">{showConfirmPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}</button>} />
                <SubmitButton loading={isLoading} text="הירשם" />
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes authOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes authCardIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/* ─── Mock Stat ─── */
function MockStat({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.04)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}><Icon size={13} style={{ color }} /></div>
        <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>{label}</p>
      </div>
      <p className="text-lg font-bold" style={{ color: '#0F172A' }}>{value}</p>
    </div>
  );
}

/* ─── Auth Input ─── */
function AuthInput({ id, type, label, placeholder, icon, value, onChange, trailing }: { id: string; type: string; label: string; placeholder: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; trailing?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium" style={{ color: '#0F172A' }}>{label}</label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }}>{icon}</span>
        <input id={id} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required className="w-full text-sm pr-10 pl-10 py-3 outline-none transition-all duration-150" style={{ borderRadius: '10px', border: '1px solid rgba(15,23,42,0.08)', color: '#0F172A', background: '#FFFFFF' }} onFocus={(e) => { e.currentTarget.style.borderColor = '#14B8A6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)'; e.currentTarget.style.boxShadow = 'none'; }} />
        {trailing && <span className="absolute left-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}

function SubmitButton({ loading, text = 'המשך למערכת' }: { loading: boolean; text?: string }) {
  return (
    <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3.5 transition-all duration-150 disabled:opacity-60" style={{ background: '#14B8A6', color: '#FFFFFF', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,184,166,0.2)' }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0D9488'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#14B8A6'; }}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? (text === 'הירשם' ? 'נרשם...' : 'מתחבר...') : text}
    </button>
  );
}
