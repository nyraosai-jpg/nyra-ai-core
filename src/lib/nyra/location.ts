// Browser geolocation, asked for once and stored locally. Revocable in Settings.

export interface StoredLocation {
  latitude: number;
  longitude: number;
  label?: string;
  at: number;
}

const KEY = "nyra.location.v1";

export const locationStore = {
  get(): StoredLocation | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoredLocation) : null;
    } catch {
      return null;
    }
  },
  set(value: StoredLocation) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(value));
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  },
};

/** Requests permission and caches coordinates. Coordinates only leave the device for weather lookups. */
export async function requestLocation(): Promise<StoredLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const value: StoredLocation = {
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
          at: Date.now(),
        };
        locationStore.set(value);
        resolve(value);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  });
}
