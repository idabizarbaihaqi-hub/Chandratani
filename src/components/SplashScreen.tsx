import React, { useEffect, useState } from "react";
import { Leaf, Sprout } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(55), 350);
    const t2 = window.setTimeout(() => setProgress(90), 850);
    const t3 = window.setTimeout(() => {
      setProgress(100);
      onComplete();
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0F3820] via-[#145A2B] to-[#0A2615] flex flex-col items-center justify-between p-8 text-white">
      <div className="text-xs font-mono text-emerald-300/80 tracking-wide">
        SISTEM INFORMASI PERTANIAN DESA TERPADU
      </div>

      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#66BB6A] to-[#2E7D32] border-2 border-[#A5D6A7]/50 shadow-xl flex items-center justify-center mb-6">
          <Leaf className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display">
          CHANDRA
        </h1>
        <p className="text-lg sm:text-xl font-semibold text-[#81C784] -mt-0.5">
          Tani Desaku
        </p>

        <p className="text-xs sm:text-sm text-emerald-100/85 mt-4 leading-relaxed">
          Menghubungkan Penyuluh Pertanian Live, Diagnosis Daun, Sensor Lahan &amp; Database Panen Desa
        </p>

        {/* Progress Bar */}
        <div className="w-64 h-2 bg-white/15 rounded-full overflow-hidden mt-8">
          <div
            className="h-full bg-[#66BB6A] transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-200 font-mono tabular-nums">
          <Sprout className="w-3.5 h-3.5" />
          <span>Memuat Layanan &amp; Database Desa... {progress}%</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="text-xs font-semibold text-emerald-200 hover:text-white underline underline-offset-4 cursor-pointer"
      >
        Masuk Sekarang
      </button>
    </div>
  );
}
