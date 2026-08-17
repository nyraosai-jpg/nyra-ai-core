import { createFileRoute } from "@tanstack/react-router";
import { NyraShell } from "@/components/nyra/NyraShell";
import { getSocialAccounts } from "@/lib/nyra/social.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social — Nyra" },
      {
        name: "description",
        content:
          "See which social accounts Nyra can read, and keep publishing behind your explicit approval.",
      },
      { property: "og:title", content: "Social — Nyra" },
      {
        property: "og:description",
        content: "Nyra drafts posts for X, LinkedIn and Telegram, and never publishes without you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getSocialAccounts(),
  component: SocialPage,
});

function SocialPage() {
  const accounts = Route.useLoaderData();
  const anyConnected = accounts.some((a) => a.connected);

  return (
    <NyraShell>
      <div className="space-y-5 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Social</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nyra reads what you've posted and drafts new updates in your voice. Nothing is ever
            published until you approve it out loud or tap approve.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <article
              key={a.platform}
              className="rounded-2xl border border-border/60 bg-nyra-panel p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base">{a.name}</h2>
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      a.connected ? "bg-primary" : "bg-muted-foreground/50",
                    )}
                    aria-hidden="true"
                  />
                  {a.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              {a.handle ? (
                <p className="mt-1 text-sm text-foreground/80">{a.handle}</p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">{a.detail}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {a.canPost ? "Drafting and approved posting available" : "Drafting only"}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
          <h2 className="text-lg">How posting works</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li>Ask Nyra for a post and she drafts it — no account is touched.</li>
            <li>She reads the draft back and shows a permission card.</li>
            <li>Only after you approve does it leave your device.</li>
          </ul>
          {!anyConnected ? (
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              No social account connected yet — drafting still works
            </p>
          ) : null}
        </section>
      </div>
    </NyraShell>
  );
}
