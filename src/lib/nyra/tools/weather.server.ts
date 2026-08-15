// Keyless weather + geocoding via Open-Meteo. Server-side only.

const WMO: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "rain showers",
  81: "rain showers",
  82: "violent rain showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "thunderstorm with hail",
};

export async function geocode(place: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", place);
  url.searchParams.set("count", "1");
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
  };
  const hit = json.results?.[0];
  return hit
    ? {
        latitude: hit.latitude,
        longitude: hit.longitude,
        label: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
      }
    : null;
}

export async function getWeather(args: {
  latitude?: number;
  longitude?: number;
  place?: string;
  timezone?: string;
}) {
  let lat = args.latitude;
  let lon = args.longitude;
  let label = "your location";

  if ((lat === undefined || lon === undefined) && args.place) {
    const geo = await geocode(args.place);
    if (!geo) return { ok: false as const, error: `I couldn't find "${args.place}".` };
    lat = geo.latitude;
    lon = geo.longitude;
    label = geo.label;
  }
  if (lat === undefined || lon === undefined) {
    return {
      ok: false as const,
      error: "no_location",
      hint: "Ask the user to enable location, or ask which city they mean.",
    };
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", args.timezone || "auto");

  const res = await fetch(url);
  if (!res.ok) return { ok: false as const, error: "Weather service unavailable." };
  const json = (await res.json()) as {
    current?: Record<string, number>;
    daily?: Record<string, Array<number>>;
  };
  const c = json.current ?? {};
  const d = json.daily ?? {};

  return {
    ok: true as const,
    location: args.place ? label : "current location",
    now: {
      temperature: c["temperature_2m"],
      feelsLike: c["apparent_temperature"],
      humidity: c["relative_humidity_2m"],
      windKph: c["wind_speed_10m"],
      condition: WMO[c["weather_code"] ?? -1] ?? "unknown",
    },
    today: {
      high: d["temperature_2m_max"]?.[0],
      low: d["temperature_2m_min"]?.[0],
      rainChance: d["precipitation_probability_max"]?.[0],
      condition: WMO[d["weather_code"]?.[0] ?? -1] ?? "unknown",
    },
    tomorrow: {
      high: d["temperature_2m_max"]?.[1],
      low: d["temperature_2m_min"]?.[1],
      rainChance: d["precipitation_probability_max"]?.[1],
      condition: WMO[d["weather_code"]?.[1] ?? -1] ?? "unknown",
    },
  };
}

export async function reverseGeocode(latitude: number, longitude: number) {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", "en");
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { city?: string; locality?: string; countryName?: string };
    const city = j.city || j.locality;
    return city ? [city, j.countryName].filter(Boolean).join(", ") : null;
  } catch {
    return null;
  }
}
