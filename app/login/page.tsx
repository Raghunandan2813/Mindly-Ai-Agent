'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

// Animated neural network canvas background (Monochrome)
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

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      // Draw connections
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

      // Draw + update nodes
      for (const n of nodes) {
        n.pulse += 0.015;
        const glow = 0.35 + Math.sin(n.pulse) * 0.25;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${glow})`;
        ctx.fill();

        // outer glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.1})`;
        ctx.fill();

        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

const VALID_SUCCESS_MESSAGES: Record<string, string> = {
  'password_reset': 'Password reset successfully. Please sign in with your new password.',
  'email_confirmed': 'Email confirmed. Please sign in.',
};

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password' | 'otp-verify'>('login');
  const [otpType, setOtpType] = useState<'signup' | 'recovery'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('India');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // OTP Panel states
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpShake, setOtpShake] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpLocked, setOtpLocked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);

  const router = useRouter();

  // Check session on mount and redirect if already logged in; read URL query errors/successes safely
  useEffect(() => {
    // 1. Session check to prevent logged-in users from seeing login/signup screens
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.userId) {
          router.push('/');
        }
      })
      .catch(() => { });

    // 2. Read URL params
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(decodeURIComponent(err));
    }
    const successKey = params.get('success');
    if (successKey && VALID_SUCCESS_MESSAGES[successKey]) {
      setSuccess(VALID_SUCCESS_MESSAGES[successKey]);
    }
  }, [router]);

  // Cleanup resend timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  // Start 60-second resend cooldown
  const startResendCooldown = () => {
    setResendCooldown(60);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const endpoint = mode === 'signup'
        ? '/api/auth/signup'
        : (mode === 'forgot-password' ? '/api/auth/forgot-password' : '/api/auth/login');

      const bodyData = mode === 'signup'
        ? { email, password, displayName: name, country }
        : (mode === 'forgot-password' ? { email } : { email, password });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      setSuccess(data.message);

      if (mode === 'login') {
        setTimeout(() => router.push('/'), 500);
      } else if (mode === 'signup') {
        // Only show OTP screen if real email verification is active
        if (data.requiresOtp) {
          setOtpType('signup');
          setOtpAttempts(0);
          setOtpLocked(false);
          setOtpShake(false);
          setOtpSuccess(false);
          startResendCooldown();
          setTimeout(() => {
            setMode('otp-verify');
            setError('');
            setSuccess('');
            setOtpValues(Array(6).fill(''));
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
          }, 1500);
        } else {
          // Dev mode: account auto-confirmed, go straight to home
          setTimeout(() => router.push('/'), 1000);
        }
      } else if (mode === 'forgot-password') {
        // Transition to OTP verification panel for secure mobile code entry
        setOtpType('recovery');
        setOtpAttempts(0);
        setOtpLocked(false);
        setOtpShake(false);
        setOtpSuccess(false);
        startResendCooldown();
        setTimeout(() => {
          setMode('otp-verify');
          setError('');
          setSuccess(data.message || 'Check your email for the 6-digit recovery code!');
          setOtpValues(Array(6).fill(''));
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        }, 1500);
      }
    } catch { setError('Network error'); } finally { setLoading(false); }
  };

  // Dedicated resend handler — re-triggers the correct email without accidentally logging in
  const handleResendCode = async () => {
    if (resendCooldown > 0) return; // Prevent spam
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (otpType === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName: name, country }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to resend code.');
        } else {
          setSuccess('New verification code sent! Check your inbox.');
          setOtpValues(Array(6).fill(''));
          setOtpAttempts(0);
          setOtpLocked(false);
          setOtpShake(false);
          startResendCooldown();
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        }
      } else if (otpType === 'recovery') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to resend reset email.');
        } else {
          setSuccess('New reset code sent! Check your inbox.');
          setOtpValues(Array(6).fill(''));
          setOtpAttempts(0);
          setOtpLocked(false);
          setOtpShake(false);
          startResendCooldown();
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        }
      }
    } catch {
      setError('Network error while resending.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google Sign In');
      setLoading(false);
    }
  };

  // OTP Handling logic
  const handleOtpChange = (idx: number, value: string) => {
    if (otpLocked) return;
    const cleanValue = value.replace(/[^0-9]/g, '');
    if (!cleanValue) {
      const newValues = [...otpValues];
      newValues[idx] = '';
      setOtpValues(newValues);
      return;
    }

    // Support paste action of all digits
    if (cleanValue.length > 1) {
      const pastedValues = cleanValue.slice(0, 6).split('');
      const newValues = [...otpValues];
      for (let i = 0; i < 6; i++) {
        if (pastedValues[i]) newValues[i] = pastedValues[i];
      }
      setOtpValues(newValues);
      const targetIdx = Math.min(pastedValues.length - 1, 5);
      otpRefs.current[targetIdx]?.focus();
      // Auto-submit if all 6 digits filled
      if (newValues.every(v => v !== '')) {
        setTimeout(() => triggerOtpVerify(newValues.join('')), 150);
      }
      return;
    }

    const newValues = [...otpValues];
    newValues[idx] = cleanValue;
    setOtpValues(newValues);

    // Auto-advance focus
    if (idx < 5 && cleanValue) {
      otpRefs.current[idx + 1]?.focus();
    }

    // Auto-submit when 6th digit entered
    if (idx === 5 && cleanValue && newValues.every(v => v !== '')) {
      setTimeout(() => triggerOtpVerify(newValues.join('')), 150);
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpValues[idx] && idx > 0) {
        const newValues = [...otpValues];
        newValues[idx - 1] = '';
        setOtpValues(newValues);
        otpRefs.current[idx - 1]?.focus();
      } else {
        const newValues = [...otpValues];
        newValues[idx] = '';
        setOtpValues(newValues);
      }
    }
  };

  // Core OTP verification logic with shake, attempts, and lockout
  const triggerOtpVerify = async (token: string) => {
    if (otpLocked || loading) return;
    if (token.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setError(''); setSuccess(''); setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, type: otpType }),
      });
      const data = await res.json();

      if (!res.ok) {
        const newAttempts = otpAttempts + 1;
        setOtpAttempts(newAttempts);

        // Shake animation
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 600);

        // Clear boxes after shake
        setTimeout(() => {
          setOtpValues(Array(6).fill(''));
          otpRefs.current[0]?.focus();
        }, 500);

        if (newAttempts >= 3) {
          setOtpLocked(true);
          setError('Too many failed attempts. Please request a new code.');
        } else if (data.error?.toLowerCase().includes('expired')) {
          setError('Code expired. Click "Resend Code" to get a new one.');
        } else {
          setError(`Incorrect code. ${3 - newAttempts} attempt${3 - newAttempts === 1 ? '' : 's'} remaining.`);
        }

        setLoading(false);
        return;
      }

      // Success!
      setOtpSuccess(true);
      setSuccess('Verified successfully!');

      if (otpType === 'recovery') {
        setTimeout(() => router.push('/reset-password'), 1200);
      } else {
        setTimeout(() => router.push('/'), 1200);
      }
    } catch {
      setError('Network error during verification.');
    } finally {
      setLoading(false);
    }
  };

  // Form submit wrapper (for manual button click / Enter key)
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpValues.join('');
    await triggerOtpVerify(token);
  };
  return (
    <div className="min-h-screen flex text-[var(--text-primary)] bg-[var(--bg-primary)]">
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
            An AI that builds a living memory of every conversation — learning, remembering, and evolving with you.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['Semantic Recall', 'Multi-Session', 'Private & Encrypted', 'Zero Data Leaks'].map(f => (
              <span key={f} className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[#a3a3a3] bg-[var(--bg-secondary)]/80">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 bg-[var(--bg-primary)] relative py-16 overflow-hidden">
        
        {/* Cybernetic ambient glow spheres in background */}
        <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full bg-white/[0.02] blur-[120px] pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full bg-neutral-500/[0.02] blur-[120px] pointer-events-none" />
        
        {/* Stunning intense white radial shine directly behind the login card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-white/[0.08] blur-[70px] pointer-events-none mix-blend-screen animate-[pulse-glow_4s_ease-in-out_infinite]" />
        
        {/* Main Card: Premium Glassmorphic Neural Hub */}
        <div className="w-full max-w-md relative z-10 p-8 md:p-10 rounded-[32px] border border-[var(--border)] bg-gradient-to-b from-[#0d0d0d]/80 to-[#020202]/95 backdrop-blur-3xl shadow-2xl animate-fade-in-up">
          
          {/* Subtle top edge highlighting bar */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-neutral-600/30 to-transparent" />

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight font-sans">
              {mode === 'signup'
                ? 'Create account'
                : (mode === 'forgot-password'
                  ? 'Reset password'
                  : (mode === 'otp-verify'
                    ? 'Verify Security Code'
                    : 'Sign in'))}
            </h1>
            <p className="text-[var(--text-secondary)] text-xs mt-2 leading-relaxed font-sans">
              {mode === 'signup'
                ? 'Start building your persistent digital mind today.'
                : (mode === 'forgot-password'
                  ? 'Enter your verified email to receive a recovery code.'
                  : (mode === 'otp-verify'
                    ? 'A 6-digit security code was dispatched to your inbox.'
                    : 'Log in to sync your permanent conversational canvas.'))}
            </p>
          </div>

          {mode === 'otp-verify' ? (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              {/* Email sent indicator */}
              <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10.5px] text-[var(--text-secondary)] font-medium">
                    Sent to <span className="font-semibold text-[var(--text-primary)]">{email}</span>
                  </span>
                </div>
              </div>

              <div className="text-center">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-5 uppercase tracking-widest font-mono">
                  Enter 6-Digit Verification Code
                </label>

                {/* OTP Input Boxes with shake animation */}
                <div className={`flex justify-between gap-2 max-w-[320px] mx-auto mb-6 ${otpShake ? 'animate-shake' : ''}`}>
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpValues[idx] || ''}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      disabled={otpLocked || otpSuccess}
                      className={`w-11 h-13 text-center text-xl font-bold rounded-xl outline-none transition-all duration-200
                        ${otpSuccess
                          ? 'bg-[#0a200e]/50 border-2 border-emerald-500 text-emerald-400 animate-success-pulse shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : otpLocked
                            ? 'bg-[#1a0e0e]/50 border border-rose-950/40 text-neutral-600 cursor-not-allowed'
                            : otpValues[idx]
                              ? 'bg-[#151515] border-2 border-neutral-500 text-[var(--text-primary)] shadow-[0_0_10px_rgba(255,255,255,0.02)]'
                              : 'bg-[#080808] border border-[var(--border)] text-[var(--text-primary)] focus:border-neutral-500'
                        }
                      `}
                    />
                  ))}
                </div>

                {/* Attempt dots indicator */}
                {!otpSuccess && (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-[9px] text-[var(--text-muted)] uppercase font-mono tracking-widest">Security Limits</span>
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i < otpAttempts
                              ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                              : 'bg-neutral-800'
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Error / Success messages */}
              {error && (
                <div className={`px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 border animate-fade-in-up ${otpLocked
                    ? 'bg-rose-950/10 border-rose-900/30 text-rose-400'
                    : 'bg-neutral-900/50 border-neutral-800/80 text-amber-400'
                  }`}>
                  <span className="text-base">{otpLocked ? '🔒' : '⚠️'}</span>
                  <span className="leading-relaxed font-medium">{error}</span>
                </div>
              )}
              {success && (
                <div className={`px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 border border-emerald-950/20 bg-emerald-950/5 text-emerald-400 animate-fade-in-up`}>
                  <span className="text-base">📬</span>
                  <span className="leading-relaxed font-medium">{success}</span>
                </div>
              )}

              {/* Verify button — hidden during auto-submit success */}
              {!otpSuccess && (
                <button
                  type="submit"
                  disabled={loading || otpLocked || otpValues.some(v => !v)}
                  className="btn-primary w-full text-xs h-12 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying Token...
                    </span>
                  ) : otpLocked ? 'Locked • Request New Code' : 'Verify Security Code'}
                </button>
              )}

              {/* Resend + Back row */}
              <div className="flex justify-between items-center text-[10.5px] mt-4 border-t border-neutral-900 pt-4">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading || (resendCooldown > 0 && !otpLocked)}
                  className={`transition-colors font-bold ${resendCooldown > 0 && !otpLocked
                      ? 'text-[var(--text-muted)] cursor-not-allowed'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {otpLocked
                    ? 'Request New Code'
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend Verification Code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                    setOtpAttempts(0);
                    setOtpLocked(false);
                    setOtpShake(false);
                    setOtpSuccess(false);
                    setOtpValues(Array(6).fill(''));
                    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
                    setResendCooldown(0);
                  }}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-bold"
                >
                  ← Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <div className="space-y-1.5 animate-fade-in-up">
                    <label htmlFor="signup-name" className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      Display name
                    </label>
                    <input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter nickname" required className="input-dark text-xs h-11" />

                    {/* Suggestions list */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {NAME_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setName(s)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${name === s
                              ? 'bg-[var(--text-primary)] text-black border-[var(--text-primary)] shadow-sm'
                              : 'bg-neutral-900/50 text-[var(--text-secondary)] border-neutral-800/80 hover:border-neutral-700'
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 animate-fade-in-up">
                    <label htmlFor="signup-country" className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      Country
                    </label>
                    <div className="relative">
                      <select
                        id="signup-country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        required
                        className="input-dark appearance-none bg-[#080808] cursor-pointer pr-10 text-xs h-11 focus:border-neutral-500"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23737373' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 14px center',
                          backgroundSize: '1.2em 1.2em',
                          backgroundRepeat: 'no-repeat',
                        }}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c} className="bg-[#0c0c0c] text-[var(--text-primary)]">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label htmlFor="login-email" className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                  Email Address
                </label>
                <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="input-dark text-xs h-11" autoComplete="email" />
              </div>

              {mode !== 'forgot-password' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="login-password" className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot-password'); setError(''); setSuccess(''); }}
                        className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="input-dark pr-10 text-xs h-11"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none flex items-center cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {mode === 'signup' && <p className="text-[9px] text-[var(--text-muted)] font-mono">Min 8 chars • mixed case • number</p>}
                </div>
              )}

              {error && <div className="px-4 py-3 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 text-rose-400 font-medium text-xs leading-relaxed animate-fade-in-up flex gap-2"><span>✕</span>{error}</div>}
              {success && <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-xs leading-relaxed animate-fade-in-up flex gap-2"><span>📨</span>{success}</div>}

              <button type="submit" disabled={loading} className="btn-primary w-full text-xs h-11 uppercase font-mono tracking-widest mt-2">
                {loading ? 'Processing Workspace...' : mode === 'signup' ? 'Create Secure Account' : (mode === 'forgot-password' ? 'Send Recovery Code' : 'Sign In')}
              </button>
            </form>
          )}

          {/* Divider */}
          {mode !== 'forgot-password' && mode !== 'otp-verify' && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-[1.2px] bg-neutral-900" />
                <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold font-mono">OAuth Gateways</span>
                <div className="flex-1 h-[1.2px] bg-neutral-900" />
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-11 rounded-xl border border-[var(--border)] bg-[#070707] hover:bg-neutral-950 hover:border-neutral-700/80 transition-all flex items-center justify-center gap-3 text-xs font-bold text-[var(--text-primary)] cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24c0-1.55-.15-3.24-.47-4.77H24v9.03h12.75c-.55 2.86-2.18 5.29-4.63 6.91l7.19 5.56C43.5 36.5 46.5 30.82 46.5 24z" />
                  <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.98-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.19-5.56c-2.03 1.36-4.63 2.18-8.7 2.18-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {mode !== 'otp-verify' && (
            <p className="mt-8 text-center text-xs text-[var(--text-secondary)] font-sans border-t border-neutral-900/60 pt-5">
              {mode === 'forgot-password' ? (
                <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="text-[var(--text-primary)] hover:underline font-bold transition-colors cursor-pointer">
                  ← Back to Sign In
                </button>
              ) : (
                <>
                  {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setSuccess(''); }} className="text-[var(--text-primary)] hover:underline font-bold transition-colors cursor-pointer">
                    {mode === 'signup' ? 'Sign in' : 'Create free account'}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
