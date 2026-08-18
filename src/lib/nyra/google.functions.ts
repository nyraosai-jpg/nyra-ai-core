// Per-user Google OAuth (App User Connector). Every handler runs server-side
// and requires an authenticated Nyra account — a connection is always bound to
// one signed-in person, never shared.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  deleteConnectionForUser,
  getConnectionKeyForUser,
  listConnectionsForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";
import { GATEWAY_BASE_URL, GOOGLE_SCOPES, googleConnectorEnv, type GoogleConnectorId } from "@/lib/nyra/google.shared";

function connectorClientKey(connectorId: GoogleConnectorId): string {
  const value = process.env[googleConnectorEnv(connectorId)];
  if (!value) {
    throw new Error(
      `${googleConnectorEnv(connectorId)} is not set — link the Google connector to this project first.`,
    );
  }
  return value;
}

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectorId: GoogleConnectorId }) => input)
  .handler(async ({ data, context }) => {
    const clientAPIKey = connectorClientKey(data.connectorId);
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
    const returnUrl = new URL("/oauth/google/return", origin).toString();

    const existing = await getConnectionKeyForUser(context.userId, data.connectorId);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.connectorId,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      ...(existing ? { connectionAPIKey: existing } : {}),
      credentialsConfiguration: { scopes: GOOGLE_SCOPES[data.connectorId] },
    });
    return { authorizationUrl };
  });

export const completeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    const scopes = GOOGLE_SCOPES[connectorId as GoogleConnectorId] ?? [];
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey, scopes);
    return { ok: true as const, connectorId };
  });

export const getGoogleConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = await listConnectionsForUser(context.userId);
    return rows.map((r) => ({
      connectorId: r.connector_id,
      scopes: r.scopes ?? [],
      updatedAt: r.updated_at,
    }));
  });

export const revokeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectorId: GoogleConnectorId }) => input)
  .handler(async ({ data, context }) => {
    const key = await getConnectionKeyForUser(context.userId, data.connectorId);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: data.connectorId,
        });
      } catch (error) {
        console.error("gateway disconnect failed", error);
      }
    }
    await deleteConnectionForUser(context.userId, data.connectorId);
    return { ok: true as const };
  });
