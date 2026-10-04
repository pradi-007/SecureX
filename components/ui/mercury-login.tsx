'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Terminal,
  CheckCircle2,
  UserPlus,
  User,
  Building,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

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

  // Form fields (clean empty start)
  const [userId, setUserId] = useState('');
  const [sequenceKey, setSequenceKey] = useState('');
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
    // If examiner is already authenticated, redirect straight to the main forensic dashboard
    try {
      const raw = localStorage.getItem('dvrx_examiner_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user_id) {
          window.location.replace('/');
        }
      }
    } catch {}
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

  const handleModeSwitch = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setErrorMsg('');
  };

  const getExaminersVault = () => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('dvrx_examiners_vault');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  };

  const saveToExaminersVault = (record: any) => {
    if (typeof window === 'undefined' || !record?.user_id) return;
    try {
      const vault = getExaminersVault();
      const cleanId = record.user_id.toLowerCase().trim();
      const existingIndex = vault.findIndex((v: any) => v.user_id.toLowerCase().trim() === cleanId);
      if (existingIndex >= 0) {
        vault[existingIndex] = { ...vault[existingIndex], ...record };
      } else {
        vault.push({
          ...record,
          created_at: record.created_at || new Date().toISOString(),
        });
      }
      localStorage.setItem('dvrx_examiners_vault', JSON.stringify(vault));
    } catch (err) {
      console.warn('Could not save to examiners vault in localStorage', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanId = userId.trim();
    const cleanKey = sequenceKey.trim();

    if (!cleanId) {
      setErrorMsg('Please specify your Examiner Node ID / Username.');
      return;
    }

    if (!cleanKey) {
      setErrorMsg('Please enter your sequence key / password.');
      return;
    }

    if (authMode === 'signup') {
      if (cleanKey.length < 3) {
        setErrorMsg('Password must be at least 3 characters long.');
        return;
      }
      if (cleanKey !== confirmKey.trim()) {
        setErrorMsg('Sequence keys do not match. Please verify your password confirmation.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const clientVault = getExaminersVault();
      const payload: any = {
        action: authMode === 'signup' ? 'register' : 'login',
        user_id: cleanId,
        password: cleanKey,
        client_vault: clientVault,
      };

      if (authMode === 'signup') {
        payload.name = fullName.trim() || cleanId;
        payload.agency = agency.trim() || 'Special Cyber Crime Investigation Wing';
      }

      let res = await fetch('/api/dvrx/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = await res.json();

      // If logging in and server returns not found (e.g. cold serverless Lambda),
      // seamlessly auto-register the account to the server and retry!
      if (authMode === 'login' && data.status !== 'ok' && data.message && data.message.includes('not found')) {
        const vaultMatch = clientVault.find((v: any) => v.user_id.toLowerCase().trim() === cleanId.toLowerCase());
        const autoRegRes = await fetch('/api/dvrx/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            user_id: cleanId,
            password: cleanKey,
            name: vaultMatch?.name || cleanId,
            agency: vaultMatch?.agency || 'Special Cyber Crime Investigation Wing',
          }),
        });
        const autoRegData = await autoRegRes.json();
        if (autoRegData.status === 'ok') {
          data = autoRegData;
          res = autoRegRes;
        }
      }

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

      // Always save to the client-side vault so users can log in/out N number of times!
      saveToExaminersVault({
        user_id: examinerData.user_id,
        name: examinerData.name,
        agency: examinerData.agency,
        password_hash: data.record?.password_hash,
      });

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
          window.location.href = '/';
        }, 800);
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

        /* Top Security Banner */
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
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          padding: 8px 18px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Interface Container */
        .auth-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 480px;
          padding: 38px 32px;
          background: rgba(10, 15, 28, 0.78);
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

        /* The Button */
        .submit-wrap {
          margin-top: 26px;
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
          margin-top: 26px;
          text-align: center;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          color: var(--text-dim);
          text-transform: uppercase;
        }

        /* SVG Filter Definition Hidden Element */
        .svg-filter-hidden {
          position: absolute;
          width: 0;
          height: 0;
        }
      `}</style>

      {/* Top Security Banner */}
      <div className="top-nav select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
        <span>DVRX Forensic Gateway · Clearance Required</span>
      </div>

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
              Authentication verified. Opening Main Forensic Dashboard...
            </p>
          </div>
        ) : (
          <form autoComplete="off" onSubmit={handleSubmit}>
            {/* Registration Banner Info */}
            {authMode === 'signup' && (
              <div className="mb-5 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono">
                <div className="text-cyan-300 font-bold flex items-center gap-1.5 text-[11px] mb-1">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  New Examiner Registration:
                </div>
                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                  Create your own Examiner ID and password to access the DVRX forensic dashboard and manage cases.
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
                placeholder={authMode === 'signup' ? 'Choose User ID (e.g. OFFICER-01)' : 'Enter Examiner ID / Username'}
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
                    placeholder="e.g. Insp. Vikram Sharma"
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
                    placeholder="e.g. Cyber Crime Unit / CBI"
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
                  Sequence Key / Password
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
                placeholder="Enter password"
                required
              />
            </div>

            {/* Confirm Password for Sign Up */}
            {authMode === 'signup' && (
              <div className="form-group">
                <label>
                  <Lock className="w-3 h-3 text-orange-400" />
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmKey}
                  onChange={(e) => setConfirmKey(e.target.value)}
                  placeholder="Repeat password"
                  required
                />
              </div>
            )}

            <div className="submit-wrap">
              <button type="submit" className="btn-base" disabled={isSubmitting}>
                {isSubmitting
                  ? (authMode === 'signup' ? 'Registering Account...' : 'Authenticating...')
                  : (authMode === 'signup' ? 'Create Account & Sign In' : 'Sign In to Forensic Terminal')}
              </button>
            </div>

            {/* Prominent Action Callout to Switch / Create New Account */}
            {authMode === 'login' ? (
              <div className="mt-5 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-center font-mono">
                <p className="text-[11px] text-slate-300 mb-2">New forensic investigator or examiner?</p>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signup')}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create New User / Sign Up Here</span>
                </button>
              </div>
            ) : (
              <div className="mt-5 p-4 rounded-2xl bg-white/5 border border-white/10 text-center font-mono">
                <p className="text-[11px] text-slate-400 mb-2">Already have an examiner account?</p>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/20 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Switch to Terminal Sign In</span>
                </button>
              </div>
            )}
          </form>
        )}

        <footer className="footer-nav">
          DVRX SECURE PLATFORM · ELECTRONIC EVIDENCE REPOSITORY
        </footer>
      </main>
    </div>
  );
};

export default MercuryLogin;
