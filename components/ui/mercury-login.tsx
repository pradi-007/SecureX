'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, KeyRound, ArrowLeft, Terminal, CheckCircle2, Sparkles, Copy, Check } from 'lucide-react';

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
  const [userId, setUserId] = useState(DEFAULT_ID);
  const [sequenceKey, setSequenceKey] = useState(DEFAULT_KEY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
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
          // Using margins for parallax so we don't overwrite the CSS transform animation
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setErrorMsg('Please specify your Examiner Node ID.');
      return;
    }
    if (!sequenceKey.trim()) {
      setErrorMsg('Please enter your sequence key / password.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setAuthSuccess(true);
      if (onLoginSuccess) {
        onLoginSuccess(userId || DEFAULT_ID);
      } else {
        setTimeout(() => {
          window.location.href = '/#cases';
        }, 800);
      }
    }, 800);
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
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .mercury-wrapper * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        /* Background Liquid Physics Simulation */
        .stage {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 0;
          filter: var(--filter-goo);
          opacity: 0.55;
        }

        .blob {
          position: absolute;
          background: linear-gradient(135deg, var(--mercury), #888);
          border-radius: 50%;
          filter: blur(20px);
          animation: float 20s infinite alternate ease-in-out;
          box-shadow: inset -10px -10px 20px rgba(0,0,0,0.5), 
                      10px 10px 30px rgba(255,255,255,0.2);
          transition: margin 0.1s ease-out; /* Smooths the JS mousemove */
        }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10vw, 20vh) scale(1.2); }
          66% { transform: translate(-5vw, 10vh) scale(0.8); }
          100% { transform: translate(5vw, -10vh) scale(1.1); }
        }

        /* Top Home Link */
        .top-nav {
          position: absolute;
          top: 24px;
          left: 28px;
          z-index: 20;
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
          max-width: 440px;
          padding: 40px;
          background: rgba(10, 15, 28, 0.45);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 28px;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(249, 115, 22, 0.1);
        }

        .header {
          margin-bottom: 40px;
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
          font-size: 2.75rem;
          line-height: 0.95;
          letter-spacing: -1.5px;
          margin-left: -2px;
          margin-top: 0;
          color: #ffffff;
          text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
        }

        .header h1 span {
          display: block;
          font-size: 1.5rem;
          color: #94a3b8;
          letter-spacing: 2px;
          margin-top: 4px;
        }

        /* Form Elements */
        .form-group {
          position: relative;
          margin-bottom: 26px;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
        }

        .form-group:focus-within {
          transform: translateX(8px);
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          color: var(--text-dim);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-group input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          color: var(--accent);
          padding: 10px 0;
          font-size: 16px;
          font-family: 'Space Mono', monospace;
          outline: none;
          transition: border-color 0.4s;
        }

        .input-glow {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0%;
          height: 2px;
          background: #f97316;
          transition: width 0.6s cubic-bezier(0.2, 1, 0.3, 1);
          box-shadow: 0 0 15px #f97316;
        }

        .form-group input:focus + .input-glow {
          width: 100%;
        }

        /* The Mercury Button */
        .submit-wrap {
          margin-top: 40px;
          position: relative;
          filter: var(--filter-goo);
        }

        .btn-base {
          background: var(--accent);
          color: #000;
          border: none;
          padding: 18px 36px;
          font-size: 13px;
          font-weight: 800;
          font-family: 'Space Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          width: 100%;
          position: relative;
          z-index: 2;
          transition: all 0.3s;
          border-radius: 8px;
        }

        .btn-base:hover {
          letter-spacing: 3.5px;
          background: #f97316;
          color: #ffffff;
        }

        .btn-base:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mercury-drop {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          background: var(--mercury);
          transform: translate(-50%, -50%);
          z-index: 1;
          border-radius: 50px;
          transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .submit-wrap:hover .mercury-drop {
          transform: translate(-50%, -50%) scale(1.05, 1.2);
          filter: brightness(1.2);
          background: #f97316;
        }

        /* Utility */
        .footer-nav {
          margin-top: 36px;
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

        {authSuccess ? (
          <div className="p-6 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-center font-mono space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-white font-bold text-sm uppercase">Forensic Terminal Authenticated</div>
            <p className="text-[11px] text-emerald-300">Examiner: <span className="font-bold text-white">{userId}</span></p>
            <p className="text-[10px] text-slate-400">Redirecting to DVRX Case Repository...</p>
          </div>
        ) : (
          <form autoComplete="off" onSubmit={handleSubmit}>
            {/* Quick Credentials Info Card */}
            <div className="mb-5 p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs font-mono">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-400 font-bold flex items-center gap-1.5 text-[11px]">
                  <KeyRound className="w-3.5 h-3.5" />
                  Terminal Access Credentials:
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
                  <span className="text-slate-400">Password:</span>
                  <code className="text-orange-300 font-bold select-all bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                    {DEFAULT_KEY}
                  </code>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-mono text-center">
                {errorMsg}
              </div>
            )}
            <div className="form-group">
              <label>
                <Terminal className="w-3 h-3 text-orange-400" />
                Examiner Identity / Node ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="EXAMINER-DVRX-01"
                required
              />
              <div className="input-glow"></div>
            </div>

            <div className="form-group">
              <label>
                <KeyRound className="w-3 h-3 text-orange-400" />
                Cryptographic Sequence Key
              </label>
              <input
                type="password"
                value={sequenceKey}
                onChange={(e) => setSequenceKey(e.target.value)}
                placeholder="••••••••••••"
                required
              />
              <div className="input-glow"></div>
            </div>

            <div className="submit-wrap">
              <div className="mercury-drop"></div>
              <button type="submit" className="btn-base" disabled={isSubmitting}>
                {isSubmitting ? 'Authenticating...' : 'Initialize Forensic Stream'}
              </button>
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
