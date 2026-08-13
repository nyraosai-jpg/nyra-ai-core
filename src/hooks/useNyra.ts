import { useCallback, useEffect, useRef, useState } from "react";
import { nyraReply } from "@/lib/nyra/ai.functions";
import { nyraSpeak } from "@/lib/nyra/tts.functions";
import { buildMemoryContext, routeIntent } from "@/lib/nyra/router";
import { conversationStore, settingsStore, uid } from "@/lib/nyra/storage";
import { createRecognizer, isSpeechRecognitionSupported } from "@/lib/nyra/stt";
import { activityLog } from "@/lib/nyra/activity";
import { meterAudioElement, meterMicrophone, type AmplitudeMeter } from "@/lib/nyra/audio";
import type { Message, NyraSettings, OrbState } from "@/lib/nyra/types";

export interface NyraStatusInfo {
  aiConfigured: boolean;
  aiModel: string;
  ttsConfigured: boolean;
}

const orbLabels: Record<OrbState, string> = {
  idle: "Nyra is here.",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  connecting: "Connecting…",
  device_active: "Acting on your home…",
  memory: "Remembering…",
  error: "Something went wrong.",
};

/**
 * The conversation engine + orb state machine.
 * IDLE -> LISTENING -> THINKING -> (DEVICE_ACTIVE|MEMORY) -> SPEAKING -> IDLE.
 */
export function useNyra(status: NyraStatusInfo) {
  const [state, setState] = useState<OrbState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [audioReactive, setAudioReactive] = useState(false);
  const [settings, setSettings] = useState<NyraSettings>(() => settingsStore.get());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meterRef = useRef<AmplitudeMeter | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const handsFreeRef = useRef(false);
  const awakeUntilRef = useRef(0);

  useEffect(() => {
    setMessages(conversationStore.all());
    setSettings(settingsStore.get());
  }, []);

  const stopMeter = useCallback(() => {
    meterRef.current?.stop();
    meterRef.current = null;
    setAudioReactive(false);
    setLevel(0);
  }, []);

  const persist = useCallback((next: Message[]) => {
    conversationStore.save(next);
    return next;
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!settings.voiceOutputEnabled || !status.ttsConfigured) {
        setState("idle");
        return;
      }
      try {
        setState("speaking");
        activityLog.push("speaking", "Speaking…");
        const result = await nyraSpeak({
          data: { text: text.slice(0, 1800), voiceId: settings.voiceId },
        });
        if (!result.ok) {
          setError(result.error);
          setState("idle");
          return;
        }
        const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
        const meter = meterAudioElement(audio, setLevel);
        if (meter) {
          meterRef.current = meter;
          setAudioReactive(true);
        }
        const finish = () => {
          stopMeter();
          setState("idle");
        };
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play().catch(finish);
      } catch {
        stopMeter();
        setState("idle");
      }
    },
    [settings.voiceOutputEnabled, settings.voiceId, status.ttsConfigured, stopMeter],
  );

  const send = useCallback(
    async (input: string) => {
      const content = input.trim();
      if (!content) return;
      setError(null);
      setPartial("");
      activityLog.push("understanding", "Understanding request…", content.slice(0, 90));

      const userMessage: Message = { id: uid(), role: "user", content, createdAt: Date.now() };
      let next = persist([...conversationStore.all(), userMessage]);
      setMessages(next);
      setState("thinking");

      // 1) Local + device skill routing runs first.
      const routed = await routeIntent(content);
      if (routed.handled) {
        if (routed.deviceActive) {
          setState("device_active");
          activityLog.push("device", routed.text);
        } else if (routed.memoryTouched) {
          setState("memory");
          activityLog.push("memory", routed.text.slice(0, 90));
        } else {
          activityLog.push("system", routed.text.slice(0, 90));
        }
        const reply: Message = {
          id: uid(),
          role: "nyra",
          content: routed.text,
          createdAt: Date.now(),
        };
        next = persist([...next, reply]);
        setMessages(next);
        await new Promise((r) => setTimeout(r, routed.deviceActive ? 600 : 250));
        await speak(routed.text);
        setState((s) => (s === "speaking" ? s : "idle"));
        return;
      }

      // 2) Otherwise the brain answers, grounded in memory.
      try {
        activityLog.push("thinking", "Reasoning with Groq…");
        const history = next
          .filter((m) => m.role !== "system")
          .slice(-12)
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          }));

        const memoryContext = settings.memoryEnabled ? buildMemoryContext() : "";
        const result = await nyraReply({
          data: memoryContext ? { messages: history, memoryContext } : { messages: history },
        });

        if (result.error) {
          setError(result.error);
          activityLog.push("error", result.error);
          setState("error");
          return;
        }

        const reply: Message = {
          id: uid(),
          role: "nyra",
          content: result.text,
          createdAt: Date.now(),
          demo: result.demo,
        };
        next = persist([...next, reply]);
        setMessages(next);
        await speak(result.text);
        setState((s) => (s === "speaking" ? s : "idle"));
      } catch {
        setError("Nyra couldn't reach the service. Please try again.");
        activityLog.push("error", "Nyra couldn't reach the service.");
        setState("error");
      }
    },
    [persist, settings.memoryEnabled, speak],
  );

  const beginRecognition = useCallback(
    async (handsFree: boolean) => {
      setError(null);
      setPartial("");
      setState("listening");
      activityLog.push("listening", handsFree ? "Hands-free listening started." : "Listening…");

      const recognizer = createRecognizer({
        language: settings.language,
        isolation: settings.voiceIsolation,
        continuous: handsFree,
        onStream: (stream) => {
          const meter = meterMicrophone(stream, setLevel);
          if (meter) {
            meterRef.current = meter;
            setAudioReactive(true);
          }
        },
        onPartial: setPartial,
        onFinal: (text) => {
          setPartial("");
          if (handsFree) {
            const wake = settings.wakeWord.toLowerCase();
            const heard = text.toLowerCase();
            const awake = Date.now() < awakeUntilRef.current;
            if (!heard.includes(wake) && !awake) return; // ignore ambient speech
            awakeUntilRef.current = Date.now() + 45_000;
            const cleaned = heard.includes(wake)
              ? text.replace(new RegExp(`\\b${settings.wakeWord}\\b[,\\s]*`, "i"), "").trim()
              : text;
            if (!cleaned) {
              void speak("I'm here.");
              return;
            }
            void send(cleaned);
            return;
          }
          void send(text);
        },
        onError: (message) => {
          setError(message);
          activityLog.push("error", message);
          setState("error");
          stopMeter();
        },
      });
      recognizerRef.current = recognizer;
      await recognizer.start();
    },
    [send, settings.language, settings.voiceIsolation, settings.wakeWord, speak, stopMeter],
  );

  const startListening = useCallback(() => beginRecognition(false), [beginRecognition]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    stopMeter();
    handsFreeRef.current = false;
    setState((s) => (s === "listening" ? "idle" : s));
  }, [stopMeter]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    stopMeter();
    setState("idle");
  }, [stopMeter]);

  const setHandsFree = useCallback(
    async (enabled: boolean) => {
      settingsStore.set({ handsFree: enabled });
      setSettings(settingsStore.get());
      handsFreeRef.current = enabled;
      if (enabled) {
        activityLog.push("system", "Hands-free mode enabled.");
        await beginRecognition(true);
      } else {
        activityLog.push("system", "Hands-free mode disabled.");
        recognizerRef.current?.stop();
        recognizerRef.current = null;
        stopMeter();
        setState("idle");
      }
    },
    [beginRecognition, stopMeter],
  );

  useEffect(
    () => () => {
      recognizerRef.current?.stop();
      meterRef.current?.stop();
    },
    [],
  );

  const clearConversation = useCallback(() => {
    conversationStore.clear();
    setMessages([]);
    setState("idle");
    setError(null);
  }, []);

  const updateSettings = useCallback((patch: Partial<NyraSettings>) => {
    settingsStore.set(patch);
    setSettings(settingsStore.get());
  }, []);

  return {
    state,
    statusLabel: error && state === "error" ? error : orbLabels[state],
    level,
    audioReactive,
    messages,
    partial,
    error,
    settings,
    handsFree: handsFreeRef.current,
    micSupported: isSpeechRecognitionSupported(),
    send,
    startListening,
    stopListening,
    stopSpeaking,
    setHandsFree,
    clearConversation,
    updateSettings,
  };
}
