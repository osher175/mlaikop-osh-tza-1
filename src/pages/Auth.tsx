import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Eye, EyeOff, Mail, Lock, User, Bell, Cpu, BarChart3, ArrowRight, Package, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
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
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* ─── Background Effects ─── */}
      <div
        className="fixed top-[-200px] right-[-200px] w-[800px] h-[800px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(20,184,166,0.07) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="fixed bottom-[-100px] left-[-100px] w-[500px] h-[500px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(245,158,11,0.04) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(15,23,42,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.02) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* ─── NAVBAR ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10"
        style={{
          height: '72px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}
      >
        <img
          src="/lovable-uploads/5d780163-bc98-49af-94ab-14ac38bf11f4.png"
          alt="Mlaiko"
          className="h-9 w-auto object-contain"
        />
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
            style={{ border: '1px solid #14B8A6', color: '#14B8A6', background: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(20,184,166,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            צור קשר
          </button>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main
        className="relative max-w-[1240px] mx-auto px-6 lg:px-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-16"
        style={{
          paddingTop: '140px',
          paddingBottom: '60px',
          minHeight: '100vh',
          animation: 'authFadeIn 500ms ease-out both',
        }}
      >
        {/* ─── LEFT COLUMN: HERO ─── */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center" dir="ltr">
          {/* Small logo above headline */}
          <img
            src="/lovable-uploads/5d780163-bc98-49af-94ab-14ac38bf11f4.png"
            alt="Mlaiko"
            className="h-10 w-auto object-contain mb-6"
          />

          <h1
            className="text-[2.75rem] lg:text-[3.5rem] leading-[1.08] tracking-[-0.03em]"
            style={{ color: '#0F172A', fontWeight: 800 }}
          >
            Inventory Intelligence
            <br />
            Reimagined for
            <br />
            Operational{' '}
            <span style={{ color: '#14B8A6' }}>Precision</span>
          </h1>

          <p
            className="mt-6 text-lg leading-relaxed max-w-[440px]"
            style={{ color: '#475569' }}
          >
            Automated procurement, real-time stock monitoring, and AI-powered
            insights — built for teams that move fast.
          </p>

          {/* Feature bullets */}
          <div className="mt-10 flex flex-col gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(20,184,166,0.08)' }}
                >
                  <Icon size={20} strokeWidth={1.5} style={{ color: '#14B8A6' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{title}</p>
                  <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex items-center gap-4">
            <button
              onClick={() => { setIsAuthOpen(true); setActiveTab('signup'); }}
              className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 14px rgba(20,184,166,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(20,184,166,0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(20,184,166,0.3)';
              }}
            >
              Get Started
              <ArrowRight size={16} strokeWidth={2} />
            </button>
            <button
              onClick={() => { setIsAuthOpen(true); setActiveTab('signin'); }}
              className="text-sm font-medium px-4 py-3.5 transition-colors duration-150"
              style={{ color: '#475569' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0F172A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              Sign In →
            </button>
          </div>

          {/* ─── TriggeX Signature Panel ─── */}
          <a
            href="https://www.triggex.net"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 lg:mt-14 inline-flex flex-col items-start gap-1.5 px-6 py-5 rounded-2xl transition-opacity duration-150 hover:opacity-80"
            style={{
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(15,23,42,0.08)',
              boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
            }}
          >
            <span className="text-[12px] sm:text-[13px] font-normal" style={{ color: '#475569' }}>
              Developed by
            </span>
            <img
              src="/images/triggex-wordmark.png"
              alt="TriggeX Technologies"
              className="block h-[56px] md:h-[64px] w-auto object-contain"
            />
            <span className="text-[12px] sm:text-[13px] font-normal" style={{ color: '#64748B' }}>
              Engineering scalable digital products
            </span>
          </a>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center relative" dir="ltr">
          {!isAuthOpen ? (
            /* ─── Dashboard Preview Mock ─── */
            <div className="w-full max-w-[520px] relative" style={{ animation: 'authFadeIn 600ms ease-out 100ms both' }}>
              {/* Main Dashboard Card */}
              <div
                className="w-full rounded-3xl p-6 lg:p-8"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,23,42,0.06)',
                  boxShadow: '0 25px 50px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
                }}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>Dashboard Overview</p>
                    <p className="text-lg font-bold mt-0.5" style={{ color: '#0F172A' }}>Operations Center</p>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E2E8F0' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E2E8F0' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#14B8A6' }} />
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <StatCard icon={Package} label="Stock Health" value="94%" color="#14B8A6" bg="rgba(20,184,166,0.08)" />
                  <StatCard icon={Cpu} label="AI Procurement" value="Active" color="#8B5CF6" bg="rgba(139,92,246,0.08)" />
                  <StatCard icon={AlertTriangle} label="Alerts Today" value="2" color="#F59E0B" bg="rgba(245,158,11,0.08)" />
                  <StatCard icon={DollarSign} label="Revenue MTD" value="₪48.2K" color="#10B981" bg="rgba(16,185,129,0.08)" />
                </div>

                {/* Mini Chart Placeholder */}
                <div
                  className="w-full rounded-2xl p-4"
                  style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.04)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>Weekly Inventory Flow</p>
                    <p className="text-[10px] font-medium" style={{ color: '#14B8A6' }}>+12.4%</p>
                  </div>
                  <div className="flex items-end gap-1.5 h-12">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all duration-300"
                        style={{
                          height: `${h}%`,
                          background: i === 5 ? '#14B8A6' : 'rgba(20,184,166,0.15)',
                          borderRadius: '4px',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Stat Card - Top Right */}
              <div
                className="absolute -top-4 -right-4 lg:-right-8 rounded-2xl px-4 py-3"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,23,42,0.06)',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                  animation: 'floatCard 3s ease-in-out infinite',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <TrendingUp size={14} style={{ color: '#10B981' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>Profit Margin</p>
                    <p className="text-sm font-bold" style={{ color: '#0F172A' }}>32.8%</p>
                  </div>
                </div>
              </div>

              {/* Floating Stat Card - Bottom Left */}
              <div
                className="absolute -bottom-4 -left-4 lg:-left-8 rounded-2xl px-4 py-3"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,23,42,0.06)',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                  animation: 'floatCard 3s ease-in-out 1.5s infinite',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <Package size={14} style={{ color: '#F59E0B' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>Items Tracked</p>
                    <p className="text-sm font-bold" style={{ color: '#0F172A' }}>1,284</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ─── AUTH CARD ─── */
            <div
              className="w-full max-w-[440px]"
              dir="rtl"
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
                    style={{ color: activeTab === tab ? '#14B8A6' : '#475569' }}
                  >
                    {tab === 'signin' ? 'התחברות' : 'הרשמה'}
                    {activeTab === tab && (
                      <span className="absolute bottom-0 right-0 left-0 h-0.5 rounded-full" style={{ background: '#14B8A6' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* SIGN IN */}
              {activeTab === 'signin' && (
                <form onSubmit={handleSignIn} className="flex flex-col gap-5">
                  <AuthInput id="signin-email" type="email" label="כתובת אימייל" placeholder="name@example.com" icon={<Mail size={18} strokeWidth={1.5} />} value={signInData.email} onChange={(v) => setSignInData((p) => ({ ...p, email: v }))} />
                  <AuthInput id="signin-password" type={showPassword ? 'text' : 'password'} label="סיסמה" placeholder="הכנס סיסמה" icon={<Lock size={18} strokeWidth={1.5} />} value={signInData.password} onChange={(v) => setSignInData((p) => ({ ...p, password: v }))} trailing={<button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1">{showPassword ? <EyeOff size={16} style={{ color: '#94A3B8' }} /> : <Eye size={16} style={{ color: '#94A3B8' }} />}</button>} />
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs font-medium transition-colors duration-150" style={{ color: '#14B8A6' }}>שכחתי את הסיסמה</Link>
                  </div>
                  <SubmitButton loading={isLoading} />
                </form>
              )}

              {/* SIGN UP */}
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

              {/* Back to hero */}
              <button
                onClick={() => setIsAuthOpen(false)}
                className="mt-5 w-full text-center text-xs font-medium transition-colors duration-150"
                style={{ color: '#94A3B8' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#475569')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="text-center py-10">
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          © 2026 TriggeX Technologies · Engineered with scalable architecture
        </p>
      </footer>

      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authCardIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

/* ─── Dashboard Stat Card (mock) ─── */
function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.04)' }}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={14} style={{ color }} />
        </div>
        <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>{label}</p>
      </div>
      <p className="text-xl font-bold" style={{ color: '#0F172A' }}>{value}</p>
    </div>
  );
}

/* ─── Auth Input ─── */
function AuthInput({
  id, type, label, placeholder, icon, value, onChange, trailing,
}: {
  id: string; type: string; label: string; placeholder: string;
  icon: React.ReactNode; value: string;
  onChange: (v: string) => void; trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium" style={{ color: '#0F172A' }}>{label}</label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }}>{icon}</span>
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)} required
          className="w-full text-sm pr-10 pl-10 py-3 outline-none transition-all duration-150"
          style={{ borderRadius: '10px', border: '1px solid rgba(15,23,42,0.08)', color: '#0F172A', background: '#FFFFFF' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#14B8A6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.1)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        {trailing && <span className="absolute left-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}

function SubmitButton({ loading, text = 'המשך למערכת' }: { loading: boolean; text?: string }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3.5 transition-all duration-150 disabled:opacity-60"
      style={{ background: '#F59E0B', color: '#FFFFFF', borderRadius: '12px', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}
      onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#E8930A'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#F59E0B'; }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? (text === 'הירשם' ? 'נרשם...' : 'מתחבר...') : text}
    </button>
  );
}
