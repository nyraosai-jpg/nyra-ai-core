// Spotify playback through the Lovable connector gateway. Server-side only.
// Account-based: no local network access and no tokens in the browser.

import { gatewayFetch, isConnected } from "./gateway.server";

export const spotifyConnected = () => isConnected("spotify");

interface Track {
  name: string;
  artists?: Array<{ name: string }>;
  uri: string;
  album?: { name: string };
}

export async function nowPlaying() {
  const res = await gatewayFetch<{ item?: Track; is_playing?: boolean }>(
    "spotify",
    "/v1/me/player/currently-playing",
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  const item = res.data.item;
  if (!item) return { ok: true as const, playing: false };
  return {
    ok: true as const,
    playing: Boolean(res.data.is_playing),
    track: item.name,
    artist: item.artists?.map((a) => a.name).join(", "),
    album: item.album?.name,
  };
}

export async function playbackCommand(command: "play" | "pause" | "next" | "previous") {
  const map = {
    play: { path: "/v1/me/player/play", method: "PUT" },
    pause: { path: "/v1/me/player/pause", method: "PUT" },
    next: { path: "/v1/me/player/next", method: "POST" },
    previous: { path: "/v1/me/player/previous", method: "POST" },
  } as const;
  const { path, method } = map[command];
  const res = await gatewayFetch<unknown>("spotify", path, { method });
  if (!res.ok) {
    return {
      ok: false as const,
      error:
        res.status === 404
          ? "No active Spotify device. Open Spotify on a device first."
          : res.error,
    };
  }
  return { ok: true as const, command };
}

export async function playSearch(query: string) {
  const found = await gatewayFetch<{ tracks?: { items?: Track[] } }>("spotify", "/v1/search", {
    query: { q: query.slice(0, 200), type: "track", limit: "1" },
  });
  if (!found.ok) return { ok: false as const, error: found.error };
  const track = found.data.tracks?.items?.[0];
  if (!track) return { ok: false as const, error: `Nothing found for "${query}".` };

  const res = await gatewayFetch<unknown>("spotify", "/v1/me/player/play", {
    method: "PUT",
    body: { uris: [track.uri] },
  });
  if (!res.ok) {
    return {
      ok: false as const,
      error:
        res.status === 404
          ? "No active Spotify device. Open Spotify on a device first."
          : res.error,
    };
  }
  return {
    ok: true as const,
    track: track.name,
    artist: track.artists?.map((a) => a.name).join(", "),
  };
}
