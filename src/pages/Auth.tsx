import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Eye, EyeOff, Mail, Lock, User, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PublicLanding } from '@/components/landing/PublicLanding';

export const Auth = () => {
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    username: '', email: '', password: '', confirmPassword: '',
  });

  useEffect(() => {
    if (user && !loading) navigate('/');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading || user) return;
    const tab = (location.state as { authTab?: 'signin' | 'signup' } | null)?.authTab;
    if (tab === 'signin' || tab === 'signup') {
      setActiveTab(tab);
      setIsAuthOpen(true);
    }
  }, [location.state, loading, user]);

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
      const { error } = await signUp(signUpData.email, signUpData.password, signUpData.username);
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
    <div>
      <PublicLanding onSignIn={() => openAuth('signin')} onSignUp={() => openAuth('signup')} />

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
                <AuthInput id="signup-username" type="text" label="שם משתמש (אופציונלי)" placeholder="ייווצר אוטומטית אם תשאיר ריק" icon={<User size={18} strokeWidth={1.5} />} value={signUpData.username} onChange={(v) => setSignUpData((p) => ({ ...p, username: v }))} required={false} />
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

/* ─── Auth Input ─── */
function AuthInput({ id, type, label, placeholder, icon, value, onChange, trailing, required = true }: { id: string; type: string; label: string; placeholder: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; trailing?: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium" style={{ color: '#0F172A' }}>{label}</label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }}>{icon}</span>
        <input id={id} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full text-sm pr-10 pl-10 py-3 outline-none transition-all duration-150" style={{ borderRadius: '10px', border: '1px solid rgba(15,23,42,0.08)', color: '#0F172A', background: '#FFFFFF' }} onFocus={(e) => { e.currentTarget.style.borderColor = '#14B8A6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)'; e.currentTarget.style.boxShadow = 'none'; }} />
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
