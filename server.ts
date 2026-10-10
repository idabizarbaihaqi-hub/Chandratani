import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function isQuotaError(error: any): boolean {
  const msg = String(error?.message || error || "");
  return (
    error?.status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota")
  );
}

export interface RichAIResponsePayload {
  summaryTitle: string;
  summaryText: string;
  mainExplanation: string;
  visualImageKey:
    | "none"
    | "chili_yellow"
    | "rice_blight"
    | "npk_deficiency"
    | "tomato_guide"
    | "rice_harvest";
  visualImageCaption?: string;
  infoCards: {
    icon: "leaf" | "droplets" | "sun" | "thermometer" | "shield" | "clock" | "chart";
    title: string;
    content: string;
  }[];
  actionSteps: string[];
  processDiagram?: {
    title: string;
    steps: { label: string; detail: string }[];
  };
  comparisonTable?: {
    title: string;
    headers: string[];
    rows: string[][];
  };
  dataChart?: {
    title: string;
    subtitle: string;
    unit: string;
    type: "bar" | "line";
    isIllustration: boolean;
    items: { label: string; value: number; note?: string }[];
  };
  warningNote?: string;
  nextRecommendation: string;
  quotaNotice?: string;
}

function buildStructuredAgronomyFallback(
  question?: string,
  hasUploadedImage?: boolean
): RichAIResponsePayload {
  const q = (question || "").toLowerCase();

  // 1. Daun Cabai Menguning / Hama Cabai
  if (q.includes("cabai") || (q.includes("kuning") && !q.includes("padi"))) {
    return {
      summaryTitle: "Diagnosis & Penanganan Daun Cabai Menguning / Hama Cabai",
      summaryText:
        "Gejala daun cabai menguning dan mengeriting umumnya disebabkan oleh serangan vektor Kutu Kebul (pembawa Virus Gemini/Begomovirus), serangan Thrips/Tungau, atau kekurangan unsur hara Nitrogen & Magnesium.",
      mainExplanation:
        "Untuk memastikan penyebabnya di lapangan, periksa bagian bawah helai daun dan pucuk tanaman:\n• Jika warna kuning terang disertai daun menebal dan melengkung ke atas, kemungkinan besar terinfeksi **Virus Gemini** yang ditularkan kutu kebul (*Bemisia tabaci*).\n• Jika kuning pucat dimulai dari daun tua di bagian bawah, tanaman mengalami **defisiensi Nitrogen (N) atau Magnesium (Mg)**.",
      visualImageKey: "chili_yellow",
      visualImageCaption:
        "Ilustrasi pembanding: Gejala mosaik kuning & keriting daun pada tanaman cabai merah di lapangan.",
      infoCards: [
        {
          icon: "leaf",
          title: "Gejala Utama",
          content:
            "Helai daun muda menguning cerah (mosaik), tepi daun mengeriting, dan ruas batang memendek.",
        },
        {
          icon: "shield",
          title: "Kemungkinan Penyebab",
          content:
            "Vektor Kutu Kebul (Bemisia tabaci), Thrips parvispinus, atau keasaman tanah (pH < 5,5) yang menghambat serapan hara.",
        },
        {
          icon: "clock",
          title: "Waktu Semprot Efektif",
          content:
            "Lakukan penyemprotan di pagi hari (06.30–08.30) atau sore hari (15.30–17.30) ke arah balik daun.",
        },
      ],
      actionSteps: [
        "Pasang perangkap likat kuning (Yellow Sticky Trap) sebanyak 40 buah/hektar setinggi pucuk tanaman untuk menekan populasi kutu kebul.",
        "Semprotkan pestisida nabati ekstrak daun mimba + bawang putih (5 ml/liter air) setiap 4–5 hari sekali.",
        "Jika serangan meluas, rotasikan insektisida berbahan aktif Abamektin (0,5 ml/L) atau Imidakloprid sesuai dosis anjuran.",
        "Berikan pupuk susulan Kalsium Nitrat (CaNO3) dan pupuk mikro (Mg, Boron) untuk memperkuat dinding sel daun baru.",
      ],
      processDiagram: {
        title: "Alur Penanganan Terpadu Tanaman Cabai",
        steps: [
          {
            label: "Identifikasi Gejala Daun",
            detail: "Periksa pucuk muda & balik daun dari kutu kebul/thrips",
          },
          {
            label: "Isolasi & Sanitasi",
            detail: "Pangkas pucuk sakit parah & bersihkan gulma inang",
          },
          {
            label: "Pengendalian Vektor",
            detail: "Pasang Yellow Trap & semprot agens hayati/insektisida",
          },
          {
            label: "Pemulihan Nutrisi",
            detail: "Kocor Kalsium, Kalium & Asam Amino setiap 7 hari",
          },
        ],
      },
      warningNote:
        "Jangan menyemprotkan pupuk daun berkadar Nitrogen (Urea/ZA) tinggi saat tanaman sedang terserang virus atau kutu, karena pucuk yang terlalu lunak akan semakin disukai hama penusuk-pengisap.",
      nextRecommendation:
        "Gunakan fitur LIVE VIDEO CALL dan arahkan kamera ke bagian bawah daun cabai Anda agar Pak Chandra dapat memeriksa keberadaan kutu kebul secara langsung.",
    };
  }

  // 2. Budidaya / Menanam / Memangkas Tomat
  if (q.includes("tomat") || q.includes("pangkas") || q.includes("menanam")) {
    return {
      summaryTitle: "Panduan Bertahap Budidaya & Pemangkasan Tanaman Tomat",
      summaryText:
        "Keberhasilan menanam tomat dari awal hingga panen ditentukan oleh penyemaian benih sehat, pengolahan bedengan berkapur dolomit, pemasangan lanjaran (ajir), dan pemangkasan tunas air (wiwilan) secara rutin.",
      mainExplanation:
        "Tanaman tomat memerlukan sirkulasi udara yang baik dan fokus nutrisi ke pembungaan. Pemangkasan **tunas air** (tunas yang tumbuh di ketiak antara batang utama dan cabang daun) wajib dilakukan agar buah berukuran besar dan tidak mudah terserang jamur busuk daun.",
      visualImageKey: "tomato_guide",
      visualImageCaption:
        "Ilustrasi tahapan pemasangan ajir bambu, pemangkasan tunas air (wiwilan), hingga pemanenan buah tomat.",
      infoCards: [
        {
          icon: "sun",
          title: "Syarat Tumbuh & pH",
          content:
            "Penyinaran matahari penuh minimal 6–8 jam/hari dengan pH tanah ideal 6,0–6,8.",
        },
        {
          icon: "droplets",
          title: "Manajemen Pengairan",
          content:
            "Jaga kelembapan tanah merata; hindari penyiraman berlebihan saat buah mulai matang agar kulit buah tidak pecah.",
        },
      ],
      actionSteps: [
        "Persemaian (0–21 HSS): Rendam benih dengan air hangat + agens hayati Trichoderma, semai di media kompos halus dan tanah (1:1).",
        "Persiapan Lahan: Buat bedengan tinggi 30–40 cm, berikan pupuk kandang matang 15–20 ton/ha dan Dolomit 1,5 ton/ha, lalu tutup mulsa perak-hitam.",
        "Pindah Tanam & Pemasangan Ajir (7–14 HST): Tanam bibit berdaun 4–5 helai pada sore hari dan pasang ajir bambu setinggi 150 cm.",
        "Pemangkasan Tunas Air (21–45 HST): Pangkas tunas ketiak di bawah cabang utama pertama menggunakan tangan bersih pada pagi hari yang cerah agar luka cepat kering.",
      ],
      processDiagram: {
        title: "Siklus Budidaya Tanaman Tomat (0 – 90 HST)",
        steps: [
          { label: "Persemaian Benih", detail: "18–21 hari di tray semai teduh" },
          { label: "Penanaman Bibit", detail: "Jarak tanam 50 x 60 cm di bedengan" },
          { label: "Pertumbuhan & Wiwil", detail: "Pasang ajir & pangkas tunas air rutin" },
          { label: "Pembungaan & Pembuahan", detail: "Pupuk tinggi Kalium & Kalsium" },
          { label: "Panen Bertahap", detail: "Mulai umur 70–85 HST saat buah merah 80%" },
        ],
      },
      warningNote:
        "Hindari memangkas tunas air saat hujan atau kondisi tanaman masih basah embun tebal karena luka pangkasan mudah dimasuki bakteri layu (Ralstonia).",
      nextRecommendation:
        "Siapkan pupuk Kalsium saat tanaman memasuki fase berbunga (30 HST) untuk mencegah penyakit busuk ujung buah (Blossom End Rot).",
    };
  }

  // 3. Perbedaan Kekurangan Nitrogen (N) dan Kalium (K)
  if (q.includes("nitrogen") || q.includes("kalium") || q.includes("perbedaan")) {
    return {
      summaryTitle: "Cara Membedakan Defisiensi Nitrogen (N) vs Kalium (K)",
      summaryText:
        "Kedua unsur ini bersifat mobil (mudah berpindah), sehingga gejala kekurangannya sama-sama muncul pertama kali pada DAUN TUA (bagian bawah), namun pola perubahan warnanya sangat berbeda.",
      mainExplanation:
        "• **Kekurangan Nitrogen (N):** Warna kuning pucat menyebar merata dari **ujung daun membentuk huruf V** menuju pangkal tulang daun tengah, disertai pertumbuhan tanaman yang kerdil.\n• **Kekurangan Kalium (K):** Warna kuning hingga coklat terbakar (nekrosis) muncul khusus di **sepanjang tepi/pinggiran luar daun**, sementara bagian tengah daun masih tampak hijau.",
      visualImageKey: "npk_deficiency",
      visualImageCaption:
        "Ilustrasi perbandingan visual antara daun sehat, kekurangan Nitrogen (kuning merata dari ujung), dan kekurangan Kalium (tepi daun menguning/terbakar).",
      infoCards: [
        {
          icon: "leaf",
          title: "Ciri Kunci Nitrogen (N)",
          content:
            "Kuning pucat merata di tengah/ujung daun tua, batang kurus, anakan sedikit.",
        },
        {
          icon: "shield",
          title: "Ciri Kunci Kalium (K)",
          content:
            "Pinggir daun tua menguning lalu mengering seperti terbakar, batang mudah rebah.",
        },
      ],
      actionSteps: [
        "Ambil 2–3 sampel daun bagian bawah (daun tua) dan perhatikan apakah kuning dimulai dari pinggir luar (Kalium) atau merata dari ujung tengah (Nitrogen).",
        "Jika kekurangan Nitrogen: Berikan pupuk Urea atau ZA secara terukur saat tanah lembap.",
        "Jika kekurangan Kalium: Aplikasikan pupuk KCl (MOP) atau ZK, serta tambahkan Kalium cair melalui semprot daun saat fase generatif.",
      ],
      comparisonTable: {
        title: "Tabel Perbandingan Defisiensi Nitrogen (N) dan Kalium (K)",
        headers: ["Aspek Pengamatan", "Kekurangan Nitrogen (N)", "Kekurangan Kalium (K)"],
        rows: [
          [
            "Pola Warna Daun Tua",
            "Kuning pucat merata dari ujung membentuk huruf V",
            "Menguning & coklat terbakar di tepi/pinggiran daun",
          ],
          [
            "Kondisi Batang",
            "Kurus, kerdil, dan pertumbuhan lambat",
            "Lemah, ruas pendek, tanaman mudah rebah",
          ],
          [
            "Dampak pada Panen",
            "Jumlah anakan/cabang sedikit, ukuran daun kecil",
            "Buah/bulir hampa, ukuran kecil, rentan terserang jamur",
          ],
          [
            "Pupuk Koreksi Utama",
            "Urea (46% N) atau ZA (21% N)",
            "KCl / MOP (60% K2O) atau NPK Tinggi K",
          ],
        ],
      },
      warningNote:
        "Pastikan pH tanah berada di kisaran 6,0–6,8 terlebih dahulu. Pada tanah asam (pH < 5,5), meskipun pupuk N dan K diberikan banyak, akar tetap tidak mampu menyerapnya.",
      nextRecommendation:
        "Anda dapat melampirkan foto daun tanaman Anda melalui tombol kamera di kiri kolom chat agar dianalisis lebih spesifik.",
    };
  }

  // 4. Menghitung Biaya Pupuk per Hektare / Waktu Pemupukan
  if (q.includes("biaya") || q.includes("pupuk") || q.includes("hektar")) {
    return {
      summaryTitle: "Perhitungan Dosis & Estimasi Biaya Pupuk per Hektare",
      summaryText:
        "Kebutuhan pupuk standar untuk 1 hektare padi sawah (pola pemupukan berimbang) membutuhkan sekitar 200 kg Urea, 300 kg NPK Phonska, 50 kg KCl, dan 1.000 kg Pupuk Organik.",
      mainExplanation:
        "Pemupukan yang tepat waktu dibagi menjadi **3 tahap aplikasi** sesuai fase fisiologis tanaman agar pupuk tidak terbuang menguap atau hanyut terbawa air irigasi.",
      visualImageKey: "none",
      infoCards: [
        {
          icon: "clock",
          title: "Tahap 1 (7–10 HST)",
          content: "30% Urea + 50% NPK Phonska untuk memacu perakaran dan anakan awal.",
        },
        {
          icon: "clock",
          title: "Tahap 2 (21–25 HST)",
          content: "40% Urea + 50% NPK Phonska saat fase anakan aktif maksimum.",
        },
        {
          icon: "clock",
          title: "Tahap 3 (38–42 HST)",
          content: "30% Urea + 100% KCl menjelang keluar malai (bunting) agar bulir bernas.",
        },
      ],
      actionSteps: [
        "Ukur luas lahan riil terlebih dahulu (1 Hektare = 10.000 m²; jika lahan 0,5 Ha maka bagi dua seluruh takaran).",
        "Keringkan air sawah hingga kondisi macak-macak (tinggi air 1–2 cm) sebelum menabur pupuk.",
        "Taburkan pupuk pada pagi hari (08.00–10.00) saat embun di daun sudah kering agar butiran pupuk tidak menempel dan membakar daun.",
      ],
      comparisonTable: {
        title: "Ilustrasi Estimasi Kebutuhan & Biaya Pupuk Padi per 1 Hektare",
        headers: ["Jenis Pupuk", "Dosis / Ha", "Estimasi Harga / Kg", "Subtotal Biaya"],
        rows: [
          ["Pupuk Organik / Petroganik", "1.000 Kg", "Rp 1.500", "Rp 1.500.000"],
          ["Urea (46% N)", "200 Kg", "Rp 2.700", "Rp 540.000"],
          ["NPK Phonska (15-15-15)", "300 Kg", "Rp 2.800", "Rp 840.000"],
          ["KCl / Kalium", "50 Kg", "Rp 9.500", "Rp 475.000"],
          ["Total Estimasi per Hektare", "1.550 Kg", "-", "Rp 3.355.000"],
        ],
      },
      dataChart: {
        title: "Ilustrasi Komposisi Biaya Pupuk per Hektare (Rupiah)",
        subtitle: "Simulasi alokasi anggaran pupuk dasar & susulan untuk 1 Ha lahan",
        unit: "Ribu Rp",
        type: "bar",
        isIllustration: true,
        items: [
          { label: "Organik (1 Ton)", value: 1500, note: "Rp 1,50 Juta" },
          { label: "NPK Phonska (300kg)", value: 840, note: "Rp 840 Ribu" },
          { label: "Urea (200kg)", value: 540, note: "Rp 540 Ribu" },
          { label: "KCl Tambahan (50kg)", value: 475, note: "Rp 475 Ribu" },
        ],
      },
      warningNote:
        "Harga pupuk di atas merupakan ilustrasi rata-rata (kombinasi subsidi/non-subsidi). Sesuaikan dengan harga kios resmi RDKK di desa Anda.",
      nextRecommendation:
        "Gunakan Bagan Warna Daun (BWD) pada umur 25–35 HST untuk menyesuaikan apakah dosis Urea perlu ditambah atau dikurangi.",
    };
  }

  // 5. Meningkatkan Hasil Panen / Daun Padi Menguning / Default
  return {
    summaryTitle: "Strategi Meningkatkan Hasil Panen Padi & Kesehatan Daun",
    summaryText:
      "Peningkatan produktivitas gabah (GKP) hingga 15–25% dicapai melalui penggunaan benih bersertifikat, pengairan berselang (intermittent irrigation), pemupukan berimbang tepat waktu, dan perlindungan daun bendera.",
    mainExplanation:
      hasUploadedImage
        ? "Berdasarkan foto tanaman yang Anda lampirkan, perhatikan kondisi bercak dan perubahan warna pada helai daun. Diagnosis melalui foto memerlukan konfirmasi langsung terhadap kondisi perakaran, kelembapan tanah, dan riwayat pemupukan 2 minggu terakhir."
        : "Jika daun padi tampak menguning atau terdapat bercak coklat sebelum waktunya, hal tersebut dapat mengurangi kemampuan fotosintesis **daun bendera** dalam mengisi bulir gabah.",
    visualImageKey: q.includes("kuning") || q.includes("bercak") ? "rice_blight" : "rice_harvest",
    visualImageCaption:
      q.includes("kuning") || q.includes("bercak")
        ? "Ilustrasi gejala bercak daun coklat dan klorosis pada helai daun padi sawah."
        : "Ilustrasi pengelolaan terpadu lahan sawah untuk menghasilkan bulir gabah bernas berkualitas tinggi.",
    infoCards: [
      {
        icon: "droplets",
        title: "Pengairan Berselang",
        content:
          "Metode basah-kering (AWD) merangsang akar tumbuh dalam dan meningkatkan jumlah anakan produktif.",
      },
      {
        icon: "leaf",
        title: "Nutrisi Daun Bendera",
        content:
          "Tambahan Kalium (K) dan Silika pada 40–55 HST menjaga daun bendera tetap hijau tegak dan bulir terisi penuh.",
      },
      {
        icon: "chart",
        title: "Potensi Kenaikan Hasil",
        content:
          "Perlakuan kompos jerami + NPK berimbang terbukti meningkatkan bobot 1.000 bulir gabah.",
      },
    ],
    actionSteps: [
      "Gunakan sistem tanam Jajar Legowo (2:1 atau 4:1) agar seluruh barisan tanaman mendapat sinar matahari optimal.",
      "Terapkan pengairan berselang: genangi 3–5 cm lalu biarkan air surut alami hingga tanah macak-macak sebelum diairi kembali.",
      "Semprotkan pupuk pelengkap cair tinggi Kalium & Fosfat pada fase bunting (45 HST) dan setelah keluar malai merata (65 HST).",
      "Kendalikan hama penggerek batang (sundep/beluk) dan wereng coklat sejak dini menggunakan agens hayati Beauveria bassiana.",
    ],
    dataChart: {
      title: "Ilustrasi Perbandingan Hasil Panen Berdasarkan Perlakuan (Ton GKP/Ha)",
      subtitle: "Data contoh simulasi rata-rata hasil panen padi sawah per hektare",
      unit: "Ton/Ha",
      type: "bar",
      isIllustration: true,
      items: [
        { label: "Cara Konvensional", value: 5.4, note: "Pupuk tunggal Urea dominan" },
        { label: "NPK Berimbang", value: 6.5, note: "Urea + Phonska 3 tahap" },
        { label: "Terpadu + Organik + Jajar Legowo", value: 7.6, note: "Kompos + NPK + Pengairan Berselang" },
      ],
    },
    processDiagram: {
      title: "Tahapan Kunci Pengawalan Panen Padi Berkualitas",
      steps: [
        { label: "Fase Vegetatif (0–35 HST)", detail: "Fokus pembentukan akar & anakan produktif" },
        { label: "Fase Primordia (35–50 HST)", detail: "Pembentukan bakal malai & kecukupan Kalium" },
        { label: "Fase Pengisian Bulir (55–80 HST)", detail: "Jaga kesehatan daun bendera dari jamur/wereng" },
        { label: "Panen Tepat Waktu (95–110 HST)", detail: "Panen saat 90–95% gabah menguning bernas" },
      ],
    },
    warningNote:
      "Hindari mengeringkan air sawah secara mendadak saat tanaman tepat berada pada fase pembungaan (keluar malai), karena kekurangan air pada fase ini menyebabkan bulir gabah hampa.",
    nextRecommendation:
      "Tekan tombol LIVE VIDEO CALL di bagian atas chat jika Anda ingin memperlihatkan kondisi daun atau malai padi Anda secara langsung kepada Pak Chandra.",
  };
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: "25mb" }));

  // 1. Endpoint Live Chat AI Terstruktur (Mendukung Teks, Gambar, Kartu Info, Tabel, Grafik, Diagram)
  app.post("/api/chat-assistant", async (req, res) => {
    const { message, imageBase64, mimeType, history } = req.body;

    const systemInstruction = `Anda adalah 'Pak Chandra', Asisten & Penyuluh Pertanian Ahli di aplikasi CHANDRA Tani Desaku.
Jawab pertanyaan petani dalam Bahasa Indonesia yang ramah, jelas, akurat, dan terstruktur.

KETENTUAN PENTING:
1. Pilih elemen visual (infoCards, processDiagram, comparisonTable, dataChart, visualImageKey) HANYA jika benar-benar relevan dan membantu menjawab pertanyaan petani.
2. Untuk visualImageKey, pilih salah satu dari nilai berikut HANYA jika cocok dengan topik:
   - "chili_yellow": jika membahas daun cabai menguning, keriting, virus gemini, kutu kebul, atau hama cabai.
   - "tomato_guide": jika membahas cara menanam tomat, pemangkasan tunas air/wiwilan, atau perawatan tomat.
   - "npk_deficiency": jika membahas perbedaan kekurangan nutrisi/unsur hara seperti Nitrogen (N), Fosfor (P), atau Kalium (K).
   - "rice_blight": jika membahas daun padi menguning, bercak coklat, hawar daun, atau penyakit padi.
   - "rice_harvest": jika membahas peningkatan hasil panen padi, pengolahan lahan sawah, atau jadwal pemupukan padi.
   - "none": jika pertanyaan umum yang tidak membutuhkan gambar ilustrasi di atas.
3. Jika menyertakan dataChart (grafik), pastikan angkanya masuk akal secara agronomis, sertakan satuan (unit), dan set isIllustration: true jika menggunakan angka simulasi/contoh.
4. Jika petani mengirim foto tanaman, analisis gejala yang tampak pada foto dengan jujur dan jelaskan keterbatasan diagnosis visual (sarankan pemeriksaan lanjutan di lapangan).`;

    try {
      const ai = getGenAIClient();
      const parts: any[] = [];

      if (imageBase64 && mimeType) {
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        });
      }

      const historyContext =
        Array.isArray(history) && history.length > 0
          ? "Riwayat percakapan singkat sebelumnya:\n" +
            history
              .slice(-4)
              .map((h: any) => `${h.role === "user" ? "Petani" : "Pak Chandra"}: ${h.text}`)
              .join("\n") +
            "\n\n"
          : "";

      parts.push({
        text: `${historyContext}Pertanyaan Petani saat ini: "${
          message || "Tolong periksa kondisi foto tanaman ini dan berikan saran penanganan."
        }"`,
      });

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          summaryTitle: {
            type: Type.STRING,
            description: "Judul kesimpulan singkat jawaban",
          },
          summaryText: {
            type: Type.STRING,
            description: "Ringkasan eksekutif 1-2 kalimat yang menjawab inti pertanyaan",
          },
          mainExplanation: {
            type: Type.STRING,
            description: "Penjelasan utama yang terstruktur (boleh menggunakan poin atau penekanan)",
          },
          visualImageKey: {
            type: Type.STRING,
            description:
              "Pilih satu: 'none', 'chili_yellow', 'rice_blight', 'npk_deficiency', 'tomato_guide', atau 'rice_harvest'",
          },
          visualImageCaption: {
            type: Type.STRING,
            description: "Keterangan gambar ilustrasi jika visualImageKey bukan 'none'",
          },
          infoCards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                icon: {
                  type: Type.STRING,
                  description:
                    "Pilih: 'leaf', 'droplets', 'sun', 'thermometer', 'shield', 'clock', atau 'chart'",
                },
                title: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ["icon", "title", "content"],
            },
          },
          actionSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Langkah-langkah praktis yang dapat dilakukan petani",
          },
          processDiagram: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    detail: { type: Type.STRING },
                  },
                  required: ["label", "detail"],
                },
              },
            },
          },
          comparisonTable: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              headers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
          dataChart: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              unit: { type: Type.STRING },
              type: { type: Type.STRING, description: "'bar' atau 'line'" },
              isIllustration: { type: Type.BOOLEAN },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.NUMBER },
                    note: { type: Type.STRING },
                  },
                  required: ["label", "value"],
                },
              },
            },
          },
          warningNote: {
            type: Type.STRING,
            description: "Peringatan penting atau hal yang perlu diperiksa di lapangan",
          },
          nextRecommendation: {
            type: Type.STRING,
            description: "Rekomendasi langkah berikutnya",
          },
        },
        required: [
          "summaryTitle",
          "summaryText",
          "mainExplanation",
          "visualImageKey",
          "infoCards",
          "actionSteps",
          "nextRecommendation",
        ],
      };

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
          },
        });
      } catch (firstErr: any) {
        if (isQuotaError(firstErr)) {
          response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema,
            },
          });
        } else {
          throw firstErr;
        }
      }

      const rawText = response.text || "{}";
      const parsed: RichAIResponsePayload = JSON.parse(rawText.trim());
      return res.json(parsed);
    } catch (error: any) {
      if (isQuotaError(error)) {
        const fallback = buildStructuredAgronomyFallback(message, Boolean(imageBase64));
        return res.status(200).json(fallback);
      }
      const fallback = buildStructuredAgronomyFallback(message, Boolean(imageBase64));
      return res.status(200).json(fallback);
    }
  });

  // 2. Endpoint Diagnosis Tanaman & Hama (Tetap Dipertahankan)
  app.post("/api/diagnose-plant", async (req, res) => {
    try {
      const { imageBase64, mimeType, cropName, notes } = req.body;
      const ai = getGenAIClient();

      const parts: any[] = [];
      if (imageBase64 && mimeType) {
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        });
      }

      const promptText = `Anda adalah Penyuluh Pertanian Ahli dari aplikasi CHANDRA TANI DESAKU di Indonesia.
Analisis kondisi tanaman berikut${cropName ? ` (Komoditas: ${cropName})` : ""}.
${notes ? `Catatan keluhan petani: "${notes}"` : ""}
Berikan diagnosis akurat mengenai penyakit/hama/defisiensi unsur hara, tingkat keparahan, penyebab utama, langkah penanganan organik/nabati, langkah penanganan kimiawi terukur (beserta dosis aman), dan jadwal pencegahan.`;

      parts.push({ text: promptText });

      const schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plantIdentified: { type: Type.STRING },
            diagnosisName: { type: Type.STRING },
            pathogenOrCause: { type: Type.STRING },
            severity: { type: Type.STRING },
            confidencePercent: { type: Type.NUMBER },
            symptomsObserved: { type: Type.ARRAY, items: { type: Type.STRING } },
            organicTreatment: { type: Type.ARRAY, items: { type: Type.STRING } },
            chemicalTreatment: { type: Type.ARRAY, items: { type: Type.STRING } },
            fertilizerRecommendation: { type: Type.STRING },
            preventionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            "plantIdentified",
            "diagnosisName",
            "pathogenOrCause",
            "severity",
            "confidencePercent",
            "symptomsObserved",
            "organicTreatment",
            "chemicalTreatment",
            "fertilizerRecommendation",
            "preventionTips",
          ],
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: { parts },
        config: schemaConfig,
      });

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText.trim());
      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({
        error:
          error?.message ||
          "Gagal menganalisis gambar tanaman. Silakan coba kembali.",
      });
    }
  });

  // 3. Endpoint Rekomendasi Agronomi Legacy (Tetap Dipertahankan untuk Kompatibilitas)
  app.post("/api/agronomy-advisory", async (req, res) => {
    const { question, cropType } = req.body;
    const structured = buildStructuredAgronomyFallback(question, false);
    res.json({
      advice: `${structured.summaryTitle}\n\n${structured.summaryText}\n\n${structured.mainExplanation}\n\nLangkah Tindakan:\n• ${structured.actionSteps.join(
        "\n• "
      )}`,
      sources: [],
      structured,
    });
  });

  // 4. Endpoint Text-to-Speech (TTS)
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Teks tidak boleh kosong" });
      }
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.slice(0, 700),
                speechMetadata: {
                  style: "Ramah, jelas, berwibawa seperti penyuluh pertanian desa",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(500).json({ error: "Gagal menghasilkan suara." });
      }
      res.json({ audioWavBase64: base64Audio });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Gagal memuat audio TTS." });
    }
  });

  // 5. WebSocket Server untuk Gemini Live API (Suara & Kamera Real-time)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/ws/live-tani") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket) => {
    let sessionPromise: Promise<any> | null = null;
    let isClosed = false;

    try {
      const ai = getGenAIClient();
      sessionPromise = ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            "Anda adalah 'Pak Chandra', Penyuluh Pertanian Lapangan (PPL) ahli di aplikasi CHANDRA Tani Desaku. " +
            "Bicara dalam Bahasa Indonesia yang ramah, santun, jelas, dan membumi untuk petani desa. " +
            "Anda dapat melihat kamera petani secara langsung (daun padi, cabai, jagung, bawang, tanah, pupuk, hama) dan mendengar keluhan mereka. " +
            "Berikan diagnosis langsung, takaran pupuk (Urea, NPK Phonska, ZA, KCl, kompos organik), cara mengatasi hama wereng/ulat/jamur/virus, serta strategi panen yang menguntungkan.",
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: "audio",
                    audio: part.inlineData.data,
                  })
                );
              }
            }

            const inputTranscript = (message.serverContent as any)?.inputTranscription?.text;
            if (inputTranscript) {
              clientWs.send(
                JSON.stringify({
                  type: "input_transcript",
                  text: inputTranscript,
                })
              );
            }

            const outputTranscript = (message.serverContent as any)?.outputTranscription?.text;
            if (outputTranscript) {
              clientWs.send(
                JSON.stringify({
                  type: "output_transcript",
                  text: outputTranscript,
                })
              );
            }

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turn_complete" }));
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  message:
                    err?.message ||
                    "Koneksi suara/video dua arah dengan penyuluh terputus sementara.",
                })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "status", status: "closed" }));
            }
          },
        },
      });

      const session = await sessionPromise;
      if (isClosed) {
        session.close();
        return;
      }
    } catch (err: any) {
      console.error("Failed to connect to Gemini Live:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: "error",
            message:
              err?.message ||
              "Preview kamera lokal aktif, namun koneksi dua arah ke server penyuluh belum berhasil dihubungkan.",
          })
        );
      }
    }

    clientWs.on("message", async (raw) => {
      if (!sessionPromise) return;
      try {
        const msg = JSON.parse(raw.toString());
        const session = await sessionPromise;

        if (msg.type === "audio" && msg.data) {
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (msg.type === "video" && msg.data) {
          session.sendRealtimeInput({
            video: {
              data: msg.data,
              mimeType: "image/jpeg",
            },
          });
        } else if (msg.type === "text" && msg.text) {
          session.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (e) {
        console.error("Error forwarding realtime input:", e);
      }
    });

    clientWs.on("close", async () => {
      isClosed = true;
      if (sessionPromise) {
        try {
          const session = await sessionPromise;
          session.close();
        } catch {
          // ignore
        }
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`CHANDRA TANI DESAKU Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
