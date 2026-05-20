'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const router = useRouter();

  // Read URL query errors (like OAuth callback errors)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(decodeURIComponent(err));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(data.message);
      
      // Only redirect automatically if it was a successful login. 
      // If it was a signup, keep the user on the page to read the email instructions!
      if (!isSignup) {
        setTimeout(() => router.push('/'), 500);
      }
    } catch { setError('Network error'); } finally { setLoading(false); }
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

      {/* Right — Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 bg-[var(--bg-primary)] relative">
        <div className="w-full max-w-sm relative z-10">
          
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

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
              {isSignup ? 'Create account' : 'Sign in'}
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1.5">
              {isSignup ? 'Start building your AI memory today' : 'Continue where you left off'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Email</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="input-dark" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Password</label>
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="input-dark" autoComplete={isSignup ? 'new-password' : 'current-password'} />
              {isSignup && <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Min 8 characters · uppercase · lowercase · number</p>}
            </div>

            {error && <div className="px-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-xs">{error}</div>}
            {success && <div className="px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-[var(--text-primary)] text-xs">{success}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full text-sm h-12">
              {loading ? 'Authenticating...' : isSignup ? 'Create Account →' : 'Sign In →'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-[1px] bg-[#222222]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Or continue with</span>
            <div className="flex-1 h-[1px] bg-[#222222]" />
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] hover:border-[#555555] transition-all flex items-center justify-center gap-3 text-sm font-semibold text-[var(--text-primary)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24c0-1.55-.15-3.24-.47-4.77H24v9.03h12.75c-.55 2.86-2.18 5.29-4.63 6.91l7.19 5.56C43.5 36.5 46.5 30.82 46.5 24z"/>
              <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.19-5.56c-2.03 1.36-4.63 2.18-8.7 2.18-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignup(!isSignup); setError(''); setSuccess(''); }} className="text-[var(--text-primary)] hover:underline font-semibold transition-colors">
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
