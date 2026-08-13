// Speech-to-text abstraction. Implementation #1 uses the browser's
// SpeechRecognition engine; the interface allows swapping in a server or
// local STT provider later without touching the UI.

export interface SpeechRecognizer {
  start: () => Promise<void>;
  stop: () => void;
  readonly supported: boolean;
}

export interface RecognizerOptions {
  language: string;
  /** Keep the mic open and restart after each utterance (hands-free mode). */
  continuous?: boolean;
  /** Receives the live isolated stream so callers can measure amplitude. */
  onStream?: (stream: MediaStream) => void;
  /** Enables the isolation audio chain: echo cancellation + noise suppression. */
  isolation: boolean;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function getEngine(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getEngine() !== null;
}

/**
 * Voice isolation: we explicitly request a cleaned single-speaker stream from
 * the OS/browser audio pipeline (echo cancellation, noise suppression, auto
 * gain, mono) before recognition starts, so background noise and playback of
 * Nyra's own voice are suppressed.
 */
export async function requestIsolatedMicrophone(isolation: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: isolation,
      noiseSuppression: isolation,
      autoGainControl: isolation,
      channelCount: 1,
    },
  });
}

export function createRecognizer(options: RecognizerOptions): SpeechRecognizer {
  const Engine = getEngine();
  let instance: SpeechRecognitionLike | null = null;
  let stream: MediaStream | null = null;
  let finalText = "";
  let manualStop = false;

  const releaseStream = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  return {
    supported: Engine !== null,
    async start() {
      if (!Engine) {
        options.onError(
          "Speech recognition isn't available in this browser. You can still type to Nyra.",
        );
        return;
      }
      try {
        // Acquire (and immediately hold) an isolated stream so the permission
        // prompt and the audio constraints are explicit and user-initiated.
        stream = await requestIsolatedMicrophone(options.isolation);
      } catch {
        options.onError("Nyra needs microphone permission to listen.");
        return;
      }

      options.onStream?.(stream);
      manualStop = false;
      finalText = "";
      instance = new Engine();
      instance.lang = options.language;
      instance.continuous = Boolean(options.continuous);
      instance.interimResults = true;
      instance.maxAlternatives = 1;

      instance.onresult = (event: unknown) => {
        const e = event as {
          resultIndex: number;
          results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
        };
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]!;
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += transcript;
          else interim += transcript;
        }
        options.onPartial((finalText + interim).trim());
      };

      instance.onerror = (event: unknown) => {
        const code = (event as { error?: string }).error;
        if (code === "no-speech") {
          options.onError("I didn't catch that. Try again when you're ready.");
        } else if (code === "not-allowed" || code === "service-not-allowed") {
          options.onError("Nyra needs microphone permission to listen.");
        } else if (code !== "aborted") {
          options.onError("Something went wrong while listening.");
        }
      };

      instance.onend = () => {
        const text = finalText.trim();
        finalText = "";
        if (text) options.onFinal(text);
        if (options.continuous && !manualStop) {
          // Hands-free: keep the session alive without re-prompting the user.
          try {
            instance?.start();
            return;
          } catch {
            /* fall through to release */
          }
        }
        releaseStream();
      };

      instance.start();
    },
    stop() {
      manualStop = true;
      instance?.stop();
      releaseStream();
    },
  };
}
