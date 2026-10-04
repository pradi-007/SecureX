'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  ArrowLeft,
  Terminal,
  CheckCircle2,
  Sparkles,
  UserPlus,
  User,
  Building,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

const DEFAULT_ID = 'EXAMINER-DVRX-01';
const DEFAULT_KEY = 'dvrx@2026';

interface MercuryLoginProps {
  systemNode?: string;
  titlePrimary?: string;
  titleSecondary?: string;
  onLoginSuccess?: (userId: string) => void;
}

export const MercuryLogin: React.FC<MercuryLoginProps> = ({
  systemNode = "DVRX FORENSIC NODE: 0x992",
  titlePrimary = "DVRX",
  titleSecondary = "FORENSIC ACCESS",
  onLoginSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Form fields
  const [userId, setUserId] = useState(DEFAULT_ID);
  const [sequenceKey, setSequenceKey] = useState(DEFAULT_KEY);
  const [confirmKey, setConfirmKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [agency, setAgency] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [successExaminer, setSuccessExaminer] = useState<{ user_id: string; name: string; agency: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate static random values once per mount to prevent hydration errors
  const blobsData = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      size: 150 + ((i * 37) % 180),
      left: 10 + ((i * 29) % 75),
      top: 10 + ((i * 43) % 75),
      animationDelay: -((i * 4) % 20),
      animationDuration: 15 + ((i * 5) % 15),
    }));
  }, []);

  // Keep track of the blob DOM elements for high-performance updates
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!mounted) return;
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      // Apply subtle parallax effect to each blob
      blobRefs.current.forEach((blob, index) => {
        if (blob) {
          const speed = (index + 1) * 20;
          blob.style.marginLeft = `${x * speed}px`;
          blob.style.marginTop = `${y * speed}px`;
        }
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [mounted]);

  const handleAutoFill = () => {
    setUserId(DEFAULT_ID);
    setSequenceKey(DEFAULT_KEY);
    setErrorMsg('');
  };

  const handleModeSwitch = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setErrorMsg('');
    if (mode === 'signup') {
      if (userId === DEFAULT_ID) setUserId('');
      if (sequenceKey === DEFAULT_KEY) setSequenceKey('');
    } else {
      if (!userId) setUserId(DEFAULT_ID);
      if (!sequenceKey) setSequenceKey(DEFAULT_KEY);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanId = userId.trim();
    const cleanKey = sequenceKey.trim();

    if (!cleanId) {
      setErrorMsg('Please specify your Examiner Node ID.');
      return;
    }

    if (!cleanKey) {
      setErrorMsg('Please enter your sequence key / password.');
      return;
    }

    if (authMode === 'signup') {
      if (cleanKey.length < 4) {
        setErrorMsg('Password sequence must be at least 4 characters long.');
        return;
      }
      if (cleanKey !== confirmKey.trim()) {
        setErrorMsg('Sequence keys do not match. Please verify your password confirmation.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        action: authMode === 'signup' ? 'register' : 'login',
        user_id: cleanId,
        password: cleanKey,
      };

      if (authMode === 'signup') {
        payload.name = fullName.trim() || cleanId;
        payload.agency = agency.trim() || 'Digital Forensics & Cyber Command';
      }

      const res = await fetch('/api/dvrx/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status !== 'ok') {
        setErrorMsg(data.message || 'Authentication request failed.');
        setIsSubmitting(false);
        return;
      }

      const examinerData = data.examiner || {
        user_id: cleanId,
        name: fullName || cleanId,
        agency: agency || 'Digital Forensics Unit',
      };

      // Store in localStorage session
      try {
        localStorage.setItem(
          'dvrx_examiner_session',
          JSON.stringify({
            user_id: examinerData.user_id,
            name: examinerData.name,
            agency: examinerData.agency,
            login_time: new Date().toISOString(),
          })
        );
        window.dispatchEvent(new Event('dvrx_auth_change'));
      } catch (err) {
        console.warn('LocalStorage save warning:', err);
      }

      setSuccessExaminer(examinerData);
      setAuthSuccess(true);
      setIsSubmitting(false);

      if (onLoginSuccess) {
        onLoginSuccess(examinerData.user_id);
      } else {
        setTimeout(() => {
          window.location.href = '/#cases';
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(`Connection error: ${err.message || 'Could not communicate with DVRX Auth engine'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mercury-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;800&family=Space+Mono&display=swap');

        :root {
          --bg: #030712;
          --mercury: #e0e0e0;
          --mercury-dark: #666666;
          --accent: #ffffff;
          --text-dim: rgba(255, 255, 255, 0.5);
          --filter-goo: url('#gooey');
        }

        .mercury-wrapper {
          background-color: var(--bg);
          color: var(--accent);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          width: 100vw;
          overflow-x: hidden;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 80px 16px 40px;
        }

        .mercury-wrapper * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        /* Background Liquid Physics Simulation */
        .stage {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          filter: var(--filter-goo);
          opacity: 0.55;
          pointer-events: none;
        }

        .blob {
          position: absolute;
          background: linear-gradient(135deg, var(--mercury), #888);
          border-radius: 50%;
          filter: blur(20px);
          animation: float 20s infinite alternate ease-in-out;
          box-shadow: inset -10px -10px 20px rgba(0,0,0,0.5), 
                      10px 10px 30px rgba(255,255,255,0.2);
          transition: margin 0.1s ease-out;
        }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10vw, 20vh) scale(1.2); }
          66% { transform: translate(-5vw, 10vh) scale(0.8); }
          100% { transform: translate(5vw, -10vh) scale(1.1); }
        }

        /* Top Home Link */
        .top-nav {
          position: fixed;
          top: 20px;
          left: 24px;
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          color: var(--text-dim);
          text-decoration: none;
          transition: all 0.3s;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .top-nav:hover {
          color: var(--accent);
          border-color: rgba(249, 115, 22, 0.5);
          background: rgba(249, 115, 22, 0.1);
        }

        /* Interface Container */
        .auth-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 480px;
          padding: 36px 32px;
          background: rgba(10, 15, 28, 0.75);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 28px;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(249, 115, 22, 0.12);
          margin: auto;
        }

        .header {
          margin-bottom: 24px;
          text-align: left;
        }

        .brand-id {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #f97316;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .header h1 {
          font-weight: 800;
          font-size: 2.5rem;
          line-height: 0.95;
          letter-spacing: -1.5px;
          margin-left: -2px;
          margin-top: 0;
          color: #ffffff;
          text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
        }

        .header h1 span {
          display: block;
          font-size: 1.35rem;
          color: #94a3b8;
          letter-spacing: 1.5px;
          margin-top: 4px;
        }

        /* Mode Switcher Tabs */
        .mode-tabs {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 24px;
          gap: 4px;
        }

        .mode-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 14px;
          border-radius: 10px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          border: none;
          color: #94a3b8;
          background: transparent;
        }

        .mode-tab-btn.active {
          background: #f97316;
          color: #ffffff;
          box-shadow: 0 2px 12px rgba(249, 115, 22, 0.35);
        }

        .mode-tab-btn:hover:not(.active) {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }

        /* Form Elements */
        .form-group {
          position: relative;
          margin-bottom: 20px;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
        }

        .form-group:focus-within {
          transform: translateX(6px);
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Space Mono', monospace;
          font-size: 10.5px;
          color: var(--text-dim);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-group input {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          color: var(--accent);
          padding: 11px 14px;
          font-size: 14px;
          font-family: 'Space Mono', monospace;
          outline: none;
          transition: border-color 0.3s, background 0.3s;
        }

        .form-group input:focus {
          border-color: #f97316;
          background: rgba(249, 115, 22, 0.05);
        }

        /* The Mercury Button */
        .submit-wrap {
          margin-top: 28px;
          position: relative;
        }

        .btn-base {
          background: #f97316;
          color: #ffffff;
          border: none;
          padding: 16px 28px;
          font-size: 12.5px;
          font-weight: 800;
          font-family: 'Space Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          width: 100%;
          position: relative;
          z-index: 2;
          transition: all 0.3s;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(249, 115, 22, 0.4);
        }

        .btn-base:hover {
          letter-spacing: 2.8px;
          background: #ea580c;
          box-shadow: 0 6px 25px rgba(249, 115, 22, 0.6);
        }

        .btn-base:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          letter-spacing: 2px;
        }

        /* Utility */
        .footer-nav {
          margin-top: 28px;
          display: flex;
          justify-content: space-between;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
        }

        .footer-nav a {
          color: var(--text-dim);
          text-decoration: none;
          transition: color 0.3s;
        }

        .footer-nav a:hover {
          color: #f97316;
        }

        /* SVG Filter Definition Hidden Element */
        .svg-filter-hidden {
          position: absolute;
          width: 0;
          height: 0;
        }
      `}</style>

      {/* Navigation Return to Forensic Dashboard */}
      <Link href="/" className="top-nav">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Forensic Dashboard</span>
      </Link>

      <svg className="svg-filter-hidden" aria-hidden="true">
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" 
              result="goo" 
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>

      <div className="stage" id="stage">
        {mounted && blobsData.map((data, index) => (
          <div
            key={data.id}
            ref={(el) => {
              blobRefs.current[index] = el;
            }}
            className="blob"
            style={{
              width: `${data.size}px`,
              height: `${data.size}px`,
              left: `${data.left}%`,
              top: `${data.top}%`,
              animationDelay: `${data.animationDelay}s`,
              animationDuration: `${data.animationDuration}s`,
            }}
          />
        ))}
      </div>

      <main className="auth-container">
        <header className="header">
          <span className="brand-id">
            <ShieldCheck className="w-3.5 h-3.5" />
            {systemNode}
          </span>
          <h1>
            {titlePrimary}
            <span>{titleSecondary}</span>
          </h1>
        </header>

        {/* Mode Switcher Tabs */}
        <div className="mode-tabs">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`mode-tab-btn ${authMode === 'login' ? 'active' : ''}`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Terminal Login</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('signup')}
            className={`mode-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New User</span>
          </button>
        </div>

        {authSuccess ? (
          <div className="p-6 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-center font-mono space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-white font-bold text-base uppercase">
              {authMode === 'signup' ? 'Examiner Account Registered' : 'Forensic Terminal Authenticated'}
            </div>
            <div className="text-xs text-emerald-300 space-y-1 bg-black/40 p-3 rounded-xl border border-emerald-500/20 text-left">
              <p>Node ID: <span className="font-bold text-white">{successExaminer?.user_id}</span></p>
              <p>Examiner: <span className="text-slate-200">{successExaminer?.name}</span></p>
              <p>Agency: <span className="text-slate-300">{successExaminer?.agency}</span></p>
            </div>
            <p className="text-[11px] text-slate-400 animate-pulse">
              Establishing tamper-evident session &amp; loading Case Manager...
            </p>
          </div>
        ) : (
          <form autoComplete="off" onSubmit={handleSubmit}>
            {/* Quick Credentials Info Card for Login Mode */}
            {authMode === 'login' && (
              <div className="mb-5 p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs font-mono">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-400 font-bold flex items-center gap-1.5 text-[11px]">
                    <KeyRound className="w-3.5 h-3.5" />
                    Default Forensic Credentials:
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 text-[10px] cursor-pointer transition-all flex items-center gap-1 font-semibold shadow"
                  >
                    <Sparkles className="w-3 h-3 text-orange-300" />
                    <span>Auto-Fill</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-400">ID:</span>
                    <code className="text-white font-bold select-all bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                      {DEFAULT_ID}
                    </code>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-400">Key:</span>
                    <code className="text-orange-300 font-bold select-all bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                      {DEFAULT_KEY}
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Banner Info */}
            {authMode === 'signup' && (
              <div className="mb-5 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono">
                <div className="text-cyan-300 font-bold flex items-center gap-1.5 text-[11px] mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Forensic Examiner Registration:
                </div>
                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                  Register your official Examiner ID &amp; Sequence Key to create and audit forensic cases permanently in the backend repository.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Examiner Node ID (Both modes) */}
            <div className="form-group">
              <label>
                <Terminal className="w-3 h-3 text-orange-400" />
                Examiner Node ID / Username
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={authMode === 'signup' ? 'e.g. EXAMINER-CYBER-07' : 'EXAMINER-DVRX-01'}
                required
              />
            </div>

            {/* Sign Up Fields: Full Name & Agency */}
            {authMode === 'signup' && (
              <>
                <div className="form-group">
                  <label>
                    <User className="w-3 h-3 text-orange-400" />
                    Officer Full Name &amp; Rank
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Insp. Rajesh Sharma"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Building className="w-3 h-3 text-orange-400" />
                    Law Enforcement / Cyber Agency
                  </label>
                  <input
                    type="text"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    placeholder="e.g. Delhi Police Cyber Crime Unit (IFSO)"
                    required
                  />
                </div>
              </>
            )}

            {/* Sequence Key / Password */}
            <div className="form-group">
              <div className="flex items-center justify-between mb-2">
                <label className="!mb-0">
                  <KeyRound className="w-3 h-3 text-orange-400" />
                  Cryptographic Sequence Key / Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-white text-[10px] flex items-center gap-1 font-mono cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={sequenceKey}
                onChange={(e) => setSequenceKey(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            {/* Confirm Password for Sign Up */}
            {authMode === 'signup' && (
              <div className="form-group">
                <label>
                  <Lock className="w-3 h-3 text-orange-400" />
                  Confirm Sequence Key
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmKey}
                  onChange={(e) => setConfirmKey(e.target.value)}
                  placeholder="Repeat sequence key"
                  required
                />
              </div>
            )}

            <div className="submit-wrap">
              <button type="submit" className="btn-base" disabled={isSubmitting}>
                {isSubmitting
                  ? (authMode === 'signup' ? 'Registering Examiner...' : 'Authenticating Terminal...')
                  : (authMode === 'signup' ? 'Create Account & Authorize' : 'Initialize Forensic Stream')}
              </button>
            </div>

            {/* Switch Mode Helper Link */}
            <div className="mt-4 text-center">
              {authMode === 'login' ? (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signup')}
                  className="text-xs font-mono text-orange-400 hover:text-orange-300 underline underline-offset-4 cursor-pointer transition-colors"
                >
                  New forensic user? Create an account / Sign up
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="text-xs font-mono text-slate-400 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
                >
                  Already registered? Switch to Terminal Login
                </button>
              )}
            </div>
          </form>
        )}

        <footer className="footer-nav">
          <Link href="/#custody">CUSTODY LEDGER AUDIT</Link>
          <Link href="/#cases">ACTIVE CASE REPOSITORY</Link>
        </footer>
      </main>
    </div>
  );
};

export default MercuryLogin;
