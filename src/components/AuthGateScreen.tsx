import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Leaf,
  ShieldCheck,
  Sprout,
  UserCheck,
  ArrowRight,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "../firebase";
import heroPetaniImg from "../assets/images/hero_petani_sawah_1791604669532.jpg";

export default function AuthGateScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [villageName, setVillageName] = useState("Desa Sukamaju");
  const [farmerGroup, setFarmerGroup] = useState("Kelompok Tani Makmur");
  const [mainCommodity, setMainCommodity] = useState("Padi Ciherang & Cabai Merah");
  const [totalAreaHa, setTotalAreaHa] = useState<number>(1.5);
  const [phone, setPhone] = useState("0812-3456-7890");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;

      const userDocRef = doc(db, "users", user.uid);
      let existingSnap;
      try {
        existingSnap = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!existingSnap?.exists() || mode === "signup") {
        const safeName = (
          fullName.trim() ||
          user.displayName ||
          "Petani Hebat"
        ).slice(0, 100);
        const safeVillage = (villageName.trim() || "Desa Sukamaju").slice(0, 100);
        const safeGroup = (farmerGroup.trim() || "Kelompok Tani Desa").slice(0, 120);
        const safeCommodity = (
          mainCommodity.trim() || "Padi & Hortikultura"
        ).slice(0, 120);
        const safePhone = (phone.trim() || "-").slice(0, 40);
        const safeArea = Math.max(0, Math.min(10000, Number(totalAreaHa) || 1));

        try {
          await setDoc(userDocRef, {
            userId: user.uid,
            fullName: safeName,
            villageName: safeVillage,
            farmerGroup: safeGroup,
            mainCommodity: safeCommodity,
            totalAreaHa: safeArea,
            phone: safePhone,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Gagal masuk dengan akun Google. Pastikan jendela pop-up browser tidak diblokir."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAF5] text-[#0F2E1A] flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-hidden">
      {/* Ornamen Daun Halus */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-br from-[#DCEDC8]/60 to-transparent blur-2xl z-0"
      />

      <div className="relative z-10 max-w-[1000px] w-full bg-white border border-[#CDE3C6] rounded-3xl shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Kolom Visual Pertanian (5 Kolom di Desktop) */}
        <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-[540px] bg-[#0F3820] flex flex-col justify-between p-6 sm:p-8 text-white">
          <img
            src={heroPetaniImg}
            alt="Lahan Pertanian Desa Chandra Tani Desaku"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#082412] via-[#0F3820]/75 to-[#0F3820]/40" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#66BB6A] to-[#145A2B] flex items-center justify-center shadow-sm border border-white/20">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div className="leading-none">
              <span className="block text-xl font-extrabold tracking-tight text-white font-display">
                CHANDRA
              </span>
              <span className="block text-sm font-semibold text-[#A5D6A7]">
                Tani Desaku
              </span>
            </div>
          </div>

          <div className="relative z-10 space-y-3 my-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-[#C8E6C9]">
              <Lock className="w-3.5 h-3.5" />
              Akses Khusus Petani CHANDRA Tani Desaku
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight font-display">
              Halo, Petani!
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Solusi konsultasi pertanian kini lebih mudah melalui panggilan video langsung. Silakan masuk (Login) atau daftar akun terlebih dahulu.
            </p>
          </div>

          <div className="relative z-10 space-y-2 text-xs text-emerald-200 border-t border-white/15 pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#81C784] shrink-0" />
              <span>LIVE VIDEO CALL Kamera &amp; Suara Langsung</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#81C784] shrink-0" />
              <span>Komunikasi Langsung Bersama Penyuluh Pertanian</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#81C784] shrink-0" />
              <span>Riwayat Konsultasi &amp; Profil Petani Tersimpan Aman</span>
            </div>
          </div>
        </div>

        {/* Kolom Formulir Login & Sign Up (7 Kolom di Desktop) */}
        <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-[#0F3820] font-display">
              {mode === "login"
                ? "Masuk ke Akun Petani Anda"
                : "Pendaftaran Anggota Petani Baru"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {mode === "login"
                ? "Gunakan akun Google Anda untuk membuka seluruh menu layanan pertanian desa."
                : "Lengkapi data kelompok tani dan lahan Anda, lalu hubungkan dengan akun Google."}
            </p>
          </div>

          {/* Pilihan Mode Login / Daftar */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#EFF8EC] border border-[#D3E8CC] rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                mode === "login"
                  ? "bg-[#145A2B] text-white shadow-xs"
                  : "text-[#145A2B] hover:bg-[#E4F3DF]"
              }`}
            >
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMsg(null);
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                mode === "signup"
                  ? "bg-[#145A2B] text-white shadow-xs"
                  : "text-[#145A2B] hover:bg-[#E4F3DF]"
              }`}
            >
              Daftar Baru (Sign Up)
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleGoogleAuth} className="space-y-4">
            {mode === "signup" ? (
              <>
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
                    placeholder="Contoh: Pak Hendra Wijaya"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#0F3820] mb-1">
                      Nama Desa / Kecamatan
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={villageName}
                      onChange={(e) => setVillageName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F3820] mb-1">
                      Kelompok Tani (Gapoktan)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={farmerGroup}
                      onChange={(e) => setFarmerGroup(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F3820] mb-1">
                      Luas Lahan Garapan (Hektar)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={1000}
                      required
                      value={totalAreaHa}
                      onChange={(e) => setTotalAreaHa(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F3820] mb-1">
                    Nomor WhatsApp / Telepon Aktif
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                  />
                </div>
              </>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F2F9F0] border border-[#D3E8CC] space-y-2.5 text-xs sm:text-sm text-[#1E4628]">
                <div className="flex items-center gap-2 font-bold text-[#0F3820] text-sm sm:text-base">
                  <ShieldCheck className="w-5 h-5 text-[#1B6B2F] shrink-0" />
                  <span>Keamanan Data &amp; Sinkronisasi Cloud Desa</span>
                </div>
                <p className="leading-relaxed">
                  Seluruh data aktivitas Anda—mulai dari percakapan <strong>LIVE Video Call</strong>, hasil <strong>Diagnosis Daun</strong>, telemetri <strong>Sensor Lahan</strong>, hingga <strong>Buku Panen</strong>—tersimpan aman di akun pribadi Anda dan tidak tercampur dengan pengguna lain.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-5 bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2.5 shadow-sm cursor-pointer mt-2"
            >
              {mode === "signup" ? (
                <>
                  <Sprout className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? "Mendaftarkan Akun Petani..."
                      : "Daftar Sekarang & Masuk dengan Google"}
                  </span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? "Memverifikasi Akun..."
                      : "Masuk (Login) dengan Akun Google"}
                  </span>
                </>
              )}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
