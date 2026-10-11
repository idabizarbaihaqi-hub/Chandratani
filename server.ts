import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { LiveServerMessage, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  getGenAIClient,
  inspectCameraFrameWithGemini,
  registerApiRoutes,
} from "./api/index";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: "25mb" }));

  // Register all REST API routes (/api/chat-assistant, /api/live-vision-call, /api/diagnose-plant, /api/tts, /api/agronomy-advisory)
  registerApiRoutes(app);

  // WebSocket Server untuk Gemini Live API (Suara & Kamera Real-time)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/ws/live-tani") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (clientWs: WebSocket) => {
    let sessionPromise: Promise<any> | null = null;
    let isClosed = false;
    let isAnalyzingVision = false;
    let lastVisionCheckAt = 0;
    let latestCameraObservation = "";

    const ai = getGenAIClient();

    sessionPromise = ai.live
      .connect({
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
            "PENTING TENTANG PENGLIHATAN KAMERA: " +
            "Sistem secara otomatis mengirimkan pesan konteks bertanda [PENGAMATAN VISUAL KAMERA PETANI SAAT INI] yang berisi deskripsi nyata dari kamera smartphone petani setiap beberapa detik. " +
            "Gunakan informasi di dalam [PENGAMATAN VISUAL KAMERA PETANI SAAT INI] sebagai mata Anda untuk mengetahui dan menjelaskan apa yang sedang ditunjukkan petani di kameranya (apakah tanaman, daun, batang, wajah petani, atau benda lain). " +
            "JANGAN PERNAH mengatakan bahwa Anda tidak bisa melihat kamera selama ada informasi [PENGAMATAN VISUAL KAMERA PETANI SAAT INI]. " +
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
                    "Koneksi suara dua arah sedang beralih ke mode analisis visual langsung.",
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
      })
      .catch((err: any) => {
        console.error("Failed to connect to Gemini Live:", err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: "error",
              message:
                err?.message ||
                "Menggunakan mode Analisis Visual & Suara Langsung.",
            })
          );
        }
        return null;
      });

    clientWs.on("message", async (raw) => {
      if (!sessionPromise) return;
      try {
        const msg = JSON.parse(raw.toString());
        const session = await sessionPromise;
        if (!session || isClosed) return;

        if (msg.type === "audio" && msg.data) {
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (msg.type === "video" && msg.data) {
          // 1. Send video frame to Live stream
          session.sendRealtimeInput({
            video: {
              data: msg.data,
              mimeType: "image/jpeg",
            },
          });

          // 2. Run real-time Gemini Vision inspection every ~4.5 seconds (and immediately on first frame)
          const now = Date.now();
          if (!isAnalyzingVision && now - lastVisionCheckAt > 4500) {
            isAnalyzingVision = true;
            lastVisionCheckAt = now;

            inspectCameraFrameWithGemini(msg.data)
              .then((visionRes) => {
                if (isClosed) return;
                latestCameraObservation = visionRes.visualObservation;

                // Send visual observation to client HUD so farmer knows Pak Chandra sees their camera
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: "vision_observation",
                      text: visionRes.visualObservation,
                    })
                  );
                }

                // Inject into Gemini Live context silently (turnComplete: false)
                try {
                  session.sendClientContent({
                    turns: [
                      {
                        role: "user",
                        parts: [
                          {
                            text: `[PENGAMATAN VISUAL KAMERA PETANI SAAT INI]: ${visionRes.visualObservation}`,
                          },
                        ],
                      },
                    ],
                    turnComplete: false,
                  });
                } catch {
                  // ignore if session closed
                }
              })
              .finally(() => {
                isAnalyzingVision = false;
              });
          }
        } else if (msg.type === "inspect_frame_now" && msg.data) {
          // Immediate on-demand camera check triggered by the farmer
          isAnalyzingVision = true;
          lastVisionCheckAt = Date.now();
          try {
            const visionRes = await inspectCameraFrameWithGemini(msg.data, msg.question);
            latestCameraObservation = visionRes.visualObservation;

            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "vision_observation",
                  text: visionRes.visualObservation,
                })
              );
            }

            session.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `[PENGAMATAN VISUAL KAMERA PETANI SAAT INI]: ${
                        visionRes.visualObservation
                      }\n\nPetani bertanya: "${
                        msg.question ||
                        "Pak Chandra, tolong lihat kamera saya sekarang, apa yang terlihat dan bagaimana sarannya?"
                      }"\nJawab langsung dengan ramah berdasarkan pengamatan visual kamera di atas.`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
          } finally {
            isAnalyzingVision = false;
          }
        } else if (msg.type === "text" && msg.text) {
          const contextPrefix = latestCameraObservation
            ? `[PENGAMATAN VISUAL KAMERA PETANI SAAT INI]: ${latestCameraObservation}\n\n`
            : "";
          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: `${contextPrefix}Petani berkata: "${msg.text}"` }],
              },
            ],
            turnComplete: true,
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
          if (session) session.close();
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
