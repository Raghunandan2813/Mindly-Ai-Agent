'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
      setTimeout(() => router.push('/'), 500);
    } catch { setError('Network error'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex text-[#f5f5f5] bg-black">
      {/* Left — Animated neural network (Monochrome) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black border-r border-[#222222]">
        <NeuralCanvas />
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12">
          {/* Brain circuit icon (Monochrome) */}
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mb-8 drop-shadow-2xl">
            <circle cx="60" cy="60" r="55" stroke="url(#grad)" strokeWidth="1.5" opacity="0.2" />
            <circle cx="60" cy="60" r="35" stroke="url(#grad)" strokeWidth="1" opacity="0.1" />
            <circle cx="60" cy="38" r="4" fill="#ffffff" />
            <circle cx="40" cy="55" r="3.5" fill="#a3a3a3" />
            <circle cx="80" cy="55" r="3.5" fill="#a3a3a3" />
            <circle cx="50" cy="75" r="3" fill="#525252" />
            <circle cx="70" cy="75" r="3" fill="#525252" />
            <circle cx="60" cy="60" r="5" fill="#ffffff" />
            <line x1="60" y1="38" x2="60" y2="55" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
            <line x1="40" y1="55" x2="55" y2="60" stroke="#a3a3a3" strokeWidth="1" opacity="0.3" />
            <line x1="65" y1="60" x2="80" y2="55" stroke="#a3a3a3" strokeWidth="1" opacity="0.3" />
            <line x1="57" y1="65" x2="50" y2="75" stroke="#525252" strokeWidth="1" opacity="0.3" />
            <line x1="63" y1="65" x2="70" y2="75" stroke="#525252" strokeWidth="1" opacity="0.3" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="120" y2="120">
                <stop stopColor="#ffffff" /><stop offset="1" stopColor="#222222" />
              </linearGradient>
            </defs>
          </svg>
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Memory Agent</h2>
          <p className="text-[#a3a3a3] text-center text-sm max-w-xs leading-relaxed">
            An AI that builds a living memory of every conversation — learning, remembering, and evolving with you.
          </p>
          
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['Semantic Recall', 'Multi-Session', 'Private & Encrypted', 'Zero Data Leaks'].map(f => (
              <span key={f} className="px-3 py-1.5 rounded-full text-xs font-medium border border-[#222222] text-[#a3a3a3] bg-[#0d0d0d]/80">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 bg-[#000000] relative">
        <div className="w-full max-w-sm relative z-10">
          
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-neutral-600 flex items-center justify-center mb-3 shadow-lg">
              <span className="text-2xl">🧠</span>
            </div>
            <h1 className="text-xl font-bold text-white">Memory Agent</h1>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
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

            {error && <div className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs">{error}</div>}
            {success && <div className="px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs">{success}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full text-sm h-12">
              {loading ? 'Authenticating...' : isSignup ? 'Create Account →' : 'Sign In →'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignup(!isSignup); setError(''); setSuccess(''); }} className="text-white hover:underline font-semibold transition-colors">
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
