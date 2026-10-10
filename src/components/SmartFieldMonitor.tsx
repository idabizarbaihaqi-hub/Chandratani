import React, { useEffect, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Droplets,
  Thermometer,
  Wind,
  RefreshCw,
  Sliders,
  ExternalLink,
  Sprout,
  Save,
  CheckCircle2,
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";

export interface FieldBlock {
  id: string;
  name: string;
  farmer: string;
  crop: string;
  areaHa: number;
  hst: number;
  soilMoisture: number;
  soilPh: number;
  soilTemp: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  irrigationOpen: boolean;
}

export const INITIAL_BLOCKS: FieldBlock[] = [
  {
    id: "blok-a1",
    name: "Blok A1 — Sawah Irigasi Utara",
    farmer: "Pak Hendra & Kelompok Tani Makmur",
    crop: "Padi Ciherang",
    areaHa: 2.4,
    hst: 38,
    soilMoisture: 68,
    soilPh: 6.4,
    soilTemp: 27.5,
    nitrogen: 145,
    phosphorus: 38,
    potassium: 160,
    irrigationOpen: true,
  },
  {
    id: "blok-b2",
    name: "Blok B2 — Kebun Hortikultura Tengah",
    farmer: "Bu Sari & Kelompok Wanita Tani",
    crop: "Cabai Merah Keriting",
    areaHa: 1.1,
    hst: 54,
    soilMoisture: 52,
    soilPh: 5.8,
    soilTemp: 29.1,
    nitrogen: 118,
    phosphorus: 44,
    potassium: 185,
    irrigationOpen: false,
  },
  {
    id: "blok-c3",
    name: "Blok C3 — Lahan Tegal Selatan",
    farmer: "Pak Wahyu",
    crop: "Jagung Hibrida Bisi-18",
    areaHa: 3.0,
    hst: 25,
    soilMoisture: 61,
    soilPh: 6.6,
    soilTemp: 28.2,
    nitrogen: 162,
    phosphorus: 32,
    potassium: 140,
    irrigationOpen: false,
  },
];

interface SmartFieldMonitorProps {
  currentUser?: FirebaseUser | null;
  cloudBlocks?: FieldBlock[];
  onSaveActivity?: (entry: {
    category: "sensor_lahan";
    title: string;
    summary: string;
    cropName: string;
    severity: string;
  }) => void;
}

export default function SmartFieldMonitor({
  currentUser,
  cloudBlocks,
  onSaveActivity,
}: SmartFieldMonitorProps) {
  const [blocks, setBlocks] = useState<FieldBlock[]>(
    cloudBlocks && cloudBlocks.length > 0 ? cloudBlocks : INITIAL_BLOCKS
  );
  const [selectedId, setSelectedId] = useState<string>("blok-a1");
  const [liveSimActive, setLiveSimActive] = useState<boolean>(true);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [advisoryText, setAdvisoryText] = useState<string>(
    "Kondisi Blok A1 (Padi Ciherang 38 HST): Kelembapan tanah 68% dan pH 6.4 berada pada rentang ideal fase anakan maksimum. Pertahankan tinggi genangan air macak-macak (2–3 cm). Jadwalkan pemupukan susulan kedua (NPK Phonska 150 kg/ha + Urea 75 kg/ha) pada 42 HST saat cuaca pagi cerah."
  );
  const [sources, setSources] = useState<{ uri: string; title: string }[]>([]);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState<boolean>(false);
  const [isSavingBlock, setIsSavingBlock] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  useEffect(() => {
    if (cloudBlocks && cloudBlocks.length > 0) {
      setBlocks(cloudBlocks);
    }
  }, [cloudBlocks]);

  const activeBlock = blocks.find((b) => b.id === selectedId) || blocks[0];

  // Live sensor jitter simulation
  useEffect(() => {
    if (!liveSimActive) return;
    const interval = window.setInterval(() => {
      setBlocks((prev) =>
        prev.map((b) => {
          const moistureDelta = b.irrigationOpen ? 0.4 : -0.2;
          const nextMoisture = Math.min(
            90,
            Math.max(
              30,
              Number((b.soilMoisture + moistureDelta + (Math.random() - 0.5) * 0.6).toFixed(1))
            )
          );
          const nextTemp = Number(
            (b.soilTemp + (Math.random() - 0.5) * 0.2).toFixed(1)
          );
          return {
            ...b,
            soilMoisture: nextMoisture,
            soilTemp: nextTemp,
          };
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [liveSimActive]);

  const updateActiveBlockField = (field: keyof FieldBlock, value: number | boolean) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === activeBlock.id ? { ...b, [field]: value } : b))
    );
  };

  const persistActiveBlockToFirestore = async () => {
    if (!currentUser) return;
    setIsSavingBlock(true);
    setSaveBanner(null);
    const docId = `${currentUser.uid}_${activeBlock.id}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);

    try {
      await setDoc(doc(db, "field_blocks", docId), {
        userId: currentUser.uid,
        name: activeBlock.name.slice(0, 120),
        farmer: activeBlock.farmer.slice(0, 100),
        crop: activeBlock.crop.slice(0, 100),
        areaHa: Math.max(0, Math.min(10000, Number(activeBlock.areaHa) || 1)),
        hst: Math.max(0, Math.min(1000, Number(activeBlock.hst) || 1)),
        soilMoisture: Math.max(0, Math.min(100, Number(activeBlock.soilMoisture) || 50)),
        soilPh: Math.max(0, Math.min(14, Number(activeBlock.soilPh) || 6.5)),
        soilTemp: Math.max(-10, Math.min(70, Number(activeBlock.soilTemp) || 28)),
        nitrogen: Math.max(0, Math.min(5000, Number(activeBlock.nitrogen) || 100)),
        phosphorus: Math.max(0, Math.min(5000, Number(activeBlock.phosphorus) || 35)),
        potassium: Math.max(0, Math.min(5000, Number(activeBlock.potassium) || 150)),
        irrigationOpen: Boolean(activeBlock.irrigationOpen),
        updatedAt: serverTimestamp(),
      });
      setSaveBanner(`Data sensor ${activeBlock.name} berhasil disimpan ke Database Firebase.`);
      setTimeout(() => setSaveBanner(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `field_blocks/${docId}`);
    } finally {
      setIsSavingBlock(false);
    }
  };

  const requestAgronomyAdvisory = async () => {
    setIsLoadingAdvice(true);
    try {
      const response = await fetch("/api/agronomy-advisory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petakName: activeBlock.name,
          cropType: activeBlock.crop,
          soilMoisture: activeBlock.soilMoisture,
          soilPh: activeBlock.soilPh,
          soilTemp: activeBlock.soilTemp,
          nitrogen: activeBlock.nitrogen,
          phosphorus: activeBlock.phosphorus,
          potassium: activeBlock.potassium,
          weatherCondition: "Cerah Berawan, Kelembapan Udara 74%, Angin 11 km/jam",
          question: customQuestion,
        }),
      });
      const data = await response.json();
      if (data.advice) {
        setAdvisoryText(data.advice);
        setSources(data.sources || []);
        if (onSaveActivity) {
          onSaveActivity({
            category: "sensor_lahan",
            title: `Evaluasi Sensor ${activeBlock.name}`,
            summary: data.advice.slice(0, 600),
            cropName: activeBlock.crop,
            severity: `Lembap ${activeBlock.soilMoisture}% · pH ${activeBlock.soilPh}`,
          });
        }
      }
    } catch {
      // keep previous advice
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pemilih Petak Lahan & Kontrol Simulasi */}
      <div className="bg-white border border-[#CDE3C6] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-[#0F3820]">
              03. Telemetri Sensor Lahan &amp; Irigasi Desa
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Pantau kelembapan tanah, derajat keasaman (pH), nutrisi NPK, dan simpan perubahan ke Database Firebase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLiveSimActive(!liveSimActive)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                liveSimActive
                  ? "bg-[#EFF8EC] border-[#A5D6A7] text-[#145A2B]"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              {liveSimActive ? "Stream Sensor Aktif (3 dtk)" : "Stream Sensor Dijeda"}
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={persistActiveBlockToFirestore}
                disabled={isSavingBlock}
                className="px-4 py-2 bg-[#145A2B] hover:bg-[#0F4620] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingBlock ? "Menyimpan..." : "Simpan Blok ke Cloud"}</span>
              </button>
            )}
          </div>
        </div>

        {saveBanner && (
          <div className="mt-4 p-3 rounded-xl bg-[#EFF8EC] border border-[#A5D6A7] text-xs font-semibold text-[#145A2B] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveBanner}</span>
          </div>
        )}

        {/* Daftar Tab Petak Lahan */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {blocks.map((b) => {
            const isSelected = b.id === activeBlock.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[#145A2B] bg-[#EFF8EC]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{b.crop}</span>
                  <span className="font-mono tabular-nums">
                    {b.areaHa} Ha · {b.hst} HST
                  </span>
                </div>
                <p className="text-sm font-bold text-[#0F3820] mt-1">{b.name}</p>
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-700">Lembap: {b.soilMoisture}%</span>
                  <span
                    className={
                      b.soilPh < 6.0 ? "text-amber-700 font-semibold" : "text-[#145A2B]"
                    }
                  >
                    pH: {b.soilPh}
                  </span>
                  <span className="text-slate-600">
                    Irigasi: {b.irrigationOpen ? "BUKA" : "TUTUP"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Sensor Blok Terpilih & Rekomendasi AI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kalibrasi Sensor & Pintu Irigasi (6 Kolom) */}
        <div className="lg:col-span-6 bg-white border border-[#CDE3C6] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-[#0F3820]">{activeBlock.name}</h3>
              <p className="text-xs text-slate-500">
                Pengelola: {activeBlock.farmer} · Umur Tanam {activeBlock.hst} Hari Setelah Tanam (HST)
              </p>
            </div>
            <Sliders className="w-4 h-4 text-slate-400" />
          </div>

          {/* 4 Metrik Utama */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Droplets className="w-3.5 h-3.5 text-[#145A2B]" />
                <span>Kelembapan</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-[#0F3820] mt-1">
                {activeBlock.soilMoisture}%
              </p>
              <span className="text-xs text-slate-500">
                {activeBlock.soilMoisture < 45
                  ? "Kering (Butuh Air)"
                  : activeBlock.soilMoisture > 80
                  ? "Jenuh Air"
                  : "Optimal"}
              </span>
            </div>

            <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Sprout className="w-3.5 h-3.5 text-[#145A2B]" />
                <span>pH Tanah</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-[#0F3820] mt-1">
                {activeBlock.soilPh}
              </p>
              <span className="text-xs text-slate-500">
                {activeBlock.soilPh < 6.0
                  ? "Agak Asam (Dolomit)"
                  : activeBlock.soilPh > 7.2
                  ? "Basa"
                  : "Netral Subur"}
              </span>
            </div>

            <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Thermometer className="w-3.5 h-3.5 text-[#145A2B]" />
                <span>Suhu Tanah</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-[#0F3820] mt-1">
                {activeBlock.soilTemp}°C
              </p>
              <span className="text-xs text-slate-500">Zona Akar 15cm</span>
            </div>

            <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Wind className="w-3.5 h-3.5 text-[#145A2B]" />
                <span>Status Pompa</span>
              </div>
              <p className="text-base font-bold font-mono tabular-nums text-[#0F3820] mt-1.5">
                {activeBlock.irrigationOpen ? "MENGALIR" : "TERTUTUP"}
              </p>
              <button
                type="button"
                onClick={() =>
                  updateActiveBlockField("irrigationOpen", !activeBlock.irrigationOpen)
                }
                className="mt-1 text-xs font-semibold text-[#145A2B] hover:underline cursor-pointer"
              >
                {activeBlock.irrigationOpen ? "Tutup Pintu Air" : "Buka Pintu Air"}
              </button>
            </div>
          </div>

          {/* Slider Simulasi Kalibrasi Lapangan */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-slate-700">
              Simulasi &amp; Input Pengukuran Alat Ukur Tanah Manual:
            </p>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Kelembapan Tanah (%)</span>
                <span className="font-mono tabular-nums font-semibold">
                  {activeBlock.soilMoisture}%
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={95}
                step={1}
                value={activeBlock.soilMoisture}
                onChange={(e) =>
                  updateActiveBlockField("soilMoisture", Number(e.target.value))
                }
                className="w-full accent-[#145A2B] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Derajat Keasaman Tanah (pH)</span>
                <span className="font-mono tabular-nums font-semibold">
                  {activeBlock.soilPh}
                </span>
              </div>
              <input
                type="range"
                min={4.5}
                max={8.0}
                step={0.1}
                value={activeBlock.soilPh}
                onChange={(e) =>
                  updateActiveBlockField("soilPh", Number(e.target.value))
                }
                className="w-full accent-[#145A2B] cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Nitrogen (ppm)
                </label>
                <input
                  type="number"
                  value={activeBlock.nitrogen}
                  onChange={(e) =>
                    updateActiveBlockField("nitrogen", Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Fosfor (ppm)
                </label>
                <input
                  type="number"
                  value={activeBlock.phosphorus}
                  onChange={(e) =>
                    updateActiveBlockField("phosphorus", Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Kalium (ppm)
                </label>
                <input
                  type="number"
                  value={activeBlock.potassium}
                  onChange={(e) =>
                    updateActiveBlockField("potassium", Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel Rekomendasi Agronomi Cerdas (6 Kolom) */}
        <div className="lg:col-span-6 bg-white border border-[#CDE3C6] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-[#0F3820]">
                  Rekomendasi Tindakan Agronomi &amp; Cuaca
                </h3>
                <p className="text-xs text-slate-500">
                  Analisis otomatis berdasarkan angka sensor tanah dan cuaca desa saat ini
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pertanyaan Tambahan (Opsional, mendukung pencarian data terbaru):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Contoh: Berapa dosis kapur dolomit untuk menaikkan pH dari 5.8 ke 6.5?"
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#145A2B]"
                />
                <button
                  type="button"
                  onClick={requestAgronomyAdvisory}
                  disabled={isLoadingAdvice}
                  className="px-4 py-2 bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingAdvice ? "animate-spin" : ""}`}
                  />
                  <span>Perbarui Analisis</span>
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl text-sm text-slate-800 whitespace-pre-line leading-relaxed">
              {advisoryText}
            </div>

            {sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-1.5">
                  Sumber Referensi Terkait:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#145A2B] hover:underline flex items-center gap-1"
                    >
                      <span>{src.title}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
