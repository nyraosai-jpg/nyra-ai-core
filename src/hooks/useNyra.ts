import { useCallback, useEffect, useRef, useState } from "react";
import { nyraReply } from "@/lib/nyra/ai.functions";
import { nyraSpeak } from "@/lib/nyra/tts.functions";
import { buildMemoryContext, routeIntent } from "@/lib/nyra/router";
import { conversationStore, settingsStore, uid } from "@/lib/nyra/storage";
import { createRecognizer, isSpeechRecognitionSupported } from "@/lib/nyra/stt";
import type { Message, NyraSettings, VoiceState } from "@/lib/nyra/types";

export interface NyraStatusInfo {
  aiConfigured: boolean;
  aiModel: string;
  ttsConfigured: boolean;
}

/**
 * The conversation engine + voice state machine.
 * IDLE -> LISTENING -> PROCESSING -> SPEAKING -> IDLE (or ERROR).
 */
export function useNyra(status: NyraStatusInfo) {
  const [state, setState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NyraSettings>(() => settingsStore.get());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer> | null>(null);

  useEffect(() => {
    setMessages(conversationStore.all());
    setSettings(settingsStore.get());
  }, []);

  const persist = useCallback((next: Message[]) => {
    conversationStore.save(next);
    return next;
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!settings.voiceOutputEnabled || !status.ttsConfigured) return;
      try {
        setState("speaking");
        const result = await nyraSpeak({ data: { text: text.slice(0, 1800), voiceId: settings.voiceId } });
        if (!result.ok) {
          setError(result.error);
          setState("idle");
          return;
        }
        const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => setState("idle");
        audio.onerror = () => setState("idle");
        await audio.play().catch(() => setState("idle"));
      } catch {
        setState("idle");
      }
    },
    [settings.voiceOutputEnabled, settings.voiceId, status.ttsConfigured],
  );

  const send = useCallback(
    async (input: string) => {
      const content = input.trim();
      if (!content) return;
      setError(null);
      setPartial("");

      const userMessage: Message = { id: uid(), role: "user", content, createdAt: Date.now() };
      let next = persist([...conversationStore.all(), userMessage]);
      setMessages(next);
      setState("processing");

      // 1) Local skill routing (memory, tasks, planning) runs first.
      const routed = routeIntent(content);
      if (routed.handled) {
        const reply: Message = {
          id: uid(),
          role: "nyra",
          content: routed.text,
          createdAt: Date.now(),
        };
        next = persist([...next, reply]);
        setMessages(next);
        await speak(routed.text);
        setState((s) => (s === "speaking" ? s : "idle"));
        return;
      }

      // 2) Otherwise the brain answers, grounded in memory.
      try {
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
        setState("error");
      }
    },
    [persist, settings.memoryEnabled, speak],
  );

  const startListening = useCallback(async () => {
    setError(null);
    setPartial("");
    setState("listening");
    const recognizer = createRecognizer({
      language: settings.language,
      isolation: settings.voiceIsolation,
      onPartial: setPartial,
      onFinal: (text) => {
        setPartial("");
        void send(text);
      },
      onError: (message) => {
        setError(message);
        setState("error");
      },
    });
    recognizerRef.current = recognizer;
    await recognizer.start();
  }, [send, settings.language, settings.voiceIsolation]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setState((s) => (s === "listening" ? "idle" : s));
  }, []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }, []);

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
    messages,
    partial,
    error,
    settings,
    micSupported: isSpeechRecognitionSupported(),
    send,
    startListening,
    stopListening,
    stopSpeaking,
    clearConversation,
    updateSettings,
  };
}
