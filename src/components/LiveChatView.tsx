import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Camera,
  Leaf,
  Plus,
  RefreshCw,
  Video,
  X,
} from "lucide-react";
import RichAIResponseRenderer, {
  RichAIResponseData,
} from "./RichAIResponseRenderer";

interface ChatMessage {
  id: string;
  role: "petani" | "penyuluh";
  text: string;
  imagePreview?: string;
  structured?: RichAIResponseData;
  timestamp: string;
}

interface LiveChatViewProps {
  farmerName?: string;
  onBack: () => void;
  onStartVideoCall: () => void;
  onSaveActivity?: (entry: {
    category: "live_call";
    title: string;
    summary: string;
    cropName: string;
    severity: string;
  }) => void;
}

const SUGGESTED_QUESTIONS = [
  "Mengapa daun padi menguning?",
  "Bagaimana mengatasi hama cabai?",
  "Kapan waktu pemupukan yang tepat?",
  "Bagaimana meningkatkan hasil panen?",
  "Apa perbedaan kekurangan nitrogen dan kalium?",
  "Bagaimana cara menanam tomat dari awal?",
];

export default function LiveChatView({
  onBack,
  onStartVideoCall,
  onSaveActivity,
}: LiveChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserNearBottomRef = useRef<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserNearBottomRef.current = distanceFromBottom < 140;
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (isUserNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isSending]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const dataUrl = reader.result;
        const [header, base64] = dataUrl.split(",");
        const mimeMatch = header.match(/:(.*?);/);
        setAttachedImage({
          dataUrl,
          base64,
          mimeType: mimeMatch ? mimeMatch[1] : "image/jpeg",
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleNewConversation = () => {
    setMessages([]);
    setInput("");
    setAttachedImage(null);
  };

  const sendChatMessage = async (questionOverride?: string) => {
    const textToSend = (questionOverride ?? input).trim();
    if ((!textToSend && !attachedImage) || isSending) return;

    const currentAttachment = attachedImage;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "petani",
      text: textToSend || "Tolong analisis foto tanaman yang saya lampirkan ini.",
      imagePreview: currentAttachment?.dataUrl,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    isUserNearBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImage(null);
    setIsSending(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role === "petani" ? "user" : "assistant",
        text: m.text,
      }));

      const res = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          imageBase64: currentAttachment?.base64,
          mimeType: currentAttachment?.mimeType,
          history: historyPayload,
        }),
      });

      const structuredData: RichAIResponseData = await res.json();

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "penyuluh",
        text: `${structuredData.summaryTitle}\n${structuredData.summaryText}`,
        structured: structuredData,
        timestamp: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, botMsg]);

      if (onSaveActivity) {
        onSaveActivity({
          category: "live_call",
          title: `Live Chat: ${structuredData.summaryTitle.slice(0, 80)}`,
          summary: `Pertanyaan: ${userMsg.text}\nRingkasan: ${structuredData.summaryText}`,
          cropName: "Konsultasi Pertanian",
          severity: "Selesai",
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "penyuluh",
          text: "Maaf, koneksi sedang terganggu. Silakan coba kirim ulang pertanyaan Anda.",
          timestamp: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    /* Layout Full Screen 100dvh Tanpa Pembungkus Kartu Luar (Seperti ChatGPT Mobile) */
    <div className="fixed inset-0 z-40 h-dvh w-full bg-[#F9FBF8] flex flex-col overflow-hidden">
      {/* ================= B. HEADER CHAT MINIMALIS ================= */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-[#E2EDE0] px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
        {/* Kiri: Tombol Kembali */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke Beranda"
            className="p-2 rounded-xl text-[#0F3820] hover:bg-[#EFF8EC] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Tengah: Pak Chandra — Asisten Pertanian */}
        <div className="flex flex-col items-center text-center min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#145A2B] text-white flex items-center justify-center shrink-0">
              <Leaf className="w-3 h-3" />
            </span>
            <h1 className="text-sm sm:text-base font-extrabold text-[#0F3820] font-display truncate">
              Pak Chandra
            </h1>
          </div>
          <span className="text-[11px] font-medium text-[#3B873E]">
            Asisten Pertanian
          </span>
        </div>

        {/* Kanan: Tombol Ringkas LIVE VIDEO CALL & Percakapan Baru */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onStartVideoCall}
            title="Mulai LIVE VIDEO CALL"
            className="px-2.5 py-1.5 rounded-xl bg-[#145A2B] hover:bg-[#0F4620] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Video className="w-3.5 h-3.5 fill-white" />
            <span className="hidden xs:inline">LIVE VIDEO</span>
          </button>

          <button
            type="button"
            onClick={handleNewConversation}
            title="Percakapan Baru"
            aria-label="Percakapan Baru"
            className="p-2 rounded-xl text-[#0F3820] hover:bg-[#EFF8EC] border border-[#DCEAD7] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================= C. AREA PERCAKAPAN FULL SCREEN ================= */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-5"
      >
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            /* ================= F. HALAMAN CHAT KOSONG ================= */
            <div className="min-h-[62vh] flex flex-col items-center justify-center text-center px-3 py-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#66BB6A] to-[#145A2B] text-white flex items-center justify-center shadow-sm mb-4">
                <Leaf className="w-7 h-7" />
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F3820] font-display">
                Selamat datang di CHANDRA Tani Desaku
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 max-w-md">
                Ada yang ingin Anda tanyakan tentang pertanian?
              </p>

              {/* Saran Pertanyaan Interaktif */}
              <div className="mt-7 w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendChatMessage(q)}
                    disabled={isSending}
                    className="p-3.5 rounded-2xl bg-white hover:bg-[#EFF8EC] border border-[#DCEAD7] hover:border-[#A5D6A7] text-xs sm:text-sm font-semibold text-[#0F3820] transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer"
                  >
                    <span>{q}</span>
                    <ArrowUp className="w-4 h-4 text-[#2E7D32] rotate-45 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Daftar Bubble Percakapan */
            <div className="space-y-6 pb-4">
              {messages.map((msg) =>
                msg.role === "petani" ? (
                  /* Pesan Pengguna di Sebelah Kanan */
                  <div key={msg.id} className="flex flex-col items-end">
                    <div className="max-w-[85%] sm:max-w-[72%] rounded-2xl rounded-br-xs bg-[#145A2B] text-white px-4 py-3 shadow-2xs space-y-2">
                      {msg.imagePreview && (
                        <div className="rounded-xl overflow-hidden border border-white/20 max-h-56">
                          <img
                            src={msg.imagePreview}
                            alt="Lampiran foto tanaman petani"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ) : (
                  /* Jawaban AI di Sebelah Kiri (Visual & Terstruktur) */
                  <div key={msg.id} className="flex items-start gap-2.5 sm:gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-[#145A2B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Leaf className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 bg-white border border-[#E2EDE0] rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-2xs">
                      {msg.structured ? (
                        <RichAIResponseRenderer data={msg.structured} />
                      ) : (
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {msg.text}
                        </p>
                      )}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Pak Chandra · Asisten Pertanian</span>
                        <span className="font-mono tabular-nums">{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {isSending && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#145A2B] text-white flex items-center justify-center shrink-0">
                    <Leaf className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-[#E2EDE0] rounded-2xl px-4 py-3 text-xs font-semibold text-[#145A2B] flex items-center gap-2 shadow-2xs">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Pak Chandra sedang menyusun penjelasan &amp; visual...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= D. KOLOM INPUT DI BAGIAN BAWAH ================= */}
      <div className="shrink-0 bg-white border-t border-[#E2EDE0] px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-3xl mx-auto">
          {/* Preview Lampiran Foto Jika Ada */}
          {attachedImage && (
            <div className="mb-2.5 flex items-center gap-3 p-2 rounded-xl bg-[#F4F9F2] border border-[#CDE3C6] w-fit">
              <img
                src={attachedImage.dataUrl}
                alt="Preview lampiran tanaman"
                className="w-12 h-12 rounded-lg object-cover border border-[#CDE3C6]"
              />
              <div className="text-xs">
                <p className="font-bold text-[#0F3820]">Foto Tanaman Siap Dianalisis</p>
                <p className="text-[11px] text-slate-500">
                  Tambahkan keterangan atau langsung tekan kirim
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="p-1 rounded-full hover:bg-white text-slate-500 hover:text-red-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChatMessage();
            }}
            className="flex items-center gap-2 bg-white border border-[#BFD8B8] focus-within:border-[#145A2B] rounded-2xl px-2.5 py-1.5 shadow-2xs transition-colors"
          >
            {/* Tombol Lampiran Foto Tanaman */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Lampirkan Foto Tanaman"
              aria-label="Lampirkan Foto Tanaman"
              className="p-2 rounded-xl text-[#145A2B] hover:bg-[#EFF8EC] transition-colors shrink-0 cursor-pointer"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Input Teks */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending}
              placeholder="Tanyakan masalah pertanian Anda..."
              className="flex-1 py-2 px-1 text-sm text-[#0F2E1A] placeholder:text-slate-400 bg-transparent focus:outline-none min-w-0"
            />

            {/* Tombol Kirim Berbentuk Ikon Panah */}
            <button
              type="submit"
              disabled={isSending || (!input.trim() && !attachedImage)}
              aria-label="Kirim Pesan"
              className="w-9 h-9 rounded-xl bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
