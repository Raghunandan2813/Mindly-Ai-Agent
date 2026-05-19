// hooks/useVoiceRecorder.ts
// Natively records user microphone audio in modern browsers using MediaRecorder and checks active audio volume levels.
import { useState, useRef, useCallback } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [maxVolume, setMaxVolume] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Web Audio refs for analyzing microphone signal
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeCheckIntervalRef = useRef<number | null>(null);
  const peakVolumeRef = useRef<number>(0);

  const startRecording = useCallback(async (deviceId?: string | null) => {
    setAudioBlob(null);
    setRecordingError(null);
    setMaxVolume(0);
    audioChunksRef.current = [];
    peakVolumeRef.current = 0;

    // 1. Verify Browser Support for MediaRecorder
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      setRecordingError('Voice recording is not supported in this browser environment (MediaRecorder missing).');
      return;
    }

    // 2. Enforce HTTPS/Secure Context
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setRecordingError('Microphone access requires a secure connection (HTTPS).');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError('Microphone API is disabled or not supported in this browser.');
      return;
    }

    try {
      // 3. Request microphone access with preferred device constraints
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { ideal: deviceId } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 4. Set up Web Audio API analyzer to inspect microphone signal volume
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          // Resume context immediately inside click thread to prevent suspended state security blocks
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const checkVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            if (average > peakVolumeRef.current) {
              peakVolumeRef.current = average;
            }
          };

          const interval = window.setInterval(checkVolume, 100);
          volumeCheckIntervalRef.current = interval;
        }
      } catch (audioErr) {
        console.warn('[Voice Recorder] Web Audio API initialization failed (volume indicator disabled):', audioErr);
      }

      // 5. Determine browser-supported audio codecs accepted by Groq (webm, mp4, ogg fallbacks)
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = ''; // Let the browser determine default container if standard ones are missing
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      // 6. Collect active audio data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 7. Handle recording completion
      mediaRecorder.onstop = () => {
        // Clean up Web Audio API volume analyzers
        if (volumeCheckIntervalRef.current) {
          clearInterval(volumeCheckIntervalRef.current);
          volumeCheckIntervalRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        analyserRef.current = null;

        const peak = peakVolumeRef.current;
        setMaxVolume(peak);
        console.log('[Voice Recorder] Recording finished. Peak volume level recorded:', peak);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(audioBlob);

        // Stop all track streams to release microphone indicator dot
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start recording cleanly without timeslice to ensure browser generates a robust, single-piece container
      mediaRecorder.start();
      setIsRecording(true);
      console.log('[Voice Recorder] Recording started using mimeType:', mimeType || 'browser default');
    } catch (err: any) {
      console.error('[Voice Recorder Error] Mic permission/access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecordingError('Please allow microphone access in your browser settings to record voice.');
      } else {
        setRecordingError(err.message || 'Microphone access denied. Please enable mic permissions.');
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('[Voice Recorder] Recording stopped.');
    }
  }, []);

  return {
    isRecording,
    audioBlob,
    recordingError,
    maxVolume,
    startRecording,
    stopRecording,
    setAudioBlob,
  };
}
