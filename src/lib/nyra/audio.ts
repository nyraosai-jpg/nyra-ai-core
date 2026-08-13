// Lightweight amplitude analysis used to make the orb genuinely audio-reactive.
// Returns null when Web Audio isn't available, so callers can fall back to a
// simulated animation instead of pretending to be reactive.

export interface AmplitudeMeter {
  stop: () => void;
}

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function meterFromSource(
  context: AudioContext,
  source: AudioNode,
  onLevel: (level: number) => void,
  cleanup?: () => void,
): AmplitudeMeter {
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = ((buffer[i] ?? 128) - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buffer.length);
    onLevel(Math.min(1, rms * 3.2));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      try {
        source.disconnect(analyser);
      } catch {
        /* already disconnected */
      }
      cleanup?.();
      void context.close().catch(() => undefined);
    },
  };
}

export function meterMicrophone(
  stream: MediaStream,
  onLevel: (level: number) => void,
): AmplitudeMeter | null {
  const context = createContext();
  if (!context) return null;
  return meterFromSource(context, context.createMediaStreamSource(stream), onLevel);
}

export function meterAudioElement(
  element: HTMLAudioElement,
  onLevel: (level: number) => void,
): AmplitudeMeter | null {
  const context = createContext();
  if (!context) return null;
  try {
    const source = context.createMediaElementSource(element);
    source.connect(context.destination);
    return meterFromSource(context, source, onLevel);
  } catch {
    void context.close().catch(() => undefined);
    return null;
  }
}
