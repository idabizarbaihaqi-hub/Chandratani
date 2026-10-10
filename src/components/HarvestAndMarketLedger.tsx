import React, { useEffect, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Calculator, Plus, Trash2, Search, ShieldCheck } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";

export interface HarvestRecord {
  id: string;
  date: string;
  farmerName: string;
  blockName: string;
  commodity: string;
  weightKg: number;
  pricePerKg: number;
  buyerStatus: string;
}

export const INITIAL_HARVESTS: HarvestRecord[] = [
  {
    id: "local-h-1",
    date: "2026-10-09",
    farmerName: "Pak Hendra",
    blockName: "Blok A1 Sawah Utara",
    commodity: "Gabah Kering Panen (GKP)",
    weightKg: 4250,
    pricePerKg: 6800,
    buyerStatus: "Terjual ke Lumbung Desa",
  },
  {
    id: "local-h-2",
    date: "2026-10-08",
    farmerName: "Bu Sari",
    blockName: "Blok B2 Kebun Tengah",
    commodity: "Cabai Merah Keriting",
    weightKg: 380,
    pricePerKg: 42000,
    buyerStatus: "Terjual ke Pasar Induk",
  },
  {
    id: "local-h-3",
    date: "2026-10-07",
    farmerName: "Pak Wahyu",
    blockName: "Blok C3 Tegal Selatan",
    commodity: "Jagung Pipil Kering",
    weightKg: 2900,
    pricePerKg: 5400,
    buyerStatus: "Siap Angkut Koperasi",
  },
  {
    id: "local-h-4",
    date: "2026-10-05",
    farmerName: "Pak Slamet",
    blockName: "Blok A2 Sawah Barat",
    commodity: "Bawang Merah Brebes",
    weightKg: 620,
    pricePerKg: 29500,
    buyerStatus: "Terjual ke Pasar Induk",
  },
];

const MARKET_PRICES = [
  { commodity: "Gabah Kering Panen (GKP)", unit: "Kg", price: 6800, change: "+Rp 150" },
  { commodity: "Beras Medium Desa", unit: "Kg", price: 13200, change: "Stabil" },
  { commodity: "Cabai Merah Keriting", unit: "Kg", price: 42000, change: "+Rp 2.500" },
  { commodity: "Cabai Rawit Merah", unit: "Kg", price: 48500, change: "+Rp 1.800" },
  { commodity: "Bawang Merah Lokal", unit: "Kg", price: 29500, change: "-Rp 500" },
  { commodity: "Jagung Pipil Kering", unit: "Kg", price: 5400, change: "+Rp 100" },
];

interface HarvestAndMarketLedgerProps {
  currentUser?: FirebaseUser | null;
  cloudHarvests?: HarvestRecord[];
  onOpenAuth?: () => void;
}

export default function HarvestAndMarketLedger({
  currentUser,
  cloudHarvests,
  onOpenAuth,
}: HarvestAndMarketLedgerProps) {
  const [localHarvests, setLocalHarvests] = useState<HarvestRecord[]>(INITIAL_HARVESTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [blockName, setBlockName] = useState("Blok A1 Sawah Utara");
  const [commodity, setCommodity] = useState("Gabah Kering Panen (GKP)");
  const [weightKg, setWeightKg] = useState<number>(1000);
  const [pricePerKg, setPricePerKg] = useState<number>(6800);
  const [isSaving, setIsSaving] = useState(false);

  // Kalkulator Dosis Pupuk
  const [calcCrop, setCalcCrop] = useState<"padi" | "cabai" | "jagung">("padi");
  const [calcAreaHa, setCalcAreaHa] = useState<number>(1.5);

  useEffect(() => {
    if (currentUser?.displayName && !farmerName) {
      setFarmerName(currentUser.displayName);
    }
  }, [currentUser, farmerName]);

  const activeHarvestList =
    currentUser && cloudHarvests && cloudHarvests.length > 0
      ? cloudHarvests
      : localHarvests;

  const handleAddHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerName.trim() || weightKg <= 0 || pricePerKg <= 0) return;

    const dateStr = new Date().toISOString().split("T")[0];

    if (currentUser) {
      setIsSaving(true);
      try {
        await addDoc(collection(db, "harvest_records"), {
          userId: currentUser.uid,
          date: dateStr.slice(0, 30),
          farmerName: farmerName.trim().slice(0, 100),
          blockName: (blockName.trim() || "Blok A1").slice(0, 120),
          commodity: commodity.slice(0, 120),
          weightKg: Math.max(1, Math.min(1000000, Number(weightKg))),
          pricePerKg: Math.max(0, Math.min(10000000, Number(pricePerKg))),
          buyerStatus: "Tercatat Permanen di Cloud Desa",
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "harvest_records");
      } finally {
        setIsSaving(false);
      }
    } else {
      const newEntry: HarvestRecord = {
        id: `local-${Date.now()}`,
        date: dateStr,
        farmerName: farmerName.trim(),
        blockName,
        commodity,
        weightKg,
        pricePerKg,
        buyerStatus: "Tercatat di Memori Sesi",
      };
      setLocalHarvests([newEntry, ...localHarvests]);
    }
  };

  const handleDeleteHarvest = async (id: string) => {
    if (currentUser && !id.startsWith("local-")) {
      try {
        await deleteDoc(doc(db, "harvest_records", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `harvest_records/${id}`);
      }
    } else {
      setLocalHarvests((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const filteredHarvests = activeHarvestList.filter(
    (h) =>
      h.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.commodity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.blockName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = filteredHarvests.reduce(
    (acc, item) => acc + item.weightKg * item.pricePerKg,
    0
  );
  const totalWeightKg = filteredHarvests.reduce((acc, item) => acc + item.weightKg, 0);

  // Perhitungan Kalkulator Pupuk Standar Penyuluhan
  const fertilizerDose = {
    padi: {
      urea: Math.round(calcAreaHa * 225),
      npkPhonska: Math.round(calcAreaHa * 300),
      organik: Math.round(calcAreaHa * 2000),
      schedule: "3 tahap: 7 HST (Dasar), 21 HST (Susulan 1), dan 40 HST (Susulan 2)",
    },
    cabai: {
      urea: Math.round(calcAreaHa * 150),
      npkPhonska: Math.round(calcAreaHa * 450),
      organik: Math.round(calcAreaHa * 5000),
      schedule: "Pupuk dasar bedengan + kocor NPK rutin setiap 10 hari sekali",
    },
    jagung: {
      urea: Math.round(calcAreaHa * 300),
      npkPhonska: Math.round(calcAreaHa * 350),
      organik: Math.round(calcAreaHa * 1500),
      schedule: "2 tahap: 10 HST dan 30 HST ditugal di samping batang",
    },
  }[calcCrop];

  return (
    <div className="space-y-6">
      {/* Baris Atas: Harga Pasar Desa & Kalkulator Pupuk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Pantauan Harga Komoditas (7 Kolom) */}
        <div className="lg:col-span-7 bg-white border border-[#CDE3C6] rounded-2xl p-6">
          <div className="pb-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-[#0F3820]">
              04. Pantauan Harga Komoditas Tingkat Petani Desa
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Harga acuan pembelian koperasi tani &amp; tengkulak pasar induk hari ini
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Komoditas</th>
                  <th className="py-2.5 px-4">Satuan</th>
                  <th className="py-2.5 px-4 text-right">Harga Beli Petani</th>
                  <th className="py-2.5 pl-4 text-right">Perubahan Harian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {MARKET_PRICES.map((item) => (
                  <tr key={item.commodity} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      {item.commodity}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{item.unit}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      Rp {item.price.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-mono tabular-nums text-xs text-[#145A2B] font-medium">
                      {item.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kalkulator Dosis Pupuk Presisi (5 Kolom) */}
        <div className="lg:col-span-5 bg-white border border-[#CDE3C6] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-[#0F3820]">
                  Kalkulator Dosis Pupuk Lahan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hitung kebutuhan Urea, NPK Phonska, dan Pupuk Organik per hektar
                </p>
              </div>
              <Calculator className="w-4 h-4 text-[#145A2B]" />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Komoditas Tanaman
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "padi", label: "Padi Sawah" },
                    { id: "cabai", label: "Cabai Merah" },
                    { id: "jagung", label: "Jagung Hibrida" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCalcCrop(c.id as any)}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        calcCrop === c.id
                          ? "bg-[#145A2B] text-white border-[#145A2B]"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Luas Lahan Garapan</span>
                  <span className="font-mono tabular-nums font-bold text-[#145A2B]">
                    {calcAreaHa} Hektar ({Math.round(calcAreaHa * 10000).toLocaleString("id-ID")} m²)
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={10}
                  step={0.25}
                  value={calcAreaHa}
                  onChange={(e) => setCalcAreaHa(Number(e.target.value))}
                  className="w-full accent-[#145A2B] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
                  <span className="text-xs text-slate-500 block">Pupuk Urea</span>
                  <p className="text-base font-bold font-mono tabular-nums text-[#0F3820] mt-0.5">
                    {fertilizerDose.urea.toLocaleString("id-ID")} Kg
                  </p>
                </div>
                <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
                  <span className="text-xs text-slate-500 block">NPK Phonska</span>
                  <p className="text-base font-bold font-mono tabular-nums text-[#0F3820] mt-0.5">
                    {fertilizerDose.npkPhonska.toLocaleString("id-ID")} Kg
                  </p>
                </div>
                <div className="p-3 bg-[#F7FAF5] border border-[#DCEAD7] rounded-xl">
                  <span className="text-xs text-slate-500 block">Kompos Organik</span>
                  <p className="text-base font-bold font-mono tabular-nums text-[#0F3820] mt-0.5">
                    {fertilizerDose.organik.toLocaleString("id-ID")} Kg
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Jadwal Aplikasi: </span>
            {fertilizerDose.schedule}
          </div>
        </div>
      </div>

      {/* Buku Besar Pencatatan Hasil Panen Desa */}
      <div className="bg-white border border-[#CDE3C6] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#1B6B2F] font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {currentUser
                  ? "Terhubung ke Database Permanen Firebase Firestore"
                  : "Mode Tamu (Login untuk simpan permanen di Cloud)"}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#0F3820] mt-0.5">
              Buku Besar Hasil Panen Kelompok Tani Desa
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
            <div>
              Total Panen:{" "}
              <span className="font-bold text-slate-900">
                {totalWeightKg.toLocaleString("id-ID")} Kg
              </span>
            </div>
            <span>·</span>
            <div>
              Nilai Transaksi:{" "}
              <span className="font-bold text-[#145A2B]">
                Rp {totalRevenue.toLocaleString("id-ID")}
              </span>
            </div>
            {!currentUser && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1.5 bg-[#EFF8EC] border border-[#A5D6A7] text-[#145A2B] font-sans font-bold rounded-lg cursor-pointer"
              >
                Login Cloud
              </button>
            )}
          </div>
        </div>

        {/* Form Tambah Catatan Panen */}
        <form
          onSubmit={handleAddHarvest}
          className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end pb-5 border-b border-slate-200"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Petani
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={farmerName}
              onChange={(e) => setFarmerName(e.target.value)}
              placeholder="Contoh: Pak Budi"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lokasi Blok Lahan
            </label>
            <input
              type="text"
              maxLength={120}
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Komoditas Panen
            </label>
            <select
              value={commodity}
              onChange={(e) => {
                setCommodity(e.target.value);
                const found = MARKET_PRICES.find((m) => m.commodity === e.target.value);
                if (found) setPricePerKg(found.price);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              {MARKET_PRICES.map((m) => (
                <option key={m.commodity} value={m.commodity}>
                  {m.commodity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bobot Timbangan (Kg)
            </label>
            <input
              type="number"
              min={1}
              max={1000000}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Harga per Kg (Rp)
            </label>
            <input
              type="number"
              min={100}
              max={10000000}
              value={pricePerKg}
              onChange={(e) => setPricePerKg(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="py-2 px-4 bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 h-[38px] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isSaving ? "Menyimpan..." : "Catat Panen"}</span>
          </button>
        </form>

        {/* Filter Pencarian Tabel */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama petani, komoditas, atau blok..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Menampilkan {filteredHarvests.length} catatan panen
          </span>
        </div>

        {/* Tabel Data Panen */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Tanggal</th>
                <th className="py-2.5 px-4">Petani &amp; Blok</th>
                <th className="py-2.5 px-4">Komoditas</th>
                <th className="py-2.5 px-4 text-right">Bobot (Kg)</th>
                <th className="py-2.5 px-4 text-right">Harga/Kg</th>
                <th className="py-2.5 px-4 text-right">Total Nilai</th>
                <th className="py-2.5 pl-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredHarvests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Tidak ada data panen yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredHarvests.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-xs text-slate-600">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{row.farmerName}</div>
                      <div className="text-xs text-slate-500">{row.blockName}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">{row.commodity}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                      {row.weightKg.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      Rp {row.pricePerKg.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-[#145A2B]">
                      Rp {(row.weightKg * row.pricePerKg).toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteHarvest(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
