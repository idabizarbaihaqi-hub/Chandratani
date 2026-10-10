import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
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
  // Honest separated states:
  // 1. Local hardware camera/mic state
  const [cameraPermissionState, setCameraPermissionState] = useState<
    "requesting" | "granted" | "denied"
  >("requesting");
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // 2. Two-way Advisor connection state
  const [advisorConnectionState, setAdvisorConnectionState] = useState<
    "searching" | "connected" | "local_only"
  >("searching");
  const [advisorStatusNote, setAdvisorStatusNote] = useState<string>(
    "Menunggu penyuluh terhubung..."
  );

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

  const isMicMutedRef = useRef<boolean>(false);
  const isCameraActiveRef = useRef<boolean>(true);
  const isSpeakerOnRef = useRef<boolean>(true);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const framesSentRef = useRef<number>(0);

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
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    framesSentRef.current = framesSent;
  }, [framesSent]);

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

  const playAudioChunk24k = (base64Pcm: string) => {
    if (!isSpeakerOnRef.current) return;
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

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

  const stopAllMediaAndSocket = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
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
    setAdvisorStatusNote("Mencari penyuluh...");

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

      // Connect to WebSocket Advisor
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
        if (
          !isCameraActiveRef.current ||
          !videoRef.current ||
          !canvasRef.current ||
          ws.readyState !== WebSocket.OPEN
        ) {
          return;
        }
        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * 640);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        const base64Jpeg = dataUrl.split(",")[1];
        if (base64Jpeg) {
          ws.send(JSON.stringify({ type: "video", data: base64Jpeg }));
          setFramesSent((prev) => prev + 1);
        }
      }, 1000);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status" && data.status === "connected") {
            setAdvisorConnectionState("connected");
            setAdvisorStatusNote("Terhubung dengan Penyuluh Pertanian (Suara & Visual)");
          } else if (data.type === "status" && data.status === "closed") {
            setAdvisorConnectionState("local_only");
            setAdvisorStatusNote(
              "Preview kamera lokal aktif · Menunggu penyuluh terhubung kembali"
            );
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
            setAdvisorConnectionState("local_only");
            setAdvisorStatusNote(
              "Preview kamera lokal aktif · Koneksi dua arah penyuluh belum tersedia saat ini"
            );
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setAdvisorConnectionState("local_only");
        setAdvisorStatusNote(
          "Preview kamera lokal aktif · Menunggu penyuluh terhubung"
        );
      };
    } catch (err: any) {
      setCameraPermissionState("denied");
      setCameraErrorDetail(
        err?.message ||
          "Izin kamera atau mikrofon ditolak. Mohon izinkan akses kamera dan mikrofon pada pengaturan browser smartphone Anda."
      );
    }
  };

  // Auto-launch camera and microphone immediately on mount (No intermediate screen!)
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            cameraPermissionState === "granted" && isCameraActive ? "block" : "hidden"
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
      <header className="relative z-20 px-4 sm:px-6 pt-4 pb-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-start justify-between gap-3">
        {/* Tombol Kembali / Tutup */}
        <button
          type="button"
          onClick={handleEndCall}
          aria-label="Kembali"
          className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Judul LIVE VIDEO CALL & Status Panggilan Jujur */}
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

        {/* Jendela Status Penyuluh (Jujur, Tanpa Video Penyuluh Palsu) */}
        <div className="px-3 py-2 rounded-2xl bg-black/55 backdrop-blur-md border border-white/15 flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-700/80 flex items-center justify-center text-white">
            <Leaf className="w-4 h-4" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold leading-none">Pak Chandra</p>
            <p className="text-[10px] text-emerald-300 mt-0.5">
              {advisorConnectionState === "connected"
                ? `Suara Aktif · ${framesSent} frame`
                : advisorConnectionState === "searching"
                ? "Mencari penyuluh..."
                : "Mode Preview Lokal"}
            </p>
          </div>
        </div>
      </header>

      {/* ================= LAYER 3: TRANSKRIP PERCAKAPAN MELAYANG & KONTROL BAWAH ================= */}
      <div className="relative z-20 px-4 sm:px-6 pb-7 pt-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-4">
        {/* Subtitle Percakapan Langsung jika Ada */}
        {latestTranscript && (
          <div className="max-w-lg mx-auto p-3.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 text-left">
            <div className="flex items-center justify-between text-[11px] text-emerald-300 mb-1">
              <span className="font-bold">
                {latestTranscript.role === "petani"
                  ? "Anda (Petani):"
                  : "Pak Chandra (Penyuluh):"}
              </span>
              <span className="font-mono tabular-nums">{latestTranscript.timestamp}</span>
            </div>
            <p className="text-xs sm:text-sm text-white leading-relaxed line-clamp-3">
              {latestTranscript.text}
            </p>
          </div>
        )}

        {/* Indikator Level Mikrofon Saat Kamera Aktif */}
        {cameraPermissionState === "granted" && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-300 font-mono tabular-nums">
            <span>
              {isMicMuted
                ? "Mikrofon Nonaktif"
                : `Mikrofon Aktif (${audioVolumeLevel}%)`}
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
