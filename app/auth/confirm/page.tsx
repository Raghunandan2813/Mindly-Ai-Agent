// app/auth/confirm/page.tsx
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'Germany',
  'United Arab Emirates',
  'France',
  'Japan',
  'Netherlands',
  'Switzerland',
  'Sweden',
  'Brazil',
  'South Africa',
  'New Zealand',
  'Italy',
  'Spain',
  'Mexico',
  'Saudi Arabia',
];

const NAME_SUGGESTIONS = [
  'AI Explorer',
  'Memory Master',
  'Cyber Mind',
  'Data Seeker',
  'Tech Nomad',
  'Quantum Sage',
];

// Monochrome animated neural background (supports prefers-reduced-motion)
function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number; r: number; pulse: number }[] = [];
    const nodeCount = 55;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Initial positioning
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 2.2 + 0.8,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // Check for prefers-reduced-motion and performance
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      // Draw Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw Nodes
      for (const n of nodes) {
        if (!prefersReducedMotion) {
          n.pulse += 0.015;
        }
        const glow = 0.35 + Math.sin(n.pulse) * 0.25;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${glow})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.1})`;
        ctx.fill();

        if (!prefersReducedMotion) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function ConfirmFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token_hash = searchParams.get('token_hash');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('India');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(true);

  useEffect(() => {
    const handleVerify = async () => {
      if (!token_hash) {
        setError('Verification token is missing. Please make sure you used the correct link.');
        setVerifyingToken(false);
        return;
      }

      try {
        // Supabase client uses type: 'magiclink' for invite tokens client-side
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'magiclink',
        });

        if (verifyErr) {
          console.error('[VerifyOtp] Failure:', verifyErr.message);
          let errorType = 'invite_failed';
          if (verifyErr.message.toLowerCase().includes('expired')) {
            errorType = 'invite_expired';
          } else if (verifyErr.message.toLowerCase().includes('invalid')) {
            errorType = 'invite_invalid';
          }
          router.push(`/login?error=${errorType}`);
          return;
        }

        // Successfully verified and authenticated (session now set)!
        setVerifyingToken(false);
      } catch (err: any) {
        console.error('[VerifyOtp] Exception:', err);
        router.push('/login?error=invite_failed');
      }
    };

    handleVerify();
  }, [token_hash, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }

    setLoading(true);

    try {
      // 1. Update password securely inside current session
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }

      // 2. Synchronize profile details (fullName, country, onboardingCompleted: false)
      const response = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name.trim(),
          country: country.trim(),
          onboardingCompleted: false, // Ensures onboarding is active when they land on home
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to update user profile metadata.');
        setLoading(false);
        return;
      }

      setSuccess('Account activated! Welcome to Mindly AI. Loading your workspace...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (verifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm text-[var(--text-secondary)]">Verifying invitation credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex text-[var(--text-primary)] bg-[var(--bg-primary)] w-full">
      {/* Left — Animated neural network (Monochrome) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[var(--bg-primary)] border-r border-[var(--border)]">
        <NeuralCanvas />
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12">
          {/* Cybernetic Developer Terminal Neural Logo */}
          <svg width="130" height="130" viewBox="0 0 120 120" fill="none" className="mb-8 drop-shadow-2xl">
            <rect x="10" y="10" width="100" height="100" rx="16" fill="#0d0d0d" stroke="#262626" strokeWidth="1.5" />
            <path d="M10 35h100M10 60h100M10 85h100M35 10v100M60 10v100M85 10v100" stroke="#141414" strokeWidth="0.8" />
            <circle cx="26" cy="24" r="3" fill="#333333" />
            <circle cx="36" cy="24" r="3" fill="#333333" />
            <circle cx="46" cy="24" r="3" fill="#333333" />
            <path d="M26 46l8 6-8 6" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="38" y1="58" x2="48" y2="58" stroke="#a3a3a3" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M52 58h18l12-12h12M70 58l10 10h14" stroke="#525252" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M60 42l10-10h22" stroke="#404040" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="92" cy="46" r="4.5" fill="#ffffff" stroke="#000000" strokeWidth="1" />
            <circle cx="94" cy="68" r="3.5" fill="#a3a3a3" stroke="#000000" strokeWidth="1" />
            <circle cx="92" cy="32" r="3.5" fill="#737373" stroke="#000000" strokeWidth="1" />
            <text x="30" y="86" fill="#404040" fontSize="8.5" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">01001101</text>
            <text x="30" y="97" fill="#222222" fontSize="8" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">SYS_MEM</text>
          </svg>
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">Mindly AI</h2>
          <p className="text-[#a3a3a3] text-center text-sm max-w-xs leading-relaxed">
            Welcome to the future of conversational memory. Initialize your secure profile configuration to continue.
          </p>
        </div>
      </div>

      {/* Right — Invite confirm form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 bg-[var(--bg-primary)] relative py-12">
        <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <svg width="90" height="90" viewBox="0 0 120 120" fill="none" className="mb-4 drop-shadow-xl">
              <rect x="10" y="10" width="100" height="100" rx="16" fill="#0d0d0d" stroke="#262626" strokeWidth="1.5" />
              <path d="M10 35h100M10 60h100M10 85h100M35 10v100M60 10v100M85 10v100" stroke="#141414" strokeWidth="0.8" />
              <circle cx="26" cy="24" r="3" fill="#333333" />
              <circle cx="36" cy="24" r="3" fill="#333333" />
              <circle cx="46" cy="24" r="3" fill="#333333" />
              <path d="M26 46l8 6-8 6" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="38" y1="58" x2="48" y2="58" stroke="#a3a3a3" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M52 58h18l12-12h12M70 58l10 10h14" stroke="#525252" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M60 42l10-10h22" stroke="#404040" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="92" cy="46" r="4.5" fill="#ffffff" stroke="#000000" strokeWidth="1" />
              <circle cx="94" cy="68" r="3.5" fill="#a3a3a3" stroke="#000000" strokeWidth="1" />
              <circle cx="92" cy="32" r="3.5" fill="#737373" stroke="#000000" strokeWidth="1" />
              <text x="30" y="86" fill="#404040" fontSize="8.5" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">01001101</text>
              <text x="30" y="97" fill="#222222" fontSize="8" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">SYS_MEM</text>
            </svg>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Mindly AI</h1>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
              Complete Invitation
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1.5">
              Set up your security credentials and profile information.
            </p>
          </div>

          {error && !success ? (
            <div className="mb-6 space-y-4">
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="btn-primary w-full text-xs h-10 flex items-center justify-center"
              >
                Back to Sign In
              </button>
            </div>
          ) : null}

          {success && (
            <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-6">
              {success}
            </div>
          )}

          {(!error || success) && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="confirm-name" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Full Name</label>
                <input
                  id="confirm-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={loading}
                  className="input-dark"
                />

                {/* Tapped Selection Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {NAME_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={loading}
                      onClick={() => setName(s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                        name === s
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                          : 'bg-[#141414] text-[var(--text-secondary)] border-[var(--border)] hover:border-[#555555]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="confirm-country" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Country</label>
                <div className="relative">
                  <select
                    id="confirm-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    disabled={loading}
                    className="input-dark appearance-none bg-[var(--bg-input)] cursor-pointer pr-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23a3a3a3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '1.5em 1.5em',
                      backgroundRepeat: 'no-repeat',
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} className="bg-[#141414] text-[var(--text-primary)]">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Set Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="input-dark"
                  autoComplete="new-password"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Min 8 characters · uppercase · lowercase · number</p>
              </div>

              <div>
                <label htmlFor="confirm-password-verify" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Confirm Password</label>
                <input
                  id="confirm-password-verify"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="input-dark"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full text-sm h-12 flex items-center justify-center">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing Setup...
                  </>
                ) : (
                  'Complete Profile Setup →'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-sm text-[var(--text-secondary)]">Loading verification interface...</p>
          </div>
        </div>
      }
    >
      <ConfirmFormInner />
    </Suspense>
  );
}
