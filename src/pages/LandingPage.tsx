import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: "🔔",
    title: "התראות כשמוצר נגמר",
  },
  {
    icon: "📦",
    title: "תצוגת מחסן וירטואלית",
  },
  {
    icon: "📊",
    title: "דוחות חכמים על מלאי ומכירות",
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 to-orange-50 flex flex-col relative overflow-hidden">
      {/* Background SVG/Gradient */}
      <div className="absolute top-0 left-0 w-full h-full z-0 opacity-30 pointer-events-none">
        {/* Example SVG shape from haikei.app (static, can be replaced with animated later) */}
        <svg width="100%" height="100%" viewBox="0 0 1440 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#fbbf24" fillOpacity="0.3" d="M0,160L60,154.7C120,149,240,139,360,154.7C480,171,600,213,720,229.3C840,245,960,235,1080,197.3C1200,160,1320,96,1380,64L1440,32L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"></path>
        </svg>
      </div>
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-20 border-b border-gray-100 flex items-center justify-between px-6 py-3 shadow-sm">
        <div className="font-bold text-2xl text-orange-500">Mlaiko</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/auth")}>התחברות</Button>
          <Button onClick={() => navigate("/auth")}>הרשמה</Button>
        </div>
      </header>
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center flex-1 pt-32 pb-12 relative z-10 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-gray-900 leading-tight">
          ניהול מלאי חכם ופשוט – לעסקים שצומחים
        </h1>
        <p className="text-lg md:text-2xl text-gray-700 mb-8 max-w-xl mx-auto">
          📦 תצוגת מחסן וירטואלית, 🔔 התראות בזמן אמת, 📊 דוחות חכמים. התחל עכשיו – 30 יום ניסיון חינם!
        </p>
        <Button
          className="px-6 py-3 bg-orange-500 text-white rounded-xl text-lg shadow hover:scale-105 hover:bg-orange-600 transition-all duration-300 font-bold"
          style={{ minWidth: 220 }}
          onClick={() => navigate("/auth")}
        >
          ✨ התחילו עכשיו – 30 יום ניסיון חינם
        </Button>
      </section>
      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12 px-4 relative z-10">
        {features.map((f, i) => (
          <div key={i} className="bg-white rounded-2xl shadow p-6 flex flex-col items-center text-center border border-orange-100">
            <div className="text-4xl mb-2">{f.icon}</div>
            <div className="font-semibold text-lg text-gray-800">{f.title}</div>
          </div>
        ))}
      </section>
      {/* Footer */}
      <footer className="text-center text-gray-500 text-sm py-4 relative z-10">
        Mlaiko היא פלטפורמת ניהול מלאי מתקדמת לעסקים קטנים ובינוניים
      </footer>
    </div>
  );
};

export default LandingPage; 