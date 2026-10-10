import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  Bell,
  Home,
  MessageSquare,
  History,
  User,
  Leaf,
  Video,
  Mic,
  ChevronRight,
  ShieldCheck,
  Sprout,
  UserCheck,
  ArrowLeft,
  X,
} from "lucide-react";

import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import SplashScreen from "./components/SplashScreen";
import AuthGateScreen from "./components/AuthGateScreen";
import LiveTaniConsultation from "./components/LiveTaniConsultation";
import LiveChatView from "./components/LiveChatView";
import ActivityHistoryView, { ActivityRecord } from "./components/ActivityHistoryView";
import FarmerProfileView, { FarmerProfileData } from "./components/FarmerProfileView";

import heroFarmerVideoCallImg from "./assets/images/hero_petani_videocall_1791611301998.jpg";
import smartphoneMockupImg from "./assets/images/mockup_smartphone_videocall_1791611315796.jpg";

// Navigasi Halaman: 4 Menu Navigasi Bawah (Beranda, Live Chat, Riwayat, Profile) + Halaman Full Screen LIVE VIDEO CALL
type PageRoute = "beranda" | "live-video-call" | "live-chat" | "riwayat" | "profile";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Beranda menjadi menu aktif ketika dashboard dibuka
  const [currentPage, setCurrentPage] = useState<PageRoute>("beranda");
  const [previousPage, setPreviousPage] = useState<PageRoute>("beranda");
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Cloud Firestore states
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfileData | null>(null);
  const [cloudHistory, setCloudHistory] = useState<ActivityRecord[]>([]);

  // 1. Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const navigateToPage = (page: PageRoute) => {
    setPreviousPage(currentPage);
    setCurrentPage(page);
    setShowNotifPanel(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  // 2. Real-time Firestore Listeners when authenticated
  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      setFarmerProfile(null);
      setCloudHistory([]);
      return;
    }

    const uid = currentUser.uid;

    // A. Listener Profil Petani (/users/{uid})
    const userDocRef = doc(db, "users", uid);
    const unsubProfile = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setFarmerProfile({
            userId: d.userId,
            fullName: d.fullName,
            villageName: d.villageName,
            farmerGroup: d.farmerGroup,
            mainCommodity: d.mainCommodity,
            totalAreaHa: d.totalAreaHa,
            phone: d.phone,
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    // B. Listener Riwayat Konsultasi (/activity_history)
    const qHistory = query(collection(db, "activity_history"), where("userId", "==", uid));
    const unsubHistory = onSnapshot(
      qHistory,
      (snap) => {
        const list: ActivityRecord[] = snap.docs.map((d) => {
          const data = d.data();
          const dt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: d.id,
            userId: data.userId,
            category: data.category,
            title: data.title,
            summary: data.summary,
            cropName: data.cropName,
            severity: data.severity,
            createdAtLabel: dt.toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        });
        setCloudHistory(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "activity_history")
    );

    return () => {
      unsubProfile();
      unsubHistory();
    };
  }, [isAuthReady, currentUser]);

  const handleSaveActivity = async (entry: {
    category: "live_call" | "diagnosis_daun" | "sensor_lahan" | "panen";
    title: string;
    summary: string;
    cropName: string;
    severity: string;
  }) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, "activity_history"), {
        userId: currentUser.uid,
        category: entry.category,
        title: entry.title.slice(0, 200),
        summary: entry.summary.slice(0, 2000),
        cropName: entry.cropName.slice(0, 120),
        severity: entry.severity.slice(0, 40),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "activity_history");
    }
  };

  // Tahap 1: Splash Screen
  if (showSplash || !isAuthReady) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Tahap 2: Wajib Login sebelum menggunakan fitur aplikasi
  if (!currentUser) {
    return <AuthGateScreen />;
  }

  // ================= MODE FULL SCREEN 1: LIVE VIDEO CALL =================
  // Ketika pengguna menekan tombol LIVE VIDEO CALL, langsung membuka antarmuka kamera live dalam mode full screen tanpa header/navigasi bawah yang mengganggu
  if (currentPage === "live-video-call") {
    return (
      <LiveTaniConsultation
        onSaveActivity={handleSaveActivity}
        onEndCall={() =>
          navigateToPage(previousPage === "live-chat" ? "live-chat" : "beranda")
        }
      />
    );
  }

  // ================= MODE FULL SCREEN 2: LIVE CHAT SEPERTI CHATGPT =================
  // Ketika pengguna berada di halaman Live Chat, tampilkan full screen dan sembunyikan navigasi bawah agar ruang chat luas
  if (currentPage === "live-chat") {
    return (
      <LiveChatView
        farmerName={farmerProfile?.fullName || currentUser.displayName || "Petani"}
        onBack={() => navigateToPage("beranda")}
        onStartVideoCall={() => navigateToPage("live-video-call")}
        onSaveActivity={handleSaveActivity}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F8F2] text-[#0F2E1A] pb-24 relative overflow-x-hidden">
      {/* ================= A. HEADER ================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#DCEAD7] px-4 sm:px-6 py-3">
        <div className="max-w-[680px] mx-auto flex items-center justify-between gap-4">
          {/* Logo Daun & Nama Aplikasi: CHANDRA Tani Desaku */}
          <button
            type="button"
            onClick={() => navigateToPage("beranda")}
            className="flex items-center gap-3 text-left cursor-pointer group shrink-0"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#66BB6A] via-[#2E7D32] to-[#145A2B] flex items-center justify-center shadow-xs relative overflow-hidden">
              <div className="w-3 h-3 rounded-full bg-amber-300/90 absolute top-1.5 left-1/2 -translate-x-1/2" />
              <Leaf className="w-6 h-6 text-white relative z-10 mt-1" />
            </div>
            <div>
              <div className="leading-none">
                <span className="block text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F3820] font-display">
                  CHANDRA
                </span>
                <span className="block text-sm sm:text-base font-bold text-[#3B873E] -mt-0.5">
                  Tani Desaku
                </span>
              </div>
              <span className="hidden sm:block text-[11px] text-slate-500 mt-0.5">
                Teknologi Pertanian untuk Masa Depan yang Lebih Baik
              </span>
            </div>
          </button>

          {/* Ikon Notifikasi di Sebelah Kanan */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifPanel((prev) => !prev)}
              aria-label="Notifikasi Penyuluhan Pertanian"
              className="relative p-2.5 rounded-xl bg-[#F4F8F2] hover:bg-[#E6F2E2] border border-[#CDE3C6] text-[#0F3820] transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
            </button>

            {showNotifPanel && (
              <div className="absolute right-0 top-13 w-76 sm:w-84 bg-white border border-[#CDE3C6] rounded-2xl shadow-lg p-4 z-50 text-left">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#0F3820]">
                    Informasi Penyuluhan Pertanian
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotifPanel(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-700">
                  <div className="p-2.5 rounded-xl bg-[#F4F8F2] border border-[#DCEAD7]">
                    <p className="font-bold text-[#145A2B]">Layanan LIVE VIDEO CALL Siap</p>
                    <p className="mt-0.5 text-slate-600 leading-relaxed">
                      Tekan tombol MULAI LIVE VIDEO CALL untuk membuka kamera layar penuh secara langsung.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= KONTEN UTAMA (BERANDA / RIWAYAT / PROFILE) ================= */}
      <main className="flex-1 w-full max-w-[680px] mx-auto px-4 sm:px-6 pt-4 pb-8">
        {currentPage === "beranda" ? (
          <div className="space-y-6">
            {/* ================= B. HERO SECTION ================= */}
            <section className="relative rounded-3xl overflow-hidden shadow-md border border-[#CBE2C4] min-h-[250px] sm:min-h-[290px] flex flex-col justify-end">
              <img
                src={heroFarmerVideoCallImg}
                alt="Petani Indonesia di Sawah"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              {/* Gradient Scrim agar Teks Sangat Mudah Dibaca */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#072612]/90 via-[#0C3B1C]/70 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#072612]/90 via-transparent to-transparent" />

              <div className="relative z-10 p-6 sm:p-8 max-w-md space-y-2.5">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display leading-tight">
                  Halo, Petani!
                </h1>
                <p className="text-sm sm:text-base text-emerald-50/95 leading-relaxed font-medium">
                  Solusi konsultasi pertanian kini lebih mudah melalui panggilan video langsung.
                </p>
                <div className="w-12 h-1.5 rounded-full bg-[#66BB6A] pt-0.5" />
              </div>
            </section>

            {/* ================= C. KARTU MENU UTAMA (HANYA SATU: LIVE VIDEO CALL) ================= */}
            <section className="bg-white rounded-3xl border border-[#CDE3C6] shadow-md p-6 sm:p-7 relative overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Kolom Kiri: Nama Layanan, Deskripsi & Tombol Utama */}
                <div className="sm:col-span-7 space-y-3.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F5E9] border border-[#A5D6A7] text-[#145A2B] text-xs font-bold">
                    <Video className="w-3.5 h-3.5 fill-[#145A2B]" />
                    <span>Layanan Utama</span>
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F3820] tracking-tight font-display leading-tight">
                      LIVE VIDEO CALL
                    </h2>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Konsultasi langsung mengenai pertanian melalui panggilan video.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateToPage("live-video-call")}
                      className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-[#145A2B] to-[#2E7D32] hover:from-[#0F4620] hover:to-[#1B5E20] active:scale-[0.99] text-white text-sm sm:text-base font-extrabold shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4 fill-white text-white" />
                      </span>
                      <span className="whitespace-nowrap">MULAI LIVE VIDEO CALL</span>
                      <ChevronRight className="w-5 h-5 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Kolom Kanan: Ilustrasi Smartphone Video Call Profesional */}
                <div className="sm:col-span-5 flex items-center justify-center relative">
                  <div className="relative w-48 sm:w-52 aspect-square rounded-2xl overflow-hidden flex items-center justify-center">
                    <img
                      src={smartphoneMockupImg}
                      alt="Antarmuka Smartphone LIVE VIDEO CALL"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* Badge Ikon Video & Mikrofon Pendamping */}
                  <div className="absolute right-2 top-3 flex flex-col gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#2E7D32] text-white shadow-sm border-2 border-white flex items-center justify-center">
                      <Video className="w-4 h-4 fill-white" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#388E3C] text-white shadow-sm border-2 border-white flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ================= D. AREA INFORMASI PENDUKUNG (BUKAN MENU TAMBAHAN) ================= */}
            <section
              aria-label="Informasi Pendukung Layanan"
              className="bg-white/90 rounded-2xl border border-[#DCEAD7] px-4 py-5 shadow-2xs"
            >
              <div className="grid grid-cols-3 divide-x divide-[#E2EFE0] text-center">
                <div className="px-2 flex flex-col items-center">
                  <div className="w-11 h-11 rounded-2xl bg-[#EAF5E6] text-[#145A2B] flex items-center justify-center mb-2">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#0F3820] leading-snug">
                    Konsultasi Pertanian
                  </span>
                </div>

                <div className="px-2 flex flex-col items-center">
                  <div className="w-11 h-11 rounded-2xl bg-[#EAF5E6] text-[#145A2B] flex items-center justify-center mb-2">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#0F3820] leading-snug">
                    Komunikasi Langsung
                  </span>
                </div>

                <div className="px-2 flex flex-col items-center">
                  <div className="w-11 h-11 rounded-2xl bg-[#EAF5E6] text-[#145A2B] flex items-center justify-center mb-2">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#0F3820] leading-snug">
                    Bantuan Penyuluh Pertanian
                  </span>
                </div>
              </div>
            </section>

            {/* ================= E. BAGIAN MOTIVASI ================= */}
            <section className="rounded-2xl bg-gradient-to-r from-[#E6F3E1] via-[#EFF8EC] to-[#DCEFD6] border border-[#C6E0BE] px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#145A2B] text-white flex items-center justify-center shrink-0">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-[#0F3820] leading-snug">
                    Petani Sejahtera, Pertanian Indonesia Lebih Maju
                  </p>
                  <p className="text-[11px] sm:text-xs text-[#2E5A36] mt-0.5 italic">
                    &ldquo;Pendampingan tepat langsung dari lahan untuk hasil panen terbaik.&rdquo;
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* ================= HALAMAN RIWAYAT & PROFILE ================= */
          <div className="space-y-4">
            <div className="bg-white border border-[#CDE3C6] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xs">
              <button
                type="button"
                onClick={() => navigateToPage("beranda")}
                className="px-3.5 py-2 rounded-xl bg-[#EFF8EC] hover:bg-[#E2F1DD] border border-[#CDE3C6] text-[#145A2B] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Beranda</span>
              </button>

              <span className="text-xs sm:text-sm font-extrabold text-[#0F3820] font-display truncate">
                {currentPage === "riwayat" && "Riwayat Konsultasi"}
                {currentPage === "profile" && "Profile Petani"}
              </span>
            </div>

            {currentPage === "riwayat" && (
              <ActivityHistoryView
                records={cloudHistory}
                isAuthenticated={true}
                onOpenAuth={() => {}}
                onStartLiveVideoCall={() => navigateToPage("live-video-call")}
                onOpenLiveChat={() => navigateToPage("live-chat")}
              />
            )}

            {currentPage === "profile" && (
              <FarmerProfileView
                currentUser={currentUser}
                profile={farmerProfile}
                onOpenAuth={() => {}}
                totalBlocksCount={1}
                totalHarvestKg={0}
                totalHistoryCount={cloudHistory.length}
              />
            )}
          </div>
        )}
      </main>

      {/* ================= 4. NAVIGASI BAWAH (TEPAT 4 MENU: Beranda, Live Chat, Riwayat, Profile) ================= */}
      <nav
        aria-label="Navigasi Bawah"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#DCEAD7] px-3 py-2 shadow-sm"
      >
        <div className="max-w-[680px] mx-auto grid grid-cols-4 gap-1">
          {/* 1. Beranda */}
          <button
            type="button"
            onClick={() => navigateToPage("beranda")}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              currentPage === "beranda"
                ? "text-[#145A2B] font-extrabold"
                : "text-slate-500 hover:text-[#145A2B] font-medium"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs mt-1 whitespace-nowrap">Beranda</span>
            {currentPage === "beranda" && (
              <span className="w-8 h-1 bg-[#1B6B2F] rounded-full mt-1" />
            )}
          </button>

          {/* 2. Live Chat */}
          <button
            type="button"
            onClick={() => navigateToPage("live-chat")}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer text-slate-500 hover:text-[#145A2B] font-medium"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs mt-1 whitespace-nowrap">Live Chat</span>
          </button>

          {/* 3. Riwayat */}
          <button
            type="button"
            onClick={() => navigateToPage("riwayat")}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              currentPage === "riwayat"
                ? "text-[#145A2B] font-extrabold"
                : "text-slate-500 hover:text-[#145A2B] font-medium"
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-xs mt-1 whitespace-nowrap">Riwayat</span>
            {currentPage === "riwayat" && (
              <span className="w-8 h-1 bg-[#1B6B2F] rounded-full mt-1" />
            )}
          </button>

          {/* 4. Profile */}
          <button
            type="button"
            onClick={() => navigateToPage("profile")}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              currentPage === "profile"
                ? "text-[#145A2B] font-extrabold"
                : "text-slate-500 hover:text-[#145A2B] font-medium"
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-xs mt-1 whitespace-nowrap">Profile</span>
            {currentPage === "profile" && (
              <span className="w-8 h-1 bg-[#1B6B2F] rounded-full mt-1" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
