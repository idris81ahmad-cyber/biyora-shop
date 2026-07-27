"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { toast } from "sonner";

type ConnectionState = "idle" | "connecting" | "live" | "error";

const SUPPORT_INSTRUCTIONS = `You are the warm, knowledgeable voice support agent for BIYORA SHOP — a premium African textiles store that sources authentic Ankara, Swiss/French lace, Guinea brocade, Adire, silk and more from Kano's famous Kantin Kwari Market.

Help customers with:
- Product questions, fabric quality, colours, and recommended uses
- Order status, tracking, and delivery windows (Kano & Abuja 2–4 days, Lagos 3–6 days, other states 3–7 days)
- Sizing, yardage, and the fabric calculator
- Payments (Paystack), returns (7-day policy), and wholesale inquiries
- General shopping advice

Speak naturally and concisely for voice. Use friendly Nigerian English where it feels natural. If a question is complex or needs human follow-up, politely offer to continue on WhatsApp. Never invent order numbers or inventory. Always stay in character as BIYORA support.`;

export default function VoiceSupportButton() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const stateRef = useRef<ConnectionState>("idle");
  stateRef.current = state;

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setState("idle");
    setTranscript("");
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;
    const ctx = audioContextRef.current;
    if (!ctx) return;

    isPlayingRef.current = true;
    const chunk = playbackQueueRef.current.shift()!;
    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.copyToChannel(Float32Array.from(chunk), 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
    source.start();
  }, []);

  const startSession = async () => {
    if (state === "connecting" || state === "live") return;

    setState("connecting");
    setTranscript("");

    try {
      // 1. Get short-lived client secret from our secure API route
      const secretRes = await fetch("/api/voice/client-secret", { method: "POST" });
      const secretPayload = (await secretRes.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        code?: string;
        client_secret?: string;
        agent_id?: string | null;
        realtimeUrl?: string;
        protocol?: string;
      };
      if (!secretRes.ok) {
        const msg = [secretPayload.error, secretPayload.hint].filter(Boolean).join(" ");
        throw new Error(msg || "Could not start voice session");
      }
      const client_secret = secretPayload.client_secret;
      if (!client_secret) {
        throw new Error("Voice session token missing — check XAI_API_KEY on the server");
      }
      const agent_id = secretPayload.agent_id;

      // 2. Open WebSocket to xAI (browser-safe auth via protocol header)
      const model = "grok-voice-latest";
      const url =
        secretPayload.realtimeUrl ||
        (agent_id
          ? `wss://api.x.ai/v1/realtime?agent_id=${encodeURIComponent(agent_id)}`
          : `wss://api.x.ai/v1/realtime?model=${model}`);

      const protocol =
        secretPayload.protocol || `xai-client-secret.${client_secret}`;
      const ws = new WebSocket(url, [protocol]);
      wsRef.current = ws;

      let opened = false;
      const openTimeout = window.setTimeout(() => {
        if (!opened && ws.readyState !== WebSocket.OPEN) {
          toast.error(
            "Could not reach Grok Voice. Check network / that XAI_API_KEY is a valid console.x.ai key.",
          );
          setState("error");
          cleanup();
        }
      }, 12_000);

      ws.onopen = async () => {
        opened = true;
        window.clearTimeout(openTimeout);
        try {
          // Configure the session for BIYORA support
          ws.send(
            JSON.stringify({
              type: "session.update",
              session: {
                voice: process.env.NEXT_PUBLIC_XAI_VOICE || "eve",
                instructions: SUPPORT_INSTRUCTIONS,
                turn_detection: { type: "server_vad" },
                audio: {
                  input: { format: { type: "audio/pcm", rate: 24000 } },
                  output: { format: { type: "audio/pcm", rate: 24000 } },
                },
              },
            }),
          );

          // Greet the customer
          ws.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: "Hello, I need help with BIYORA SHOP.",
                  },
                ],
              },
            }),
          );
          ws.send(JSON.stringify({ type: "response.create" }));

          // 3. Start microphone (after WS is open so first audio isn't dropped)
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          mediaStreamRef.current = stream;

          const ctx = new AudioContext({ sampleRate: 24000 });
          if (ctx.state === "suspended") await ctx.resume();
          audioContextRef.current = ctx;

          const source = ctx.createMediaStreamSource(stream);
          // ScriptProcessor is deprecated but still the most compatible for PCM16 streaming
          const processor = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (e) => {
            if (
              isMutedRef.current ||
              !wsRef.current ||
              wsRef.current.readyState !== WebSocket.OPEN
            ) {
              return;
            }

            const input = e.inputBuffer.getChannelData(0);
            // Convert float32 [-1,1] → int16 PCM
            const pcm = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]!));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            // Base64 encode and send
            const bytes = new Uint8Array(pcm.buffer);
            let binary = "";
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode(
                ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
              );
            }
            const base64 = btoa(binary);

            ws.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64,
              }),
            );
          };

          source.connect(processor);
          // ScriptProcessor must stay in the graph; mute to avoid mic→speaker feedback
          const gain = ctx.createGain();
          gain.gain.value = 0;
          processor.connect(gain);
          gain.connect(ctx.destination);

          setState("live");
          toast.success("Grok Voice connected — speak now");
        } catch (inner) {
          console.error(inner);
          toast.error(
            inner instanceof Error
              ? inner.message
              : "Microphone permission is required for voice",
          );
          setState("error");
          cleanup();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);

          if (msg.type === "response.output_audio_transcript.delta") {
            setTranscript((prev) => prev + (msg.delta || ""));
          } else if (
            (msg.type === "response.output_audio.delta" ||
              msg.type === "response.audio.delta") &&
            msg.delta
          ) {
            // Decode base64 PCM16 → Float32 and queue for playback
            const binary = atob(msg.delta);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
              float32[i] = pcm16[i]! / 32768;
            }
            playbackQueueRef.current.push(float32);
            playNextChunk();
          } else if (msg.type === "error") {
            console.error("xAI realtime error", msg);
            const errMsg =
              msg.error?.message ||
              (typeof msg.error === "string" ? msg.error : null) ||
              "Voice error";
            toast.error(errMsg);
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = () => {
        window.clearTimeout(openTimeout);
        if (!opened) {
          toast.error("Voice connection failed — invalid key or network issue");
        } else {
          toast.error("Voice connection error");
        }
        setState("error");
        cleanup();
      };

      ws.onclose = () => {
        window.clearTimeout(openTimeout);
        if (stateRef.current === "live" || stateRef.current === "connecting") {
          toast.message("Voice session ended");
        }
        cleanup();
      };
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not start voice support");
      setState("error");
      cleanup();
    }
  };

  const endSession = () => {
    cleanup();
    toast.message("Voice support ended");
  };

  if (state === "idle" || state === "error") {
    return (
      <button
        type="button"
        onClick={startSession}
        className="fixed bottom-36 md:bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#6B2D3C] text-white pl-3.5 pr-4 py-3 shadow-lg shadow-rose-900/25 hover:bg-[#5a2532] transition min-h-[48px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A46E]"
        aria-label="Talk to BIYORA with Grok Voice"
      >
        <Volume2 className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm font-semibold hidden sm:inline">Voice Support</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-36 md:bottom-24 right-4 z-40 flex flex-col items-end gap-2">
      {transcript && (
        <div className="max-w-[260px] rounded-2xl bg-white/95 border border-[#D4C9B8] shadow-lg px-3 py-2 text-xs text-[#4A4038] leading-relaxed">
          {transcript.slice(-180)}
          {transcript.length > 180 ? "…" : ""}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full bg-[#6B2D3C] text-white pl-2 pr-3 py-2 shadow-lg">
        <button
          type="button"
          onClick={() => setIsMuted((m) => !m)}
          className="p-2 rounded-full hover:bg-white/10 transition"
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <span className="text-xs font-medium animate-pulse">
          {state === "connecting" ? "Connecting…" : "Listening"}
        </span>
        <button
          type="button"
          onClick={endSession}
          className="p-2 rounded-full bg-red-500/90 hover:bg-red-600 transition"
          aria-label="End voice call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
