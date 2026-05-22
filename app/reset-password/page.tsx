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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handle client-side hash processing and token expiration
  useEffect(() => {
    // 1. Initial active recovery session verification
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        console.error('No active recovery session found on mount:', error?.message);
        router.push('/login?error=The%20password%20reset%20link%20has%20expired%20or%20is%20invalid.%20Please%20request%20a%20new%20one.');
      } else {
        console.log('Successfully established recovery session for user:', session.user.email);
      }
    });

    // 2. Listen to PASSWORD_RECOVERY / expiration state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // If signed out or session becomes null, redirect with error
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.push('/login?error=The%20password%20reset%20link%20has%20expired%20or%20is%20invalid.%20Please%20request%20a%20new%20one.');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password.');
        setLoading(false);
        return;
      }

      setSuccess('Password updated successfully! Redirecting to sign in...');
      setTimeout(() => {
        router.push('/login?success=password_reset');
      }, 1500);
    } catch {
      setError('Network error. Please try again.');
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
            Secure Account Recovery — update your credentials and resume your personalized AI memory companion.
          </p>
        </div>
      </div>

      {/* Right — Password reset card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 bg-[var(--bg-primary)] relative py-12">
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
              Create New Password
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1.5">
              Secure your account by choosing a strong new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">New Password</label>
              <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={loading} className="input-dark" />
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Min 8 characters · uppercase · lowercase · number</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Confirm New Password</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required disabled={loading} className="input-dark" />
            </div>

            {error && <div className="px-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-xs">{error}</div>}
            {success && <div className="px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-[var(--text-primary)] text-xs">{success}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full text-sm h-12">
              {loading ? 'Updating Password...' : 'Reset Password →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
