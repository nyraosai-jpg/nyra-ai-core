// Social media layer. Server-side only: every call goes through the Lovable
// connector gateway, so no tokens ever reach the browser.
// Reads are free; anything that publishes is confirmation-gated.

import { gatewayFetch, isConnected } from "./gateway.server";

export type SocialPlatform = "x" | "linkedin" | "telegram";

export interface SocialAccount {
  platform: SocialPlatform;
  name: string;
  connected: boolean;
  /** Handle or display name, only when the platform is connected. */
  handle?: string;
  canPost: boolean;
  detail: string;
}

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  telegram: "Telegram",
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["x", "linkedin", "telegram"];

export function socialPlatformName(platform: string) {
  return PLATFORM_NAMES[platform as SocialPlatform] ?? platform;
}

export function socialConnected(platform?: SocialPlatform) {
  if (platform) return isConnected(platform);
  return SOCIAL_PLATFORMS.some((p) => isConnected(p));
}

export function connectedSocialPlatforms(): SocialPlatform[] {
  return SOCIAL_PLATFORMS.filter((p) => isConnected(p));
}

/** Telegram needs a destination chat; without it Nyra can read but not post. */
function telegramChatId() {
  return process.env["TELEGRAM_CHAT_ID"];
}

/* ------------------------------ accounts ------------------------------ */

async function xAccount(): Promise<SocialAccount> {
  const base: SocialAccount = {
    platform: "x",
    name: PLATFORM_NAMES.x,
    connected: false,
    canPost: false,
    detail: "Sign in with X to let Nyra read and draft posts.",
  };
  if (!isConnected("x")) return base;
  const res = await gatewayFetch<{ data?: { username?: string; name?: string } }>(
    "x",
    "/2/users/me",
  );
  if (!res.ok) {
    return { ...base, connected: true, canPost: false, detail: "Connected, but X didn't answer." };
  }
  const username = res.data.data?.username;
  return {
    platform: "x",
    name: PLATFORM_NAMES.x,
    connected: true,
    canPost: true,
    ...(username ? { handle: `@${username}` } : {}),
    detail: "Reads your timeline and posts only after you approve.",
  };
}

async function linkedinAccount(): Promise<SocialAccount> {
  const base: SocialAccount = {
    platform: "linkedin",
    name: PLATFORM_NAMES.linkedin,
    connected: false,
    canPost: false,
    detail: "Sign in with LinkedIn to draft and publish updates.",
  };
  if (!isConnected("linkedin")) return base;
  const res = await gatewayFetch<{ sub?: string; name?: string }>("linkedin", "/v2/userinfo");
  if (!res.ok) {
    return {
      ...base,
      connected: true,
      detail: "Connected, but LinkedIn didn't answer.",
    };
  }
  return {
    platform: "linkedin",
    name: PLATFORM_NAMES.linkedin,
    connected: true,
    canPost: Boolean(res.data.sub),
    ...(res.data.name ? { handle: res.data.name } : {}),
    detail: "Publishes to your feed only after you approve.",
  };
}

async function telegramAccount(): Promise<SocialAccount> {
  const base: SocialAccount = {
    platform: "telegram",
    name: PLATFORM_NAMES.telegram,
    connected: false,
    canPost: false,
    detail: "Connect Telegram to let Nyra send broadcasts.",
  };
  if (!isConnected("telegram")) return base;
  const res = await gatewayFetch<{ result?: { username?: string } }>("telegram", "/getMe");
  const chat = telegramChatId();
  return {
    platform: "telegram",
    name: PLATFORM_NAMES.telegram,
    connected: true,
    canPost: Boolean(chat),
    ...(res.ok && res.data.result?.username ? { handle: `@${res.data.result.username}` } : {}),
    detail: chat ? "Sends to your saved chat after you approve." : "Set TELEGRAM_CHAT_ID to post.",
  };
}

/** The connect-status registry Nyra and the UI both read. */
export async function socialAccounts(): Promise<SocialAccount[]> {
  return Promise.all([xAccount(), linkedinAccount(), telegramAccount()]);
}

/* -------------------------------- reads ------------------------------- */

export async function socialFeed(platform: SocialPlatform, limit = 5) {
  if (!isConnected(platform)) {
    return { ok: false as const, error: `${PLATFORM_NAMES[platform]} isn't connected yet.` };
  }
  const max = Math.min(Math.max(limit, 1), 10);

  if (platform === "x") {
    const me = await gatewayFetch<{ data?: { id?: string } }>("x", "/2/users/me");
    if (!me.ok || !me.data.data?.id) {
      return { ok: false as const, error: "Couldn't read your X account." };
    }
    const res = await gatewayFetch<{
      data?: Array<{ id: string; text: string; created_at?: string }>;
    }>("x", `/2/users/${me.data.data.id}/tweets`, {
      query: { max_results: String(Math.max(max, 5)), "tweet.fields": "created_at" },
    });
    if (!res.ok) return { ok: false as const, error: "X didn't return your posts." };
    return {
      ok: true as const,
      platform,
      posts: (res.data.data ?? []).slice(0, max).map((p) => ({
        id: p.id,
        text: p.text.slice(0, 400),
        ...(p.created_at ? { at: p.created_at } : {}),
      })),
    };
  }

  return {
    ok: false as const,
    error: `${PLATFORM_NAMES[platform]} reading isn't available yet — Nyra can still draft and post there.`,
  };
}

/* -------------------------------- writes ------------------------------ */

export async function socialPost(platform: SocialPlatform, text: string) {
  const body = text.trim();
  if (!body) return { ok: false as const, error: "There's nothing to post." };
  if (!isConnected(platform)) {
    return { ok: false as const, error: `${PLATFORM_NAMES[platform]} isn't connected yet.` };
  }

  if (platform === "x") {
    const res = await gatewayFetch<{ data?: { id?: string } }>("x", "/2/tweets", {
      method: "POST",
      body: { text: body.slice(0, 280) },
    });
    if (!res.ok) return { ok: false as const, error: "X refused the post." };
    return { ok: true as const, platform, id: res.data.data?.id };
  }

  if (platform === "linkedin") {
    const me = await gatewayFetch<{ sub?: string }>("linkedin", "/v2/userinfo");
    if (!me.ok || !me.data.sub) {
      return { ok: false as const, error: "Couldn't read your LinkedIn profile." };
    }
    const res = await gatewayFetch<{ id?: string }>("linkedin", "/v2/ugcPosts", {
      method: "POST",
      body: {
        author: `urn:li:person:${me.data.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: body.slice(0, 2900) },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      },
    });
    if (!res.ok) return { ok: false as const, error: "LinkedIn refused the post." };
    return { ok: true as const, platform, id: res.data.id };
  }

  const chat = telegramChatId();
  if (!chat) return { ok: false as const, error: "No Telegram chat is configured." };
  const res = await gatewayFetch<{ ok?: boolean }>("telegram", "/sendMessage", {
    method: "POST",
    body: { chat_id: chat, text: body.slice(0, 4000) },
  });
  if (!res.ok) return { ok: false as const, error: "Telegram refused the message." };
  return { ok: true as const, platform };
}
