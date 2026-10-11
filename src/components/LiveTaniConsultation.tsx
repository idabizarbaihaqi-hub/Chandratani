import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Eye,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  SwitchCamera,
  Volume2,
  VolumeX,
  AlertCircle,
  Leaf,
} from "lucide-react";

interface TranscriptEntry {
  id: string;
  role: "petani" | "penyuluh";
  text: string;
  timestamp: string;
}

interface LiveTaniConsultationProps {
  onEndCall?: () => void;
  onSaveActivity?: (entry: {
    category: "live_call";
    title: string;
    summary: string;
    cropName: string;
    severity: string;
  }) => void;
}

function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

export default function LiveTaniConsultation({
  onEndCall,
  onSaveActivity,
}: LiveTaniConsultationProps) {
  // 1. Local hardware camera/mic state
  const [cameraPermissionState, setCameraPermissionState] = useState<
    "requesting" | "granted" | "denied"
  >("requesting");
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // 2. Advisor connection & live camera vision state
  const [advisorConnectionState, setAdvisorConnectionState] = useState<
    "searching" | "connected" | "serverless_vision"
  >("searching");
  const [advisorStatusNote, setAdvisorStatusNote] = useState<string>(
    "Menghubungkan kamera & suara ke Pak Chandra..."
  );
  const [cameraObservation, setCameraObservation] = useState<string>(
    "Menyiapkan penglihatan kamera..."
  );
  const [isInspectingCamera, setIsInspectingCamera] = useState<boolean>(false);

  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [framesSent, setFramesSent] = useState(0);
  const [audioVolumeLevel, setAudioVolumeLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const frameIntervalRef = useRef<number | null>(null);
  const initialVisionTimerRef = useRef<number | null>(null);
  const speechRecRef = useRef<any>(null);

  const isMicMutedRef = useRef<boolean>(false);
  const isCameraActiveRef = useRef<boolean>(true);
  const isSpeakerOnRef = useRef<boolean>(true);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const framesSentRef = useRef<number>(0);
  const advisorConnectionStateRef = useRef<"searching" | "connected" | "serverless_vision">(
    "searching"
  );

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
    if (!isSpeakerOn) {
      stopAllPlayback();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    framesSentRef.current = framesSent;
  }, [framesSent]);

  useEffect(() => {
    advisorConnectionStateRef.current = advisorConnectionState;
  }, [advisorConnectionState]);

  const stopAllPlayback = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  const speakTextFallback = (text: string) => {
    if (!isSpeakerOnRef.current || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  };

  const playAudioChunk24k = (base64Pcm: string) => {
    if (!isSpeakerOnRef.current) return;
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.02;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    activeSourcesRef.current.push(source);

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  /**
   * Captures current JPEG frame from <video> element reliably.
   */
  const captureCurrentVideoFrameBase64 = (): string | null => {
    if (!isCameraActiveRef.current || !videoRef.current || !canvasRef.current) {
      return null;
    }
    const video = videoRef.current;
    const rawW = video.videoWidth || 640;
    const rawH = video.videoHeight || 480;
    if (video.readyState < 2) return null;

    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = Math.max(360, Math.round((rawH / rawW) * 640));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    return dataUrl.split(",")[1] || null;
  };

  /**
   * Sends frame directly to /api/live-vision-call (works on both Vercel Serverless and Node server)
   * and optionally speaks the response if WebSocket Live audio is not active.
   */
  const inspectCameraNow = async (customQuestion?: string, forceSpeakHttp?: boolean) => {
    const base64Jpeg = captureCurrentVideoFrameBase64();
    if (!base64Jpeg || isInspectingCamera) return;

    setIsInspectingCamera(true);
    setFramesSent((prev) => prev + 1);

    // If WebSocket to Gemini Live is open and not forcing HTTP, ask server to inspect and speak via Live API
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      advisorConnectionStateRef.current === "connected" &&
      !forceSpeakHttp
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: "inspect_frame_now",
          data: base64Jpeg,
          question:
            customQuestion ||
            "Pak Chandra, tolong lihat kamera saya sekarang. Apa yang terlihat di kamera dan bagaimana saran pertaniannya?",
        })
      );
      setTimeout(() => setIsInspectingCamera(false), 1800);
      return;
    }

    // Serverless / HTTP Direct Vision Call (100% compatible with Vercel deployment!)
    try {
      const res = await fetch("/api/live-vision-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Jpeg,
          question:
            customQuestion ||
            "Jelaskan apa yang tampak di kamera saya saat ini dan berikan saran pertaniannya.",
        }),
      });
      const data = await res.json();
      if (data.visualObservation) {
        setCameraObservation(data.visualObservation);
      }
      if (data.spokenResponse) {
        const nowTime = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        setTranscripts((prev) => [
          ...prev,
          {
            id: `${Date.now()}-vision`,
            role: "penyuluh",
            text: data.spokenResponse,
            timestamp: nowTime,
          },
        ]);
        // Speak out loud if in Serverless mode or if requested
        if (advisorConnectionStateRef.current !== "connected" || forceSpeakHttp) {
          speakTextFallback(data.spokenResponse);
        }
      }
    } catch {
      // ignore transient error
    } finally {
      setIsInspectingCamera(false);
    }
  };

  /**
   * Starts browser SpeechRecognition when running in Serverless mode (e.g. on Vercel)
   * so the farmer can talk hands-free and Pak Chandra answers with live camera vision.
   */
  const startServerlessSpeechRecognition = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec || speechRecRef.current) return;

    try {
      const recognition = new SpeechRec();
      recognition.lang = "id-ID";
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        if (isMicMutedRef.current) return;
        const lastIdx = event.results.length - 1;
        const transcriptText = event.results[lastIdx]?.[0]?.transcript?.trim();
        if (transcriptText) {
          setTranscripts((prev) => [
            ...prev,
            {
              id: `${Date.now()}-user-sr`,
              role: "petani",
              text: transcriptText,
              timestamp: new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
          inspectCameraNow(transcriptText, true);
        }
      };

      recognition.onerror = () => {};
      recognition.start();
      speechRecRef.current = recognition;
    } catch {
      // ignore if browser doesn't support SpeechRecognition
    }
  };

  const stopAllMediaAndSocket = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (initialVisionTimerRef.current) {
      clearTimeout(initialVisionTimerRef.current);
      initialVisionTimerRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
  };

  const initializeLiveCameraAndCall = async (preferredFacing: "environment" | "user") => {
    stopAllMediaAndSocket();
    setCameraPermissionState("requesting");
    setCameraErrorDetail(null);
    setAdvisorConnectionState("searching");
    setAdvisorStatusNote("Menghubungkan kamera & suara ke Pak Chandra...");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Perangkat atau browser Anda tidak mendukung akses kamera langsung (getUserMedia)."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: preferredFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      mediaStreamRef.current = stream;
      setCameraPermissionState("granted");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Trigger first automatic camera vision inspection once video stream settles (1.8s)
      initialVisionTimerRef.current = window.setTimeout(() => {
        const firstFrame = captureCurrentVideoFrameBase64();
        if (firstFrame) {
          fetch("/api/live-vision-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: firstFrame,
              question: "Amati apa yang terlihat pada kamera petani saat panggilan baru dimulai.",
            }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.visualObservation) {
                setCameraObservation(d.visualObservation);
              }
            })
            .catch(() => {});
        }
      }, 1800);

      // Connect to WebSocket Advisor (/ws/live-tani)
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live-tani`);
      wsRef.current = ws;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const micSource = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);

      micSource.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (isMicMutedRef.current) {
          setAudioVolumeLevel(0);
          return;
        }
        const channelData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        setAudioVolumeLevel(Math.min(100, Math.round(rms * 350)));

        if (ws.readyState === WebSocket.OPEN) {
          const base64Audio = floatTo16BitPCMBase64(channelData);
          ws.send(JSON.stringify({ type: "audio", data: base64Audio }));
        }
      };

      // Stream 1 FPS JPEG video frames when connected
      frameIntervalRef.current = window.setInterval(() => {
        const base64Jpeg = captureCurrentVideoFrameBase64();
        if (!base64Jpeg) return;

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "video", data: base64Jpeg }));
          setFramesSent((prev) => prev + 1);
        }
      }, 1200);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status" && data.status === "connected") {
            setAdvisorConnectionState("connected");
            setAdvisorStatusNote("Terhubung dengan Pak Chandra (Suara & Penglihatan Kamera Aktif)");
          } else if (data.type === "vision_observation" && data.text) {
            setCameraObservation(data.text);
          } else if (data.type === "status" && data.status === "closed") {
            setAdvisorConnectionState("serverless_vision");
            setAdvisorStatusNote("Mode Kamera Visual & Suara Aktif");
            startServerlessSpeechRecognition();
          } else if (data.type === "audio" && data.audio) {
            setAdvisorConnectionState("connected");
            playAudioChunk24k(data.audio);
          } else if (data.type === "interrupted") {
            stopAllPlayback();
          } else if (data.type === "input_transcript" && data.text) {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "petani") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text} ${data.text}`.trim() },
                ];
              }
              return [
                ...prev,
                {
                  id: `${Date.now()}-in`,
                  role: "petani",
                  text: data.text,
                  timestamp: new Date().toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ];
            });
          } else if (data.type === "output_transcript" && data.text) {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "penyuluh") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text}${data.text}` },
                ];
              }
              return [
                ...prev,
                {
                  id: `${Date.now()}-out`,
                  role: "penyuluh",
                  text: data.text,
                  timestamp: new Date().toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ];
            });
          } else if (data.type === "error") {
            // Switch seamlessly to Serverless Vision & Voice Mode (e.g. on Vercel)
            setAdvisorConnectionState("serverless_vision");
            setAdvisorStatusNote("Terhubung via Kamera Visual & Suara Langsung");
            startServerlessSpeechRecognition();
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        // When deployed on Vercel Serverless, WebSocket upgrades fail -> activate Serverless Vision + Speech mode
        setAdvisorConnectionState("serverless_vision");
        setAdvisorStatusNote("Terhubung via Kamera Visual & Suara Langsung");
        startServerlessSpeechRecognition();
      };
    } catch (err: any) {
      setCameraPermissionState("denied");
      setCameraErrorDetail(
        err?.message ||
          "Izin kamera atau mikrofon ditolak. Mohon izinkan akses kamera dan mikrofon pada pengaturan browser smartphone Anda."
      );
    }
  };

  // Auto-launch camera and microphone immediately on mount
  useEffect(() => {
    initializeLiveCameraAndCall(facingMode);
    return () => {
      stopAllMediaAndSocket();
    };
  }, []);

  // Re-attach stream if video element becomes ready
  useEffect(() => {
    if (
      cameraPermissionState === "granted" &&
      videoRef.current &&
      mediaStreamRef.current &&
      videoRef.current.srcObject !== mediaStreamRef.current
    ) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraPermissionState, isCameraActive]);

  const toggleMic = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
  };

  const toggleCamera = () => {
    const nextActive = !isCameraActive;
    setIsCameraActive(nextActive);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = nextActive;
      });
    }
  };

  const switchCameraFacing = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);

    if (mediaStreamRef.current && cameraPermissionState === "granted") {
      try {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        const newVideoTrack = newVideoStream.getVideoTracks()[0];
        const oldVideoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          mediaStreamRef.current.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        mediaStreamRef.current.addTrack(newVideoTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
          await videoRef.current.play().catch(() => {});
        }
        // Inspect new camera angle after flip
        setTimeout(() => inspectCameraNow(), 1000);
      } catch {
        // Fallback if device only has a single camera
      }
    }
  };

  const handleEndCall = () => {
    if (transcriptsRef.current.length > 0 && onSaveActivity) {
      const combined = transcriptsRef.current
        .slice(-4)
        .map((t) => `${t.role === "petani" ? "Petani" : "Pak Chandra"}: ${t.text}`)
        .join("\n");
      onSaveActivity({
        category: "live_call",
        title: "Sesi Konsultasi LIVE VIDEO CALL",
        summary: combined.slice(0, 1800),
        cropName: "Tanaman Lahan Desa",
        severity: `${framesSentRef.current} Frame Visual`,
      });
    }
    stopAllMediaAndSocket();
    if (onEndCall) {
      onEndCall();
    }
  };

  const latestTranscript = transcripts[transcripts.length - 1];

  return (
    /* Antarmuka Full Screen Penuh Tanpa Kartu Pembungkus atau Navigasi Bawah */
    <div className="fixed inset-0 z-50 h-dvh w-full bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none">
      {/* ================= LAYER 1: PREVIEW KAMERA UTAMA FULL SCREEN ================= */}
      <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center">
        {/* PENTING: Gunakan opacity-100/opacity-0 alih-alih hidden agar browser selalu mendekode dimensi video untuk dikirim ke Pak Chandra */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            videoRef.current?.play().catch(() => {});
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraPermissionState === "granted" && isCameraActive
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* State 1: Sedang Meminta Izin Kamera & Mikrofon */}
        {cameraPermissionState === "requesting" && (
          <div className="text-center px-6 max-w-sm space-y-3 z-10">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <h2 className="text-lg font-extrabold font-display">
              Mengaktifkan Kamera &amp; Mikrofon...
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Mohon tekan <strong>Izinkan (Allow)</strong> apabila muncul permintaan akses kamera dan mikrofon pada layar smartphone Anda.
            </p>
          </div>
        )}

        {/* State 2: Izin Kamera/Mikrofon Ditolak atau Gagal */}
        {cameraPermissionState === "denied" && (
          <div className="text-center px-6 max-w-md space-y-4 z-10 bg-slate-900/90 border border-white/15 rounded-3xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold font-display">
              Kamera Belum Dapat Diaktifkan
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {cameraErrorDetail}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => initializeLiveCameraAndCall(facingMode)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Lagi Akses Kamera</span>
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Kembali
              </button>
            </div>
          </div>
        )}

        {/* State 3: Kamera Dimatikan Manual oleh Pengguna saat Panggilan Berlangsung */}
        {cameraPermissionState === "granted" && !isCameraActive && (
          <div className="text-center px-6 max-w-sm space-y-3 z-10">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <CameraOff className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-bold">Kamera Dinonaktifkan</p>
            <p className="text-xs text-slate-400">
              Tekan ikon kamera di bagian bawah layar untuk menyalakan kembali tampilan video tanaman.
            </p>
          </div>
        )}
      </div>

      {/* ================= LAYER 2: HEADER TRANSPARAN DI BAGIAN ATAS ================= */}
      <header className="relative z-20 px-4 sm:px-6 pt-4 pb-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          {/* Tombol Kembali / Tutup */}
          <button
            type="button"
            onClick={handleEndCall}
            aria-label="Kembali"
            className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Judul LIVE VIDEO CALL & Status Panggilan */}
          <div className="flex flex-col items-center text-center min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold tracking-wide font-display text-white drop-shadow-xs">
              LIVE VIDEO CALL
            </h1>
            <div className="mt-1 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[11px] font-medium text-emerald-200">
              {cameraPermissionState === "requesting" &&
                "Memeriksa izin kamera & mikrofon..."}
              {cameraPermissionState === "denied" &&
                "Kamera belum aktif (Menunggu izin perangkat)"}
              {cameraPermissionState === "granted" && advisorStatusNote}
            </div>
          </div>

          {/* Jendela Status Penyuluh */}
          <div className="px-3 py-2 rounded-2xl bg-black/55 backdrop-blur-md border border-white/15 flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-700/80 flex items-center justify-center text-white">
              <Leaf className="w-4 h-4" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-none">Pak Chandra</p>
              <p className="text-[10px] text-emerald-300 mt-0.5">
                {advisorConnectionState === "connected"
                  ? `Vision Aktif · ${framesSent} frame`
                  : advisorConnectionState === "searching"
                  ? "Menghubungkan..."
                  : `Vision Aktif · ${framesSent} frame`}
              </p>
            </div>
          </div>
        </div>

        {/* Bar Penglihatan Kamera Real-time (Bukti Pak Chandra Melihat Kamera) */}
        {cameraPermissionState === "granted" && isCameraActive && (
          <div className="max-w-lg mx-auto w-full px-3.5 py-2 rounded-2xl bg-black/55 backdrop-blur-md border border-emerald-400/30 flex items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-[11px] sm:text-xs text-emerald-100 truncate">
                <span className="font-bold text-emerald-300">Penglihatan Pak Chandra: </span>
                {cameraObservation}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ================= LAYER 3: TRANSKRIP PERCAKAPAN MELAYANG & KONTROL BAWAH ================= */}
      <div className="relative z-20 px-4 sm:px-6 pb-7 pt-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-3.5">
        {/* Subtitle Percakapan Langsung jika Ada */}
        {latestTranscript && (
          <div className="max-w-lg mx-auto p-3.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 text-left">
            <div className="flex items-center justify-between text-[11px] text-emerald-300 mb-1">
              <span className="font-bold">
                {latestTranscript.role === "petani"
                  ? "Anda (Petani):"
                  : "Pak Chandra (Penyuluh):"}
              </span>
              <span className="font-mono tabular-nums">{latestTranscript.timestamp}</span>
            </div>
            <p className="text-xs sm:text-sm text-white leading-relaxed line-clamp-4">
              {latestTranscript.text}
            </p>
          </div>
        )}

        {/* Tombol Cepat: Minta Pak Chandra Periksa Tampilan Kamera Sekarang */}
        {cameraPermissionState === "granted" && isCameraActive && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => inspectCameraNow()}
              disabled={isInspectingCamera}
              className="px-4 py-2 rounded-full bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white border border-emerald-300/40 shadow-md backdrop-blur-md text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer"
            >
              {isInspectingCamera ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pak Chandra Sedang Melihat Kamera Anda...</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Periksa Tampilan Kamera Sekarang</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-slate-300 font-mono tabular-nums">
              {isMicMuted
                ? "Mikrofon Nonaktif"
                : `Mikrofon Aktif (${audioVolumeLevel}%) · Silakan bicara atau arahkan kamera ke tanaman`}
            </span>
          </div>
        )}

        {/* Baris Kontrol Panggilan Berbentuk Lingkaran Profesional */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* 1. Mikrofon Aktif / Nonaktif */}
          <button
            type="button"
            onClick={toggleMic}
            disabled={cameraPermissionState !== "granted"}
            title={isMicMuted ? "Aktifkan Mikrofon" : "Nonaktifkan Mikrofon"}
            aria-label={isMicMuted ? "Aktifkan Mikrofon" : "Nonaktifkan Mikrofon"}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border cursor-pointer disabled:opacity-40 ${
              isMicMuted
                ? "bg-white text-slate-900 border-white"
                : "bg-white/15 hover:bg-white/25 text-white border-white/25 backdrop-blur-md"
            }`}
          >
            {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* 2. Kamera Aktif / Nonaktif */}
          <button
            type="button"
            onClick={toggleCamera}
            disabled={cameraPermissionState !== "granted"}
            title={isCameraActive ? "Nonaktifkan Kamera" : "Aktifkan Kamera"}
            aria-label={isCameraActive ? "Nonaktifkan Kamera" : "Aktifkan Kamera"}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border cursor-pointer disabled:opacity-40 ${
              !isCameraActive
                ? "bg-white text-slate-900 border-white"
                : "bg-white/15 hover:bg-white/25 text-white border-white/25 backdrop-blur-md"
            }`}
          >
            {isCameraActive ? (
              <Camera className="w-6 h-6" />
            ) : (
              <CameraOff className="w-6 h-6" />
            )}
          </button>

          {/* 3. Balik Kamera Depan / Belakang */}
          <button
            type="button"
            onClick={switchCameraFacing}
            disabled={cameraPermissionState !== "granted"}
            title="Balik Kamera Depan/Belakang"
            aria-label="Balik Kamera Depan/Belakang"
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>

          {/* 4. Tombol Speaker */}
          <button
            type="button"
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            title={isSpeakerOn ? "Matikan Speaker" : "Nyalakan Speaker"}
            aria-label={isSpeakerOn ? "Matikan Speaker" : "Nyalakan Speaker"}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border cursor-pointer ${
              !isSpeakerOn
                ? "bg-white text-slate-900 border-white"
                : "bg-white/15 hover:bg-white/25 text-white border-white/25 backdrop-blur-md"
            }`}
          >
            {isSpeakerOn ? (
              <Volume2 className="w-6 h-6" />
            ) : (
              <VolumeX className="w-6 h-6" />
            )}
          </button>

          {/* 5. Tombol Akhiri Panggilan (Merah & Terpisah Secara Visual) */}
          <button
            type="button"
            onClick={handleEndCall}
            title="Akhiri Panggilan"
            aria-label="Akhiri Panggilan"
            className="ml-2 w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-lg shadow-red-900/50 border-2 border-red-400/50 flex items-center justify-center transition-all cursor-pointer"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
