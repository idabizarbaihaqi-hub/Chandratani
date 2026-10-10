import React from "react";
import {
  Leaf,
  Droplets,
  Sun,
  Thermometer,
  Shield,
  Clock,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  Sparkles,
} from "lucide-react";

import chiliImg from "../assets/images/sample_daun_cabai_1791602926567.jpg";
import riceBlightImg from "../assets/images/sample_daun_padi_1791602916951.jpg";
import npkDeficiencyImg from "../assets/images/ilustrasi_defisiensi_npk_1791612620252.jpg";
import tomatoGuideImg from "../assets/images/ilustrasi_budidaya_tomat_1791612633314.jpg";
import riceHarvestImg from "../assets/images/hero_sawah_desa_1791602905772.jpg";

export interface RichAIResponseData {
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
}

const IMAGE_MAP: Record<string, string> = {
  chili_yellow: chiliImg,
  rice_blight: riceBlightImg,
  npk_deficiency: npkDeficiencyImg,
  tomato_guide: tomatoGuideImg,
  rice_harvest: riceHarvestImg,
};

function renderFormattedText(raw: string): React.ReactNode {
  if (!raw) return null;
  // Cleanly parse **bold** and *italic* without exposing raw asterisks
  const lines = raw.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const isBullet =
          trimmed.startsWith("• ") ||
          trimmed.startsWith("- ") ||
          trimmed.startsWith("* ");
        const cleanLine = isBullet ? trimmed.slice(2) : trimmed;

        const parts = cleanLine.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        const formattedParts = parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={i} className="font-bold text-[#0F3820]">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*")) {
            return (
              <em key={i} className="italic text-slate-800">
                {part.slice(1, -1)}
              </em>
            );
          }
          return <span key={i}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] mt-2 shrink-0" />
              <p className="text-sm text-slate-700 leading-relaxed">{formattedParts}</p>
            </div>
          );
        }

        return (
          <p key={lineIdx} className="text-sm text-slate-700 leading-relaxed">
            {formattedParts}
          </p>
        );
      })}
    </div>
  );
}

function getCategoryIcon(iconName: string) {
  switch (iconName) {
    case "leaf":
      return <Leaf className="w-4 h-4 text-[#1B6B2F]" />;
    case "droplets":
      return <Droplets className="w-4 h-4 text-sky-600" />;
    case "sun":
      return <Sun className="w-4 h-4 text-amber-500" />;
    case "thermometer":
      return <Thermometer className="w-4 h-4 text-orange-600" />;
    case "shield":
      return <Shield className="w-4 h-4 text-[#145A2B]" />;
    case "clock":
      return <Clock className="w-4 h-4 text-emerald-700" />;
    case "chart":
      return <BarChart3 className="w-4 h-4 text-[#145A2B]" />;
    default:
      return <Leaf className="w-4 h-4 text-[#1B6B2F]" />;
  }
}

export default function RichAIResponseRenderer({
  data,
}: {
  data: RichAIResponseData;
}) {
  const imageSrc =
    data.visualImageKey && data.visualImageKey !== "none"
      ? IMAGE_MAP[data.visualImageKey]
      : null;

  const maxChartVal =
    data.dataChart && data.dataChart.items.length > 0
      ? Math.max(...data.dataChart.items.map((it) => it.value), 1)
      : 1;

  return (
    <div className="space-y-4 text-left">
      {/* 1. Kesimpulan Singkat */}
      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-extrabold text-[#0F3820] font-display leading-snug">
          {data.summaryTitle}
        </h3>
        <p className="text-sm font-medium text-[#1E4628] bg-[#EFF8EC] border border-[#CDE3C6] rounded-xl p-3 leading-relaxed">
          {data.summaryText}
        </p>
      </div>

      {/* 2. Penjelasan Utama */}
      {data.mainExplanation && (
        <div className="pt-1">{renderFormattedText(data.mainExplanation)}</div>
      )}

      {/* 3. Gambar Pertanian yang Relevan */}
      {imageSrc && (
        <figure className="rounded-2xl overflow-hidden border border-[#CDE3C6] bg-[#F7FAF5]">
          <div className="max-h-64 w-full overflow-hidden flex items-center justify-center bg-slate-100">
            <img
              src={imageSrc}
              alt={data.summaryTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          {data.visualImageCaption && (
            <figcaption className="px-3.5 py-2 text-xs text-slate-600 bg-white border-t border-[#E2EFE0] italic">
              {data.visualImageCaption}
            </figcaption>
          )}
        </figure>
      )}

      {/* 4. Kartu Informasi Ringkas dengan Ikon Kontekstual */}
      {data.infoCards && data.infoCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {data.infoCards.map((card, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-[#F8FBF7] border border-[#DCEAD7] flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#E6F3E1] flex items-center justify-center shrink-0">
                  {getCategoryIcon(card.icon)}
                </div>
                <span className="text-xs font-extrabold text-[#0F3820] leading-tight">
                  {card.title}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{card.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* 5. Langkah Tindakan yang Dapat Dilakukan */}
      {data.actionSteps && data.actionSteps.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#DCEAD7] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#145A2B] uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Langkah Tindakan yang Disarankan</span>
          </div>
          <ol className="space-y-2">
            {data.actionSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="w-5 h-5 rounded-full bg-[#145A2B] text-white text-xs font-bold font-mono tabular-nums flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 leading-relaxed">{renderFormattedText(step)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 6. Tabel Perbandingan Responsif (Jika Ada) */}
      {data.comparisonTable &&
        data.comparisonTable.headers &&
        data.comparisonTable.headers.length > 0 &&
        data.comparisonTable.rows &&
        data.comparisonTable.rows.length > 0 && (
          <div className="rounded-2xl border border-[#CDE3C6] overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-[#EFF8EC] border-b border-[#CDE3C6] text-xs font-extrabold text-[#0F3820]">
              {data.comparisonTable.title}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F7FAF5] border-b border-slate-200 text-[#0F3820] font-bold">
                    {data.comparisonTable.headers.map((h, i) => (
                      <th key={i} className="py-2.5 px-3.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.comparisonTable.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-2.5 px-3.5 text-slate-700 leading-snug ${
                            cIdx === 0 ? "font-bold text-[#0F3820]" : ""
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* 7. Grafik Berdasarkan Data (Dengan Label Ilustrasi yang Jujur) */}
      {data.dataChart &&
        data.dataChart.items &&
        data.dataChart.items.length > 0 && (
          <div className="rounded-2xl border border-[#CDE3C6] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-[#0F3820] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#145A2B]" />
                  <span>{data.dataChart.title}</span>
                </h4>
                {data.dataChart.subtitle && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {data.dataChart.subtitle}
                  </p>
                )}
              </div>
              {data.dataChart.isIllustration && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                  Ilustrasi Data Simulasi
                </span>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              {data.dataChart.items.map((item, idx) => {
                const widthPct = Math.max(
                  12,
                  Math.min(100, Math.round((item.value / maxChartVal) * 100))
                );
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{item.label}</span>
                      <span className="font-mono tabular-nums font-bold text-[#145A2B]">
                        {item.value.toLocaleString("id-ID")} {data.dataChart?.unit}
                        {item.note ? ` (${item.note})` : ""}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#2E7D32] to-[#66BB6A] rounded-full transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* 8. Diagram Alur Penjelasan (Jika Ada) */}
      {data.processDiagram &&
        data.processDiagram.steps &&
        data.processDiagram.steps.length > 0 && (
          <div className="rounded-2xl border border-[#CDE3C6] bg-[#F7FAF5] p-4 space-y-3">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#0F3820]">
              {data.processDiagram.title}
            </h4>
            <div className="flex flex-col items-stretch space-y-1.5">
              {data.processDiagram.steps.map((st, idx) => (
                <React.Fragment key={idx}>
                  <div className="bg-white border border-[#DCEAD7] rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-[#E8F5E9] text-[#145A2B] font-mono tabular-nums text-xs font-extrabold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-[#0F3820]">
                          {st.label}
                        </p>
                        <p className="text-xs text-slate-600">{st.detail}</p>
                      </div>
                    </div>
                  </div>
                  {idx < (data.processDiagram?.steps.length || 0) - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="w-4 h-4 text-[#2E7D32]" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

      {/* 9. Peringatan Penting */}
      {data.warningNote && (
        <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-amber-900 mb-0.5">
              Hal Penting yang Perlu Diperhatikan:
            </span>
            <p className="leading-relaxed">{data.warningNote}</p>
          </div>
        </div>
      )}

      {/* 10. Rekomendasi Langkah Berikutnya */}
      {data.nextRecommendation && (
        <div className="p-3 rounded-xl bg-[#EFF8EC] border border-[#CDE3C6] flex items-start gap-2 text-xs text-[#0F3820]">
          <Sparkles className="w-4 h-4 text-[#1B6B2F] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Langkah Berikutnya: </span>
            <span>{data.nextRecommendation}</span>
          </div>
        </div>
      )}
    </div>
  );
}
