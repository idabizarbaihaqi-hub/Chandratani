import React, { useState } from "react";
import { Upload, Volume2, Search, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import sampleRiceImg from "../assets/images/sample_daun_padi_1791602916951.jpg";
import sampleChiliImg from "../assets/images/sample_daun_cabai_1791602926567.jpg";

interface DiagnosisResult {
  plantIdentified: string;
  diagnosisName: string;
  pathogenOrCause: string;
  severity: string;
  confidencePercent: number;
  symptomsObserved: string[];
  organicTreatment: string[];
  chemicalTreatment: string[];
  fertilizerRecommendation: string;
  preventionTips: string[];
}

interface PlantDiseaseScannerProps {
  onSaveActivity?: (entry: {
    category: "diagnosis_daun";
    title: string;
    summary: string;
    cropName: string;
    severity: string;
  }) => void;
}

const SAMPLE_CASES = [
  {
    id: "padi-bercak",
    title: "Sampel Daun Padi Bercak Coklat",
    crop: "Padi Sawah (Oryza sativa)",
    imageUrl: sampleRiceImg,
    defaultNotes:
      "Muncul bercak oval berwarna coklat dengan titik tengah kuning keabu-abuan pada daun padi umur 42 HST.",
  },
  {
    id: "cabai-keriting",
    title: "Sampel Daun Cabai Keriting Kuning",
    crop: "Cabai Merah (Capsicum annuum)",
    imageUrl: sampleChiliImg,
    defaultNotes:
      "Daun muda mengeriting ke atas, terdapat mosaik bercak kuning terang, pertumbuhan tanaman agak kerdil.",
  },
];

export default function PlantDiseaseScanner({ onSaveActivity }: PlantDiseaseScannerProps) {
  const [selectedImagePreview, setSelectedImagePreview] = useState<string>(sampleRiceImg);
  const [cropName, setCropName] = useState<string>("Padi Sawah (Oryza sativa)");
  const [notes, setNotes] = useState<string>(SAMPLE_CASES[0].defaultNotes);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const [result, setResult] = useState<DiagnosisResult | null>({
    plantIdentified: "Padi Sawah (Oryza sativa)",
    diagnosisName: "Penyakit Bercak Daun Coklat (Brown Spot)",
    pathogenOrCause: "Jamur Bipolaris oryzae (Helminthosporium oryzae)",
    severity: "Sedang",
    confidencePercent: 94,
    symptomsObserved: [
      "Bercak nekrotik berbentuk oval berwarna coklat tua pada helai daun",
      "Bagian tengah bercak tampak kuning pucat hingga keabu-abuan",
      "Indikasi tanah kekurangan unsur Kalium (K) dan Silika",
    ],
    organicTreatment: [
      "Semprotkan agens hayati Trichoderma harzianum atau Pseudomonas fluorescens (5 ml/liter air) pada sore hari",
      "Aplikasi ekstrak daun mimba dan lengkuas setiap 5 hari sekali",
      "Atur sanitasi air sawah agar tidak tergenang terus-menerus",
    ],
    chemicalTreatment: [
      "Fungisida berbahan aktif Azoksistrobin + Difenokonazol (dosis 1 ml/liter air)",
      "Fungisida kontak Mankozeb 80 WP (dosis 2 gram/liter air) jika kelembapan udara sangat tinggi",
    ],
    fertilizerRecommendation:
      "Tambahkan pupuk KCl 50 kg/ha untuk memperkuat dinding sel daun dan hindari pemberian Urea berlebih saat penyakit aktif.",
    preventionTips: [
      "Gunakan benih padi bersertifikat dan lakukan perendaman benih dengan agens hayati",
      "Berikan pupuk kompos jerami matang dan kapur pertanian (Dolomit) sebelum tanam",
    ],
  });

  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const [header, base64] = dataUrl.split(",");
        const mimeMatch = header.match(/:(.*?);/);
        resolve({
          base64,
          mimeType: mimeMatch ? mimeMatch[1] : "image/jpeg",
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample: (typeof SAMPLE_CASES)[0]) => {
    setSelectedImagePreview(sample.imageUrl);
    setCropName(sample.crop);
    setNotes(sample.defaultNotes);
    setErrorMsg(null);
  };

  const runDiagnosis = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setSavedToast(false);
    try {
      let imageBase64 = "";
      let mimeType = "image/jpeg";

      if (selectedImagePreview.startsWith("data:")) {
        const [header, b64] = selectedImagePreview.split(",");
        imageBase64 = b64;
        const m = header.match(/:(.*?);/);
        if (m) mimeType = m[1];
      } else {
        const converted = await urlToBase64(selectedImagePreview);
        imageBase64 = converted.base64;
        mimeType = converted.mimeType;
      }

      const response = await fetch("/api/diagnose-plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          cropName,
          notes,
        }),
      });

      const data: DiagnosisResult = await response.json();
      if (!response.ok) {
        throw new Error((data as any).error || "Gagal memproses diagnosis tanaman.");
      }
      setResult(data);

      if (onSaveActivity) {
        onSaveActivity({
          category: "diagnosis_daun",
          title: `${data.diagnosisName} (${data.plantIdentified})`,
          summary: `Penyebab: ${data.pathogenOrCause}. Resep Organik: ${
            data.organicTreatment?.[0] || "-"
          }. Pemupukan: ${data.fertilizerRecommendation}`,
          cropName: data.plantIdentified,
          severity: data.severity,
        });
        setSavedToast(true);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Terjadi kesalahan saat menganalisis foto tanaman.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakDiagnosisSummary = async () => {
    if (!result || isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      const textToRead = `Hasil diagnosis untuk ${result.plantIdentified}: Terdeteksi ${result.diagnosisName} dengan tingkat keparahan ${result.severity}. Penyebab utama adalah ${result.pathogenOrCause}. Penanganan organik yang disarankan: ${result.organicTreatment.join(
        ". "
      )}. Rekomendasi pemupukan: ${result.fertilizerRecommendation}`;

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToRead }),
      });
      const data = await res.json();
      if (data.audioWavBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioWavBase64}`);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        await audio.play();
      } else {
        setIsPlayingAudio(false);
      }
    } catch {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Panel Unggah Foto & Keluhan (5 Kolom) */}
      <div className="lg:col-span-5 bg-white border border-[#CDE3C6] rounded-2xl p-6">
        <h2 className="text-xl font-bold text-[#0F3820]">
          02. Diagnosis Penyakit Daun &amp; Hama
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Unggah foto daun, batang, atau buah yang terserang hama untuk mendapatkan resep penanganan organik &amp; kimiawi.
        </p>

        {/* Pilihan Sampel Cepat */}
        <div className="mt-4">
          <span className="text-xs font-medium text-slate-500 block mb-2">
            Uji Coba dengan Foto Sampel Lapangan:
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {SAMPLE_CASES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className={`p-2 border rounded-lg text-left transition-colors cursor-pointer ${
                  selectedImagePreview === sample.imageUrl
                    ? "border-[#145A2B] bg-[#EFF8EC]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="aspect-4/3 w-full rounded overflow-hidden bg-slate-100 mb-1.5">
                  <img
                    src={sample.imageUrl}
                    alt={sample.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {sample.title}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Pratinjau Gambar Utama */}
        <div className="mt-4 relative aspect-4/3 w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
          <img
            src={selectedImagePreview}
            alt="Foto tanaman yang dianalisis"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <label className="absolute bottom-3 right-3 px-3.5 py-2 bg-[#145A2B]/95 hover:bg-[#0F4620] text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Foto Kamera / Galeri</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Form Detail Komoditas & Gejala */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Komoditas Tanaman
            </label>
            <input
              type="text"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              placeholder="Contoh: Padi Ciherang, Cabai Rawit, Jagung Manis"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#145A2B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Keluhan / Gejala di Lahan
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan umur tanaman, kondisi cuaca, atau gejala yang terlihat..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#145A2B]"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={runDiagnosis}
            disabled={isAnalyzing}
            className="w-full py-2.5 px-4 bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menganalisis Jaringan Daun &amp; Hama...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Analisis Foto Tanaman Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Panel Hasil Diagnosis Lengkap (7 Kolom) */}
      <div className="lg:col-span-7 bg-white border border-[#CDE3C6] rounded-2xl p-6">
        {isAnalyzing ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#145A2B] animate-spin mx-auto" />
            <h3 className="text-base font-bold text-slate-900">
              Sedang Memeriksa Gejala Visual Tanaman...
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Sistem mencocokkan pola bercak daun, perubahan warna klorofil, dan gejala serangan hama dengan basis data agronomi.
            </p>
          </div>
        ) : result ? (
          <div className="space-y-6">
            {savedToast && (
              <div className="p-2.5 rounded-xl bg-[#EFF8EC] border border-[#A5D6A7] text-xs font-semibold text-[#145A2B] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Hasil diagnosis telah dicatat otomatis ke menu Riwayat.</span>
              </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{result.plantIdentified}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Akurasi Identifikasi {result.confidencePercent}%
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      result.severity.toLowerCase().includes("tinggi")
                        ? "text-red-700"
                        : result.severity.toLowerCase().includes("sedang")
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    Tingkat Keparahan: {result.severity}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-[#0F3820] mt-1">
                  {result.diagnosisName}
                </h3>
                <p className="text-sm text-slate-600 mt-0.5">
                  Penyebab / Patogen:{" "}
                  <span className="font-medium text-slate-800">{result.pathogenOrCause}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={speakDiagnosisSummary}
                disabled={isPlayingAudio}
                className="px-3.5 py-2 bg-[#EFF8EC] hover:bg-[#E4F3DF] disabled:opacity-60 text-[#0F3820] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[#145A2B]" />
                <span>
                  {isPlayingAudio ? "Membacakan Resep..." : "Dengarkan Suara Penyuluh"}
                </span>
              </button>
            </div>

            {/* Gejala yang Teramati */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Gejala Fisik yang Teridentifikasi</span>
              </h4>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {result.symptomsObserved.map((sym, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-slate-400 font-mono tabular-nums text-xs mt-0.5">
                      0{idx + 1}.
                    </span>
                    <span>{sym}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Grid Penanganan Organik & Kimiawi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-[#145A2B] mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#145A2B]" />
                  <span>Pengendalian Organik &amp; Hayati</span>
                </h4>
                <ul className="space-y-2 text-sm text-slate-700">
                  {result.organicTreatment.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">
                  Penanganan Kimiawi &amp; Dosis Tepat
                </h4>
                <ul className="space-y-2 text-sm text-slate-700">
                  {result.chemicalTreatment.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Rekomendasi Pemupukan & Pencegahan */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Rekomendasi Pemupukan Pemulihan
                </h4>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                  {result.fertilizerRecommendation}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Langkah Pencegahan Musim Tanam
                </h4>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  {result.preventionTips.map((tip, idx) => (
                    <span key={idx}>
                      {idx + 1}. {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
