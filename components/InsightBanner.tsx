// components/InsightBanner.tsx
// Premium active reflection glassmorphic widget. Displays proactive memory triggers with smooth hover effects.

'use client';
import React, { useState } from 'react';

export interface Insight {
  id: string;
  type: 'repetition' | 'commitment' | 'deadline' | 'pattern';
  message: string;
  suggestion: string;
  urgency_score: number;
}

interface InsightBannerProps {
  insight: Insight;
  onAction: (message: string, suggestion: string) => void;
  onDismiss: (id: string) => void;
}

export default function InsightBanner({ insight, onAction, onDismiss }: InsightBannerProps) {
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismissClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissing(true);
    // Let the fade animation complete before calling onDismiss
    setTimeout(() => {
      onDismiss(insight.id);
    }, 300);
  };

  const handleActionClick = () => {
    onAction(insight.message, insight.suggestion);
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'repetition':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'commitment':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'deadline':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  return (
    <div
      className={`w-full max-w-[720px] mx-auto px-4 mb-4 transition-all duration-300 transform ${
        isDismissing ? 'opacity-0 scale-95 max-h-0 py-0 mb-0 overflow-hidden' : 'opacity-100 scale-100'
      }`}
    >
      <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.02] hover:from-amber-500/[0.07] hover:to-orange-500/[0.03] border border-amber-500/15 hover:border-amber-500/25 p-4 backdrop-blur-md transition-all duration-300 shadow-md">
        
        {/* Glow effect on hover */}
        <div className="absolute inset-0 -z-10 bg-radial-gradient from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Soft pulsing reflection amber dot */}
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mt-0.5 relative">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute opacity-75" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 relative" />
            </div>

            {/* Content Container */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.65rem] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                  Mindly Active Reflection
                </span>
                <span className={`text-[0.55rem] px-2 py-0.5 rounded-full border font-mono uppercase font-bold select-none ${getBadgeStyle(insight.type)}`}>
                  {insight.type}
                </span>
              </div>

              {/* Alert Content */}
              <p className="text-[0.82rem] font-medium text-neutral-200 leading-relaxed mb-1.5">
                {insight.message}
              </p>

              {/* Suggestion & CTA Action Row */}
              {insight.suggestion && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2.5 pt-2.5 border-t border-amber-500/10">
                  <p className="text-[0.75rem] text-neutral-400 leading-normal italic flex-1">
                    "{insight.suggestion}"
                  </p>
                  <button
                    onClick={handleActionClick}
                    className="flex-shrink-0 self-start sm:self-center px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[0.68rem] tracking-wider uppercase transition-all duration-200 active:scale-95 shadow-sm hover:shadow-amber-500/20 cursor-pointer"
                  >
                    Address Idea
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dismiss (Close) button */}
          <button
            onClick={handleDismissClick}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-amber-500/10 text-neutral-500 hover:text-amber-400 transition-all duration-200 mt-0.5 cursor-pointer"
            aria-label="Dismiss Reflection"
            title="Permanently Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
