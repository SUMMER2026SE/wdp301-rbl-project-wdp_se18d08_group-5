import { useEffect, useRef, useState } from 'react';
import { Badge, Button } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';

interface MicToggleProps {
  roomId: string;
  disabled?: boolean;
}

export function MicToggle({ roomId, disabled = false }: MicToggleProps) {
  const { micActive, setMicActive, setIsSpeaking } = useDebateStore();
  const { user } = useAuthStore();
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const stopAudioMonitoring = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animationRef.current = requestAnimationFrame(tick);
      };
      animationRef.current = requestAnimationFrame(tick);

      setMicActive(true);
      setIsSpeaking(true);
    } catch {
      toast.error('Could not access microphone');
    }
  };

  const stopMic = () => {
    stopAudioMonitoring();
    setMicActive(false);
    setIsSpeaking(false);
    const socket = getSocket();
    socket?.emit('mic:stopped', { roomId, userId: user?._id });
  };

  useEffect(() => {
    return () => {
      stopAudioMonitoring();
    };
  }, []);

  return (
    <div className="d-flex align-items-center gap-2">
      {micActive ? (
        <>
          <div
            className="rounded-pill d-flex align-items-center gap-2 px-3 py-2"
            style={{ background: 'rgba(0,200,100,0.15)', border: '1px solid rgba(0,200,100,0.4)' }}
          >
            <i className="bi bi-mic-fill text-success" />
            <div className="d-flex align-items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-1"
                  style={{
                    width: 3,
                    height: Math.max(4, audioLevel * 40 - i * 4),
                    backgroundColor: audioLevel > 0.1 ? '#00c864' : '#444',
                    transition: 'height 0.05s',
                  }}
                />
              ))}
            </div>
            <Badge bg="success" pill style={{ fontSize: '0.6rem' }}>LIVE</Badge>
          </div>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={stopMic}
            disabled={disabled}
            title="Stop microphone"
          >
            <i className="bi bi-mic-mute-fill" />
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline-success"
          onClick={startMic}
          disabled={disabled}
          title="Start microphone"
        >
          <i className="bi bi-mic-fill me-1" />
          Mic
        </Button>
      )}
    </div>
  );
}
