import React, { useEffect, useState } from "react";
import { User as FirebaseUser, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  User,
  MapPin,
  Sprout,
  Phone,
  Save,
  LogOut,
  LogIn,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

export interface FarmerProfileData {
  userId: string;
  fullName: string;
  villageName: string;
  farmerGroup: string;
  mainCommodity: string;
  totalAreaHa: number;
  phone: string;
}

interface FarmerProfileViewProps {
  currentUser: FirebaseUser | null;
  profile: FarmerProfileData | null;
  onOpenAuth: () => void;
  totalBlocksCount: number;
  totalHarvestKg: number;
  totalHistoryCount: number;
}

export default function FarmerProfileView({
  currentUser,
  profile,
  onOpenAuth,
  totalBlocksCount,
  totalHarvestKg,
  totalHistoryCount,
}: FarmerProfileViewProps) {
  const [fullName, setFullName] = useState(profile?.fullName || "Petani Hebat Desa");
  const [villageName, setVillageName] = useState(profile?.villageName || "Desa Sukamaju");
  const [farmerGroup, setFarmerGroup] = useState(
    profile?.farmerGroup || "Kelompok Tani Makmur Bersama"
  );
  const [mainCommodity, setMainCommodity] = useState(
    profile?.mainCommodity || "Padi Ciherang, Cabai Merah & Jagung"
  );
  const [totalAreaHa, setTotalAreaHa] = useState<number>(profile?.totalAreaHa ?? 2.5);
  const [phone, setPhone] = useState(profile?.phone || "0812-3456-7890");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setVillageName(profile.villageName);
      setFarmerGroup(profile.farmerGroup);
      setMainCommodity(profile.mainCommodity);
      setTotalAreaHa(profile.totalAreaHa);
      setPhone(profile.phone);
    } else if (currentUser?.displayName) {
      setFullName(currentUser.displayName);
    }
  }, [profile, currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    const path = `users/${currentUser.uid}`;

    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        userId: currentUser.uid,
        fullName: (fullName.trim() || "Petani Desa").slice(0, 100),
        villageName: (villageName.trim() || "Desa Sukamaju").slice(0, 100),
        farmerGroup: (farmerGroup.trim() || "Kelompok Tani").slice(0, 120),
        mainCommodity: (mainCommodity.trim() || "Padi Sawah").slice(0, 120),
        totalAreaHa: Math.max(0, Math.min(10000, Number(totalAreaHa) || 1)),
        phone: (phone.trim() || "-").slice(0, 40),
        updatedAt: serverTimestamp(),
      });
      setSaveMessage("Profil Petani berhasil disimpan ke Database Firebase.");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Kartu Identitas Petani & Status Akun (5 Kolom) */}
      <div className="lg:col-span-5 bg-white border border-[#CDE3C6] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#66BB6A] to-[#145A2B] text-white flex items-center justify-center font-extrabold text-2xl font-display shrink-0">
            {fullName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B6B2F]">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {currentUser ? "Akun Petani Terverifikasi Cloud" : "Mode Tamu Lokal"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-[#0F3820] mt-0.5">{fullName}</h2>
            <p className="text-xs text-slate-500">
              {currentUser?.email || "Akun Email Petani"}
            </p>
          </div>
        </div>

        {/* Statistik Ringkas Petani */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-[#F7FAF5] border border-[#DCEAD7]">
            <span className="text-xs text-slate-500 block">Blok Lahan</span>
            <span className="text-lg font-extrabold font-mono tabular-nums text-[#0F3820]">
              {totalBlocksCount} Blok
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#F7FAF5] border border-[#DCEAD7]">
            <span className="text-xs text-slate-500 block">Total Panen</span>
            <span className="text-lg font-extrabold font-mono tabular-nums text-[#1B6B2F]">
              {totalHarvestKg.toLocaleString("id-ID")} Kg
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#F7FAF5] border border-[#DCEAD7]">
            <span className="text-xs text-slate-500 block">Log Riwayat</span>
            <span className="text-lg font-extrabold font-mono tabular-nums text-[#0F3820]">
              {totalHistoryCount}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-slate-700 pt-1">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1B6B2F]" /> Lokasi Desa
            </span>
            <span className="font-bold text-[#0F3820]">{villageName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#1B6B2F]" /> Kelompok Tani
            </span>
            <span className="font-bold text-[#0F3820]">{farmerGroup}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-[#1B6B2F]" /> Luas Garapan
            </span>
            <span className="font-bold font-mono tabular-nums text-[#0F3820]">
              {totalAreaHa} Hektar
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#1B6B2F]" /> Kontak Petani
            </span>
            <span className="font-mono tabular-nums font-semibold text-[#0F3820]">
              {phone}
            </span>
          </div>
        </div>

        {currentUser ? (
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun (Logout)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full py-3 px-4 bg-[#145A2B] hover:bg-[#0F4620] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Masuk / Daftar Akun Petani (Login &amp; Sign Up)</span>
          </button>
        )}
      </div>

      {/* Form Edit Profil Petani (7 Kolom) */}
      <div className="lg:col-span-7 bg-white border border-[#CDE3C6] rounded-2xl p-6">
        <div className="pb-4 border-b border-slate-200">
          <h3 className="text-lg font-extrabold text-[#0F3820]">
            Pengaturan Data Profil &amp; Lahan Petani
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbarui identitas kelompok tani dan komoditas utama agar tersimpan di Database Firebase.
          </p>
        </div>

        {saveMessage && (
          <div className="mt-4 p-3 rounded-xl bg-[#EFF8EC] border border-[#A5D6A7] text-xs font-semibold text-[#145A2B] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F3820] mb-1">
                Nama Lengkap Petani
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3820] mb-1">
                Desa / Kecamatan
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={villageName}
                onChange={(e) => setVillageName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F3820] mb-1">
                Nama Kelompok Tani (Gapoktan)
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={farmerGroup}
                onChange={(e) => setFarmerGroup(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3820] mb-1">
                Komoditas Tanaman Utama
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={mainCommodity}
                onChange={(e) => setMainCommodity(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F3820] mb-1">
                Total Luas Lahan Garapan (Hektar)
              </label>
              <input
                type="number"
                step={0.1}
                min={0.1}
                max={10000}
                required
                value={totalAreaHa}
                onChange={(e) => setTotalAreaHa(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3820] mb-1">
                Nomor WhatsApp / Telepon
              </label>
              <input
                type="text"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-400 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? "Menyimpan ke Cloud..."
                  : currentUser
                  ? "Simpan Perubahan Profil ke Firebase"
                  : "Login & Simpan Profil Petani"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
