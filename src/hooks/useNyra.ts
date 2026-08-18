import { useCallback, useEffect, useRef, useState } from "react";
import { nyraConfirm, nyraTurn, type NyraReply } from "@/lib/nyra/ai.functions";
import { nyraSpeak } from "@/lib/nyra/tts.functions";
import { routeIntent } from "@/lib/nyra/router";
import { conversationStore, memoryStore, settingsStore, taskStore, uid } from "@/lib/nyra/storage";
import { locationStore, requestLocation } from "@/lib/nyra/location";
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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Wake detection. Accepts the configured wake word, common mishearings of it,
 * and plain "wake up" so the user can rouse Nyra without tapping anything.
 * Returns the remainder of the utterance so the question can go straight to
 * the brain in the same breath ("Nyra, what's the weather?").
 */
export function matchWake(text: string, wakeWord: string): { matched: boolean; rest: string } {
  const extras = ["hey " + wakeWord, "ok " + wakeWord, "wake up", "nyra", "naira", "neera"];
  const phrases = [wakeWord, ...extras]
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const re = new RegExp(`\\b${escapeRe(phrase)}\\b[\\s,.!?]*`, "i");
    if (re.test(text)) {
      return { matched: true, rest: text.replace(re, " ").replace(/\s+/g, " ").trim() };
    }
  }
  return { matched: false, rest: text.trim() };
}



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
  const [pending, setPending] = useState<NyraReply["pending"] | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meterRef = useRef<AmplitudeMeter | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const handsFreeRef = useRef(false);
  const awakeUntilRef = useRef(0);
  const speakingRef = useRef(false);

  /**
   * Where the orb rests between turns: back to LISTENING when hands-free is
   * still holding the mic open, otherwise IDLE.
   */
  const restState = useCallback((): OrbState => {
    return handsFreeRef.current && recognizerRef.current ? "listening" : "idle";
  }, []);

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
        setState(restState());
        return;
      }
      try {
        speakingRef.current = true;
        setState("speaking");
        activityLog.push("speaking", "Speaking…");
        const result = await nyraSpeak({
          data: { text: text.slice(0, 1800), voiceId: settings.voiceId },
        });
        if (!result.ok) {
          speakingRef.current = false;
          setError(result.error);
          setState(restState());
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
          speakingRef.current = false;
          stopMeter();
          setState(restState());
        };
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play().catch(finish);
      } catch {
        speakingRef.current = false;
        stopMeter();
        setState(restState());
      }
    },
    [settings.voiceOutputEnabled, settings.voiceId, status.ttsConfigured, stopMeter, restState],
  );


  const buildContext = useCallback(() => {
    const loc = locationStore.get();
    return {
      nowISO: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      ...(loc ? { location: { latitude: loc.latitude, longitude: loc.longitude, ...(loc.label ? { label: loc.label } : {}) } } : {}),
      memories: settings.memoryEnabled ? memoryStore.all().slice(0, 20).map((m) => m.content) : [],
      tasks: taskStore
        .all()
        .filter((t) => t.status === "open")
        .slice(0, 20)
        .map((t) => ({ id: t.id, title: t.title, priority: t.priority, status: t.status })),
    };
  }, [settings.memoryEnabled]);

  const applyClientActions = useCallback((actions: NonNullable<NyraReply["clientActions"]>) => {
    for (const action of actions) {
      if (action.type === "remember") {
        memoryStore.add({ type: "facts", content: action.content, importance: 2 });
        activityLog.push("memory", "Remembered something new.", action.content.slice(0, 90));
      } else if (action.type === "add_task") {
        taskStore.add({ title: action.title, priority: action.priority });
        activityLog.push("task", `Added task: ${action.title}`);
      } else if (action.type === "complete_task") {
        taskStore.toggle(action.id);
        activityLog.push("task", "Task completed.");
      } else if (action.type === "request_location") {
        void requestLocation().then((loc) => {
          if (loc) activityLog.push("system", "Location shared with Nyra.");
        });
      }
    }
  }, []);

  const deliver = useCallback(
    async (result: NyraReply, appendTo: Message[]) => {
      if (result.clientActions?.length) applyClientActions(result.clientActions);
      if (result.error) {
        setError(result.error);
        activityLog.push("error", result.error);
        setState("error");
        return;
      }
      if (result.toolsUsed?.length) {
        activityLog.push("system", `Used ${result.toolsUsed.join(", ")}.`);
      }
      if (result.deviceActive) setState("device_active");
      else if (result.memoryTouched) setState("memory");

      const reply: Message = {
        id: uid(),
        role: "nyra",
        content: result.text,
        createdAt: Date.now(),
        demo: result.demo,
      };
      const next = persist([...appendTo, reply]);
      setMessages(next);
      setPending(result.pending ?? null);
      await speak(result.text);
      setState((s) => (s === "speaking" ? s : restState()));
      return next;
    },
    [applyClientActions, persist, speak, restState],

  );

  const send = useCallback(
    async (input: string) => {
      const content = input.trim();
      if (!content) return;
      setError(null);
      setPartial("");
      activityLog.push("understanding", "Understanding request…", content.slice(0, 90));

      const userMessage: Message = { id: uid(), role: "user", content, createdAt: Date.now() };
      const next = persist([...conversationStore.all(), userMessage]);
      setMessages(next);
      setState("thinking");

      // A pending change waits for a plain yes or no — nothing is altered silently.
      if (pending) {
        const yes = /^(yes|yeah|yep|yup|sure|do it|go ahead|confirm|please do|ok|okay)\b/i.test(content);
        const no = /^(no|nope|cancel|stop|don'?t|nevermind|never mind)\b/i.test(content);
        if (yes || no) {
          const current = pending;
          setPending(null);
          if (no) {
            await deliver(
              { text: "Cancelled — nothing was changed.", demo: false, clientActions: [] },
              next,
            );
            return;
          }
          const result = await nyraConfirm({
            data: { tool: current.tool, argsJson: current.argsJson, context: buildContext() },
          });
          activityLog.push("system", `Confirmed: ${current.summary}`);
          await deliver(result, next);
          return;
        }
        setPending(null);
      }

      if (!status.aiConfigured) {
        const routed = await routeIntent(content);
        if (routed.handled) {
          await deliver({ text: routed.text, demo: false, clientActions: [] }, next);
          return;
        }
      }

      try {
        activityLog.push("thinking", "Reasoning…");
        const history = next
          .filter((m) => m.role !== "system")
          .slice(-12)
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          }));

        const result = await nyraTurn({ data: { messages: history, context: buildContext() } });
        await deliver(result, next);
      } catch {
        setError("Nyra couldn't reach the service. Please try again.");
        activityLog.push("error", "Nyra couldn't reach the service.");
        setState("error");
      }
    },
    [buildContext, deliver, pending, persist, status.aiConfigured],
  );

  const beginRecognition = useCallback(
    async (handsFree: boolean) => {
      setError(null);
      setPartial("");
      handsFreeRef.current = handsFree || handsFreeRef.current;
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
        onPartial: (text) => {
          // Never surface Nyra hearing her own voice.
          if (speakingRef.current) return;
          setPartial(text);
        },
        onFinal: (text) => {
          setPartial("");
          if (speakingRef.current) return; // echo of Nyra's own speech
          if (handsFree) {
            const match = matchWake(text, settings.wakeWord);
            const awake = Date.now() < awakeUntilRef.current;
            if (!match.matched && !awake) return; // ambient speech: stay resting
            awakeUntilRef.current = Date.now() + 45_000;
            const cleaned = match.matched ? match.rest : text.trim();
            if (!cleaned) {
              activityLog.push("system", "Wake word heard — Nyra is awake.");
              void speak("I'm here.");
              return;
            }
            void send(cleaned);
            return;
          }
          void send(text);
        },
        onError: (message) => {
          const transient = /didn't catch that/i.test(message);
          if (handsFree && transient) {
            // Silence between utterances is normal in hands-free — keep resting.
            setState((s) => (s === "listening" ? s : restState()));
            return;
          }
          setError(message);
          activityLog.push("error", message);
          setState("error");
          stopMeter();
          if (handsFree) handsFreeRef.current = false;
        },
      });
      recognizerRef.current = recognizer;
      await recognizer.start();
    },
    [
      send,
      settings.language,
      settings.voiceIsolation,
      settings.wakeWord,
      speak,
      stopMeter,
      restState,
    ],
  );

  const startListening = useCallback(() => beginRecognition(false), [beginRecognition]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    stopMeter();
    handsFreeRef.current = false;
    awakeUntilRef.current = 0;
    setState((s) => (s === "listening" ? "idle" : s));
  }, [stopMeter]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    speakingRef.current = false;
    stopMeter();
    setState(restState());
  }, [stopMeter, restState]);


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

  /**
   * Hands-free auto-wake: if the user left hands-free on and the microphone
   * permission is already granted, Nyra starts listening for her wake word as
   * soon as the app loads — no button press required.
   */
  useEffect(() => {
    let cancelled = false;
    const resume = async () => {
      if (!settingsStore.get().handsFree) return;
      if (!isSpeechRecognitionSupported()) return;
      if (recognizerRef.current) return;
      try {
        const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
        const status = await perms?.query({ name: "microphone" as PermissionName });
        if (!status || status.state !== "granted") return; // wait for an explicit grant
      } catch {
        return; // permissions API unavailable — wait for the user to tap once
      }
      try {
        // Quiet probe: confirm a real mic is available before auto-starting,
        // so a missing device never lands the orb in an error state on load.
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((t) => t.stop());
      } catch {
        return;
      }
      if (cancelled || recognizerRef.current) return;
      handsFreeRef.current = true;
      await beginRecognition(true);
    };
    void resume();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const confirmPending = useCallback(async () => {
    if (!pending) return;
    const current = pending;
    setPending(null);
    setState("thinking");
    const result = await nyraConfirm({
      data: { tool: current.tool, argsJson: current.argsJson, context: buildContext() },
    });
    activityLog.push("system", `Confirmed: ${current.summary}`);
    await deliver(result, conversationStore.all());
  }, [buildContext, deliver, pending]);

  const cancelPending = useCallback(() => {
    setPending(null);
    activityLog.push("system", "Change cancelled — nothing was modified.");
    setState("idle");
  }, []);

  const askLocation = useCallback(async () => {
    const loc = await requestLocation();
    activityLog.push(
      "system",
      loc ? "Location shared with Nyra." : "Location permission was declined.",
    );
    return loc;
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
    pending,
    confirmPending,
    cancelPending,
    askLocation,
    clearConversation,
    updateSettings,
  };
}
