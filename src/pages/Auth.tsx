import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Eye, EyeOff, Mail, Lock, User, Bell, Cpu, BarChart3 } from 'lucide-react';
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
    if (user && !loading) {
      console.log('User is authenticated, redirecting to dashboard...');
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await signIn(signInData.email, signInData.password);
      if (error) {
        toast({
          title: 'שגיאה בהתחברות',
          description: error.message === 'Invalid login credentials'
            ? 'פרטי ההתחברות שגויים'
            : 'אירעה שגיאה בעת ההתחברות',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'שגיאה', description: 'אירעה שגיאה בלתי צפויה', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({ title: 'שגיאה', description: 'הסיסמאות אינן תואמות', variant: 'destructive' });
      return;
    }
    if (signUpData.password.length < 6) {
      toast({ title: 'שגיאה', description: 'הסיסמה חייבת להכיל לפחות 6 תווים', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp(signUpData.email, signUpData.password, signUpData.firstName, signUpData.lastName);
      if (error) {
        if (error.message.includes('already registered')) {
          toast({ title: 'שגיאה בהרשמה', description: 'משתמש עם כתובת אימייל זו כבר קיים', variant: 'destructive' });
        } else {
          toast({ title: 'שגיאה בהרשמה', description: 'אירעה שגיאה בעת ההרשמה', variant: 'destructive' });
        }
      } else {
        toast({ title: 'הרשמה בוצעה בהצלחה!', description: 'בדוק את תיבת המייל שלך לאישור החשבון' });
      }
    } catch (error) {
      toast({ title: 'שגיאה', description: 'אירעה שגיאה בלתי צפויה', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#14B8A6' }} />
      </div>
    );
  }

  const features = [
    { icon: Bell, title: 'Smart Stock Alerts', desc: 'Automated notifications when inventory needs attention' },
    { icon: Cpu, title: 'AI Procurement Engine', desc: 'Intelligent supplier matching and ordering' },
    { icon: BarChart3, title: 'Business-Level Insights', desc: 'Analytics built for operational decisions' },
  ];

  return (
    <div className="min-h-screen relative" style={{ background: '#F8FAFC' }}>
      {/* Subtle background gradients */}
      <div
        className="fixed top-0 right-0 w-[600px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(20,184,166,0.05) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-[500px] h-[500px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(245,158,11,0.04) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* ─── NAVBAR ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10"
        style={{
          height: '72px',
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        }}
      >
        <a
          href="https://www.triggex.net"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-1 transition-opacity duration-150 hover:opacity-70 pr-6"
        >
          <span className="text-[12px] sm:text-[13px] tracking-tight font-normal" style={{ color: '#475569' }}>Developed by</span>
          <img src="/images/triggex-wordmark.png" alt="TriggeX Technologies" className="block h-[72px] md:h-[88px] w-auto object-contain" />
        </a>
        <div className="flex items-center gap-6" dir="rtl">
          <button
            onClick={() => { setIsAuthOpen(true); setActiveTab('signin'); }}
            className="hidden sm:block text-sm font-medium transition-colors duration-150 hover:opacity-80"
            style={{ color: '#0F172A' }}
          >
            התחברות
          </button>
          <button
            onClick={() => { setIsAuthOpen(true); setActiveTab('signup'); }}
            className="hidden sm:block text-sm font-medium transition-colors duration-150 hover:opacity-80"
            style={{ color: '#0F172A' }}
          >
            הרשמה
          </button>
          <div className="hidden sm:block w-px h-5" style={{ background: 'rgba(15,23,42,0.12)' }} />
          <button
            className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150"
            style={{
              border: '1px solid #14B8A6',
              color: '#14B8A6',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(20,184,166,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            צור קשר
          </button>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main
        className="max-w-[1240px] mx-auto px-6 lg:px-10 flex flex-col lg:flex-row items-center lg:items-start gap-16"
        style={{
          paddingTop: '172px',
          minHeight: 'calc(100vh - 80px)',
          animation: 'authFadeIn 400ms ease-out both',
        }}
      >
        {/* ─── LEFT: HERO (LTR) ─── */}
        <div className="w-full lg:w-[55%] flex flex-col justify-center" dir="ltr">
          <h1
            className="text-4xl lg:text-5xl font-bold leading-tight"
            style={{ color: '#0F172A', letterSpacing: '-0.02em' }}
          >
            Inventory Intelligence
            <br />
            for Modern Businesses
          </h1>
          <p
            className="mt-5 text-lg leading-relaxed max-w-lg"
            style={{ color: '#475569' }}
          >
            Automated procurement, real-time monitoring and scalable
            infrastructure — built for precision.
          </p>

          <div className="mt-10 flex flex-col gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(20,184,166,0.08)' }}
                >
                  <Icon size={20} strokeWidth={1.5} style={{ color: '#14B8A6' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{title}</p>
                  <p className="text-sm mt-0.5" style={{ color: '#475569' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── RIGHT: LOGO or AUTH CARD ─── */}
        <div className="w-full lg:w-[45%] flex items-center justify-center" dir="rtl">
          {!isAuthOpen ? (
            <div
              className="flex items-center justify-center w-full"
              style={{ animation: 'authFadeIn 400ms ease-out both' }}
            >
              <img
                src="/lovable-uploads/5d780163-bc98-49af-94ab-14ac38bf11f4.png"
                alt="Mlaiko Logo"
                className="w-full max-w-[480px] object-contain"
              />
            </div>
          ) : (
            <div
              className="w-full"
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 20px 40px rgba(15,23,42,0.08)',
                border: '1px solid rgba(15,23,42,0.06)',
                padding: '40px',
                animation: 'authCardIn 200ms ease-out both',
              }}
            >
              {/* Tabs */}
              <div className="flex gap-6 mb-8" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                {(['signin', 'signup'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="pb-3 text-sm font-medium transition-all duration-150 relative"
                    style={{
                      color: activeTab === tab ? '#14B8A6' : '#475569',
                    }}
                  >
                    {tab === 'signin' ? 'התחברות' : 'הרשמה'}
                    {activeTab === tab && (
                      <span
                        className="absolute bottom-0 right-0 left-0 h-0.5 rounded-full"
                        style={{ background: '#14B8A6' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* SIGN IN FORM */}
              {activeTab === 'signin' && (
                <form onSubmit={handleSignIn} className="flex flex-col gap-5">
                  <AuthInput
                    id="signin-email"
                    type="email"
                    label="כתובת אימייל"
                    placeholder="name@example.com"
                    icon={<Mail size={18} strokeWidth={1.5} />}
                    value={signInData.email}
                    onChange={(v) => setSignInData((p) => ({ ...p, email: v }))}
                  />
                  <AuthInput
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    label="סיסמה"
                    placeholder="הכנס סיסמה"
                    icon={<Lock size={18} strokeWidth={1.5} />}
                    value={signInData.password}
                    onChange={(v) => setSignInData((p) => ({ ...p, password: v }))}
                    trailing={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1">
                        {showPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}
                      </button>
                    }
                  />
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs font-medium transition-colors duration-150" style={{ color: '#14B8A6' }}>
                      שכחתי את הסיסמה
                    </Link>
                  </div>
                  <SubmitButton loading={isLoading} />
                </form>
              )}

              {/* SIGN UP FORM */}
              {activeTab === 'signup' && (
                <form onSubmit={handleSignUp} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <AuthInput
                      id="signup-firstname"
                      type="text"
                      label="שם פרטי"
                      placeholder="שם פרטי"
                      icon={<User size={18} strokeWidth={1.5} />}
                      value={signUpData.firstName}
                      onChange={(v) => setSignUpData((p) => ({ ...p, firstName: v }))}
                    />
                    <AuthInput
                      id="signup-lastname"
                      type="text"
                      label="שם משפחה"
                      placeholder="שם משפחה"
                      icon={<User size={18} strokeWidth={1.5} />}
                      value={signUpData.lastName}
                      onChange={(v) => setSignUpData((p) => ({ ...p, lastName: v }))}
                    />
                  </div>
                  <AuthInput
                    id="signup-email"
                    type="email"
                    label="כתובת אימייל"
                    placeholder="name@example.com"
                    icon={<Mail size={18} strokeWidth={1.5} />}
                    value={signUpData.email}
                    onChange={(v) => setSignUpData((p) => ({ ...p, email: v }))}
                  />
                  <AuthInput
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    label="סיסמה"
                    placeholder="לפחות 6 תווים"
                    icon={<Lock size={18} strokeWidth={1.5} />}
                    value={signUpData.password}
                    onChange={(v) => setSignUpData((p) => ({ ...p, password: v }))}
                    trailing={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1">
                        {showPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}
                      </button>
                    }
                  />
                  <AuthInput
                    id="signup-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    label="אישור סיסמה"
                    placeholder="הכנס שוב את הסיסמה"
                    icon={<Lock size={18} strokeWidth={1.5} />}
                    value={signUpData.confirmPassword}
                    onChange={(v) => setSignUpData((p) => ({ ...p, confirmPassword: v }))}
                    trailing={
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="p-1">
                        {showConfirmPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}
                      </button>
                    }
                  />
                  <SubmitButton loading={isLoading} text="הירשם" />
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="text-center py-10 mt-20">
        <p className="text-xs" style={{ color: '#475569' }}>
          © 2026 TriggeX Technologies · Engineered with scalable architecture
        </p>
      </footer>

      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes authCardIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

/* ─── SUB-COMPONENTS ─── */

function AuthInput({
  id, type, label, placeholder, icon, value, onChange, trailing,
}: {
  id: string; type: string; label: string; placeholder: string;
  icon: React.ReactNode; value: string;
  onChange: (v: string) => void; trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium" style={{ color: '#0F172A' }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }}>
          {icon}
        </span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full text-sm pr-10 pl-10 py-3 outline-none transition-all duration-150"
          style={{
            borderRadius: '10px',
            border: '1px solid rgba(15,23,42,0.08)',
            color: '#0F172A',
            background: '#FFFFFF',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#14B8A6';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {trailing && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ loading, text = 'המשך למערכת' }: { loading: boolean; text?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3.5 transition-all duration-150 disabled:opacity-60"
      style={{
        background: '#F59E0B',
        color: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(245,158,11,0.25)',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.background = '#E8930A';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#F59E0B';
      }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? (text === 'הירשם' ? 'נרשם...' : 'מתחבר...') : text}
    </button>
  );
}
