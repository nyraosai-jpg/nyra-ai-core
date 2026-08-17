import { createServerFn } from "@tanstack/react-start";
import type { SocialAccount } from "./tools/social.server";

/** Connect-status registry for the UI. Contains no secrets. */
export const getSocialAccounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<SocialAccount[]> => {
    const { socialAccounts } = await import("./tools/social.server");
    try {
      return await socialAccounts();
    } catch (e) {
      console.error("social status failed", e);
      return [];
    }
  },
);
