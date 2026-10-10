import React, { useEffect, useState } from "react";
import { Sun, CloudRain, Cloud, Droplets, Sprout, ChevronRight, MapPin, RefreshCw } from "lucide-react";

interface GpsWeatherStripProps {
  onCheckField: () => void;
}

interface WeatherData {
  tempC: number;
  humidity: number;
  windKmh: number;
  conditionLabel: string;
  locationName: string;
  isLiveGps: boolean;
}

function interpretWeatherCode(code: number): string {
  if (code === 0) return "Cuaca Cerah";
  if (code === 1 || code === 2) return "Cerah Berawan";
  if (code === 3) return "Berawan";
  if (code >= 45 && code <= 48) return "Berkabut Pagi";
  if (code >= 51 && code <= 67) return "Hujan Ringan";
  if (code >= 80 && code <= 99) return "Hujan Lebat";
  return "Cerah Berawan";
}

export default function GpsWeatherStrip({ onCheckField }: GpsWeatherStripProps) {
  const [weather, setWeather] = useState<WeatherData>({
    tempC: 28,
    humidity: 76,
    windKmh: 9,
    conditionLabel: "Cuaca Cerah",
    locationName: "Desa Pertanian (Default)",
    isLiveGps: false,
  });
  const [isLocating, setIsLocating] = useState(false);

  const fetchOpenMeteo = async (lat: number, lon: number, label: string, isGps: boolean) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.current) {
        setWeather({
          tempC: Math.round(data.current.temperature_2m ?? 28),
          humidity: Math.round(data.current.relative_humidity_2m ?? 76),
          windKmh: Math.round(data.current.wind_speed_10m ?? 9),
          conditionLabel: interpretWeatherCode(data.current.weather_code ?? 1),
          locationName: label,
          isLiveGps: isGps,
        });
      }
    } catch {
      // fallback gracefully
    }
  };

  const detectGpsWeather = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let locLabel = `GPS Lahan (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12`
          );
          if (geoRes.ok) {
            const geoJson = await geoRes.json();
            const village =
              geoJson?.address?.village ||
              geoJson?.address?.suburb ||
              geoJson?.address?.town ||
              geoJson?.address?.city ||
              geoJson?.address?.county;
            if (village) locLabel = `${village} (GPS Aktif)`;
          }
        } catch {
          // keep coordinate label
        }
        await fetchOpenMeteo(latitude, longitude, locLabel, true);
        setIsLocating(false);
      },
      async () => {
        // Fallback ke sentra pertanian Jawa (Subang/Karawang) jika izin GPS belum diberikan
        await fetchOpenMeteo(-6.57, 107.76, "Sentra Tani Nusantara", false);
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    detectGpsWeather();
  }, []);

  return (
    <section className="rounded-2xl bg-gradient-to-r from-[#EBF6E6] via-[#F2F9EE] to-[#E5F3DF] border border-[#CDE3C6] p-4 sm:px-6 sm:py-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Cuaca & Suhu Real-Time */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-500 shrink-0">
            {weather.conditionLabel.toLowerCase().includes("hujan") ? (
              <CloudRain className="w-7 h-7 text-sky-600" />
            ) : weather.conditionLabel.toLowerCase().includes("berawan") ? (
              <Cloud className="w-7 h-7 text-amber-500" />
            ) : (
              <Sun className="w-7 h-7 fill-amber-400 text-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1B6B2F]">Info Tani Hari Ini</span>
              <button
                type="button"
                onClick={detectGpsWeather}
                title="Perbarui Cuaca GPS Lahan"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E5A36] hover:text-[#0F3820] bg-white/70 px-2 py-0.5 rounded-md border border-[#CDE3C6] cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-[#1B6B2F]" />
                <span className="truncate max-w-[160px]">{weather.locationName}</span>
                <RefreshCw className={`w-2.5 h-2.5 ${isLocating ? "animate-spin" : ""}`} />
              </button>
            </div>
            <span className="block text-xs sm:text-sm font-semibold text-[#0F3820] mt-0.5">
              {weather.conditionLabel}
            </span>
            <span className="block text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#0F3820] leading-tight">
              {weather.tempC}°C
            </span>
          </div>
        </div>

        <div className="hidden sm:block h-10 w-[1px] bg-[#BFD8B8]" />

        {/* Kelembapan Udara Real-Time */}
        <div className="flex items-center gap-2.5">
          <Droplets className="w-6 h-6 text-[#2E8B3C] fill-[#4CAF50]/30 shrink-0" />
          <div>
            <span className="block text-xs text-[#2E5A36] font-medium">
              Kelembapan
            </span>
            <span className="block text-lg sm:text-xl font-extrabold font-mono tabular-nums text-[#1B6B2F]">
              {weather.humidity}%
            </span>
          </div>
        </div>

        <div className="hidden sm:block h-10 w-[1px] bg-[#BFD8B8]" />

        {/* Tombol Cek Kondisi Lahan Anda */}
        <button
          type="button"
          onClick={onCheckField}
          className="flex items-center gap-2.5 text-left group cursor-pointer ml-auto sm:ml-0"
        >
          <div className="w-9 h-9 rounded-xl bg-[#DDF0D6] flex items-center justify-center text-[#1B6B2F]">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs sm:text-sm font-semibold text-[#0F3820] group-hover:text-[#1B6B2F]">
              Cek kondisi
            </span>
            <span className="block text-xs sm:text-sm font-semibold text-[#0F3820] group-hover:text-[#1B6B2F]">
              lahan Anda
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#0F3820] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
}
