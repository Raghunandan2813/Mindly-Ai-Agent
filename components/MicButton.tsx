// components/MicButton.tsx
// Premium, micro-animated microphone button supporting tap-to-toggle, hold-to-talk, settings, and robust transcription.
import React, { useState, useEffect, useRef } from 'react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface MicButtonProps {
  onTranscriptReceived: (text: string) => void;
  isDisabled?: boolean;
}

const LANGUAGES = [
  { code: 'auto', label: 'Auto' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'hi', label: 'Hindi' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
];

export default function MicButton({ onTranscriptReceived, isDisabled = false }: MicButtonProps) {
  const { isRecording, audioBlob, recordingError, maxVolume, startRecording, stopRecording, setAudioBlob } = useVoiceRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  
  // Track whether the user is tapping (toggle) or holding the mic button
  const [interactionMode, setInteractionMode] = useState<'idle' | 'tap' | 'hold'>('idle');
  const mouseDownTimeRef = useRef<number>(0);
  const discardBlobRef = useRef<boolean>(false);
  
  // 60 seconds maximum recording timer
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Preferred transcription language state
  const [language, setLanguage] = useState<string>('auto');

  // Premium temporary floating error message state (dismisses after 5 seconds)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Load language preferences & verify MediaRecorder browser support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('voice_language');
      if (savedLang) setLanguage(savedLang);

      const supported = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setIsSupported(supported);
    }
  }, []);

  // 2. Map recording hook errors to custom floating error tooltips
  useEffect(() => {
    if (recordingError) {
      setErrorMessage(recordingError);
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [recordingError]);

  // 3. Clear recording timers when recording terminates
  useEffect(() => {
    if (!isRecording) {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    }
  }, [isRecording]);

  // 4. Handle visibilitychange and tab unload to stop active recording cleanly
  useEffect(() => {
    if (!isRecording) return;

    const handleVisibilityOrUnload = () => {
      console.log('[Mic Button] Backgrounding or tab unload detected. Stopping recording...');
      stopRecording();
      setInteractionMode('idle');
    };

    window.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleVisibilityOrUnload);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleVisibilityOrUnload);
    };
  }, [isRecording, stopRecording]);

  // 5. Global pointer-up listener to handle hold-to-talk releases cleanly, even when sliding outside the button
  useEffect(() => {
    if (interactionMode !== 'hold') return;

    const handleGlobalRelease = (e: MouseEvent | TouchEvent) => {
      const duration = Date.now() - mouseDownTimeRef.current;
      if (duration < 300) {
        // Quick tap: Convert to persistent Tap mode (stay recording)
        setInteractionMode('tap');
      } else if (duration < 1000) {
        // Discard short holds under 1 second
        stopRecording();
        setInteractionMode('idle');
        discardBlobRef.current = true;
        setErrorMessage('Hold longer to record (min 1 second).');
      } else {
        // Genuine release: stop recording cleanly
        stopRecording();
        setInteractionMode('idle');
      }
    };

    window.addEventListener('mouseup', handleGlobalRelease, { capture: true });
    window.addEventListener('touchend', handleGlobalRelease, { capture: true });

    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease, { capture: true });
      window.removeEventListener('touchend', handleGlobalRelease, { capture: true });
    };
  }, [interactionMode, stopRecording]);

  // 6. Send captured audio blob to serverless backend
  useEffect(() => {
    if (!audioBlob) return;
    
    // Check if the recording needs to be discarded (e.g. too short duration limit)
    if (discardBlobRef.current) {
      discardBlobRef.current = false;
      return;
    }

    // Safety checks: Skip if size is zero or under 1KB (essentially silent or empty recordings)
    if (audioBlob.size === 0) {
      console.warn('[Mic Button] Audio blob is empty (0 bytes). Skipping upload.');
      return;
    }

    if (audioBlob.size < 1024) {
      console.warn(`[Mic Button] Audio blob too small (${audioBlob.size} bytes). Discarding...`);
      setErrorMessage('No audio recorded. Please speak clearly.');
      return;
    }

    // Direct Web Audio API active volume validation (non-blocking warning to let Whisper try anyway)
    if (maxVolume < 1.5) {
      console.warn(`[Mic Button] Low audio signal level detected (peak: ${maxVolume}). Proceeding anyway, but mic might be muted.`);
    }

    // Capture the current blob and immediately clear the state buffer
    // This breaks the React dependency re-trigger loop when the language dropdown or onTranscriptReceived callback changes!
    const blobToTranscribe = audioBlob;
    setAudioBlob(null);

    const transcribeAudio = async () => {
      setIsTranscribing(true);
      setErrorMessage(null);

      // Create abort controller for 15s network timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000);

      try {
        const formData = new FormData();
        const fileExt = blobToTranscribe.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blobToTranscribe], `recording.${fileExt}`, { type: blobToTranscribe.type });
        
        formData.append('file', file);
        formData.append('language', language);

        console.log(`[Mic Button] Uploading audio (${blobToTranscribe.size} bytes) in [${language}] mode...`);
        const response = await fetch('/api/voice', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (response.ok) {
          const cleanedText = data.text ? data.text.trim() : '';
          const lowerText = cleanedText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
          
          // Filter out typical Whisper hallucinations (like silent clips outputting "Thank you." or "Subscribe")
          // We only filter these when the file size is very small (under 6KB), which represents minimal or empty voice data
          const hallucinations = ['thank you', 'bye bye', 'subscribe', 'you', 'thanks for watching', 'thanks'];
          const isHallucination = blobToTranscribe.size < 6144 && hallucinations.includes(lowerText);
          
          if (cleanedText && !isHallucination) {
            console.log('[Mic Button] Received transcript:', cleanedText);
            onTranscriptReceived(cleanedText);
          } else {
            console.warn('[Mic Button] Ignored silent or hallucinated transcript:', cleanedText);
            setErrorMessage('No speech detected. Please speak clearly.');
          }
        } else {
          // Specific backend status code error handlers
          if (response.status === 429) {
            setErrorMessage('Too many requests. Please try again in a moment.');
          } else if (response.status === 503 || response.status === 502 || response.status === 504) {
            setErrorMessage('Voice service is currently down. Please type instead.');
          } else {
            setErrorMessage(data.error || 'Failed to transcribe audio. Please try again.');
          }
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          setErrorMessage('Network timeout. Connection is too slow. Please retry.');
        } else {
          console.error('[Mic Button Exception] Failed to upload audio:', error);
          setErrorMessage('Voice service unavailable. Please type instead.');
        }
      } finally {
        setIsTranscribing(false);
      }
    };

    transcribeAudio();
  }, [audioBlob, onTranscriptReceived, language]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    if (!isSupported) {
      setErrorMessage('Voice recording is not supported in this browser.');
      return;
    }
    
    if (isRecording) {
      // 1. Tapped Toggle Mode: Clicking while recording stops it
      const duration = Date.now() - mouseDownTimeRef.current;
      if (duration < 1000) {
        // Enforce 1 second minimum duration rule
        stopRecording();
        setInteractionMode('idle');
        discardBlobRef.current = true;
        setErrorMessage('Hold longer to record (min 1 second).');
        return;
      }
      stopRecording();
      setInteractionMode('idle');
    } else {
      // 2. Start recording with default system device & set up 60 seconds maximum limit timer
      mouseDownTimeRef.current = Date.now();
      discardBlobRef.current = false;
      startRecording();
      setInteractionMode('hold');

      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = setTimeout(() => {
        console.log('[Mic Button] Reached 60s max limit. Auto-stopping...');
        stopRecording();
        setInteractionMode('idle');
        setErrorMessage('Reached 60-second limit.');
      }, 60000);
    }
  };

  const toggleLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setLanguage(code);
    localStorage.setItem('voice_language', code);
  };

  return (
    <div className="relative flex items-center gap-1.5">
      {/* 🌐 Language Preference Selector Dropdown */}
      <select
        value={language}
        onChange={toggleLanguage}
        title="Select recording language"
        disabled={isRecording || isTranscribing || isDisabled}
        className="text-[0.7rem] bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 font-mono rounded-lg px-2 py-1.5 focus:outline-none transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-black text-white">
            {l.label}
          </option>
        ))}
      </select>

      {/* 🔴 Dynamic pulsing ripple rings shown during active recording */}
      {isRecording && (
        <>
          <div className="absolute right-0 w-8 h-8 bg-red-500/20 rounded-full animate-ping pointer-events-none" />
          <div className="absolute right-0 w-12 h-12 bg-red-500/10 rounded-full animate-pulse pointer-events-none" />
        </>
      )}

      {/* ⚠️ Premium Micro-Toast Error Tooltip */}
      {errorMessage && (
        <div className="absolute bottom-11 right-0 z-50 bg-red-950/95 border border-red-800 text-red-200 text-[0.7rem] font-medium px-3 py-2 rounded-xl shadow-lg shadow-black/85 animate-fade-in whitespace-nowrap backdrop-blur-md">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onMouseDown={isDisabled || isTranscribing ? undefined : handleStart}
        onTouchStart={isDisabled || isTranscribing ? undefined : handleStart}
        disabled={isDisabled || isTranscribing}
        title={!isSupported ? "Voice recording not supported" : "Hold to speak (or click to record)"}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-300 focus:outline-none ${
          !isSupported
            ? 'bg-zinc-950 border-zinc-900 text-zinc-800 cursor-not-allowed'
            : isRecording
            ? 'bg-red-600 border-red-500 text-white scale-105 shadow-lg shadow-red-500/30'
            : isTranscribing
            ? 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed'
            : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95 shadow-md shadow-black/20'
        }`}
      >
        {isTranscribing ? (
          // ⏳ Animated transcribing spinner
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isRecording ? (
          // 🔴 Active audio wave indicator icon
          <div className="flex items-center gap-0.5 justify-center h-4 w-4">
            <span className="w-0.5 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-0.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="w-0.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
          </div>
        ) : (
          // 🎙️ Classic Microphone Icon
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3.5 3.5 0 00-3.5 3.5v7a3.5 3.5 0 007 0v-7A3.5 3.5 0 0012 1z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v1a7 7 0 01-14 0v-1M12 18.5V23M8.5 23h7" />
          </svg>
        )}
      </button>
    </div>
  );
}
