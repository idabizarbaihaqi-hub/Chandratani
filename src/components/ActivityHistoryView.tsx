import React from "react";
import { deleteDoc, doc } from "firebase/firestore";
import {
  History,
  Video,
  MessageSquare,
  Sprout,
  Trash2,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";

export interface ActivityRecord {
  id: string;
  userId: string;
  category: "live_call" | "diagnosis_daun" | "sensor_lahan" | "panen";
  title: string;
  summary: string;
  cropName: string;
  severity: string;
  createdAtLabel: string;
}

interface ActivityHistoryViewProps {
  records: ActivityRecord[];
  isAuthenticated: boolean;
  onOpenAuth: () => void;
  onStartLiveVideoCall: () => void;
  onOpenLiveChat: () => void;
}

export default function ActivityHistoryView({
  records,
  isAuthenticated,
  onOpenAuth,
  onStartLiveVideoCall,
  onOpenLiveChat,
}: ActivityHistoryViewProps) {
  const handleDelete = async (id: string) => {
    if (!isAuthenticated) return;
    try {
      await deleteDoc(doc(db, "activity_history", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `activity_history/${id}`);
    }
  };

  return (
    <div className="bg-white border border-[#CDE3C6] rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1B6B2F]">
            <History className="w-4 h-4" />
            <span>Arsip Konsultasi Pertanian</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#0F3820] mt-0.5 font-display">
            Riwayat LIVE Video Call &amp; Konsultasi
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Catatan percakapan dan hasil konsultasi langsung Anda bersama Penyuluh Pertanian.
          </p>
        </div>

        {!isAuthenticated && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-4 py-2 bg-[#145A2B] hover:bg-[#0F4620] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Login Akun
          </button>
        )}
      </div>

      {/* Daftar Riwayat */}
      {records.length === 0 ? (
        <div className="py-12 text-center bg-[#F7FAF5] border border-[#DCEAD7] rounded-2xl p-6 space-y-3">
          <Sprout className="w-10 h-10 text-[#2E7D32] mx-auto opacity-80" />
          <h3 className="text-base font-bold text-[#0F3820]">
            Belum Ada Riwayat Konsultasi
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Mulai sesi <strong>LIVE VIDEO CALL</strong> atau kirim pesan di <strong>Live Chat</strong> untuk berkonsultasi mengenai tanaman Anda.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onStartLiveVideoCall}
              className="px-4 py-2.5 bg-[#145A2B] hover:bg-[#0F4620] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>MULAI LIVE VIDEO CALL</span>
            </button>
            <button
              type="button"
              onClick={onOpenLiveChat}
              className="px-4 py-2.5 bg-white border border-[#CDE3C6] text-[#0F3820] hover:bg-[#EFF8EC] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Buka Live Chat</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-[#F7FAF5] border border-[#DCEAD7] hover:border-[#A5D6A7] transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#2E5A36]">
                  <span className="font-bold text-[#145A2B]">
                    Konsultasi Pertanian
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{item.cropName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {item.createdAtLabel}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#0F3820]">{item.title}</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {item.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onStartLiveVideoCall}
                  className="px-3 py-1.5 bg-white border border-[#CDE3C6] hover:bg-[#EFF8EC] text-[#0F3820] text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <span>LIVE Video Call</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                {isAuthenticated && !item.id.startsWith("local-") && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    title="Hapus Riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
