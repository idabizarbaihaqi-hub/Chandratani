import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Leaf, ShieldCheck, Sprout, UserCheck, X, ArrowRight } from "lucide-react";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "../firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [villageName, setVillageName] = useState("Desa Sukamaju");
  const [farmerGroup, setFarmerGroup] = useState("Kelompok Tani Makmur");
  const [mainCommodity, setMainCommodity] = useState("Padi Ciherang & Cabai Merah");
  const [totalAreaHa, setTotalAreaHa] = useState<number>(1.5);
  const [phone, setPhone] = useState("0812-3456-7890");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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
        const safeName = (fullName.trim() || user.displayName || "Petani Hebat").slice(0, 100);
        const safeVillage = (villageName.trim() || "Desa Sukamaju").slice(0, 100);
        const safeGroup = (farmerGroup.trim() || "Kelompok Tani Desa").slice(0, 120);
        const safeCommodity = (mainCommodity.trim() || "Padi & Hortikultura").slice(0, 120);
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

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Gagal masuk dengan akun Google. Pastikan jendela pop-up diizinkan."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#CDE3C6] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#66BB6A] to-[#145A2B] flex items-center justify-center text-white">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#0F3820] font-display leading-tight">
              CHANDRA Tani Desaku
            </h2>
            <p className="text-xs text-[#2E5A36]">
              Akses Database Permanen Kelompok Tani Desa
            </p>
          </div>
        </div>

        {/* Tab Switcher: Masuk (Login) / Daftar Baru (Sign Up) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFF8EC] border border-[#D3E8CC] rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === "login"
                ? "bg-[#145A2B] text-white shadow-xs"
                : "text-[#145A2B] hover:bg-[#E4F3DF]"
            }`}
          >
            Masuk Akun (Login)
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === "signup"
                ? "bg-[#145A2B] text-white shadow-xs"
                : "text-[#145A2B] hover:bg-[#E4F3DF]"
            }`}
          >
            Daftar Petani (Sign Up)
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleGoogleAuth} className="space-y-3.5">
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
                  className="w-full px-3.5 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F3820] mb-1">
                    Nama Desa
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F3820] mb-1">
                    Kelompok Tani
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={farmerGroup}
                    onChange={(e) => setFarmerGroup(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F3820] mb-1">
                    Komoditas Utama
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={mainCommodity}
                    onChange={(e) => setMainCommodity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F3820] mb-1">
                    Luas Lahan (Hektar)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={1000}
                    required
                    value={totalAreaHa}
                    onChange={(e) => setTotalAreaHa(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#F7FAF5] border border-[#CDE3C6] rounded-xl focus:outline-none focus:border-[#145A2B]"
                  />
                </div>
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
            </>
          ) : (
            <div className="p-4 rounded-2xl bg-[#F2F9F0] border border-[#D3E8CC] space-y-2 text-xs text-[#1E4628]">
              <div className="flex items-center gap-2 font-bold text-[#0F3820] text-sm">
                <ShieldCheck className="w-4 h-4 text-[#1B6B2F]" />
                <span>Sinkronisasi Cloud Firebase Otomatis</span>
              </div>
              <p className="leading-relaxed">
                Masuk dengan akun Google Anda untuk mengakses kembali seluruh catatan panen, riwayat diagnosis daun, dan pengaturan sensor blok lahan dari HP maupun laptop mana saja.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-[#145A2B] hover:bg-[#0F4620] disabled:bg-slate-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-2"
          >
            {mode === "signup" ? (
              <>
                <Sprout className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? "Mendaftarkan Profil Petani..."
                    : "Daftar & Hubungkan Akun Google"}
                </span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>
                  {isSubmitting ? "Menghubungkan..." : "Masuk dengan Akun Google"}
                </span>
              </>
            )}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
