import { getDesignSystemSnapshot, type TokenMap } from "@/lib/design-system";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function TokenTable({ title, tokens }: { title: string; tokens: TokenMap }) {
  const entries = Object.entries(tokens).sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {entries.length} tokens
      </p>
      <div className="mt-3 overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Token</th>
              <th className="px-3 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([token, value]) => (
              <tr key={token} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{token}</td>
                <td className="px-3 py-2 font-mono text-xs">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DesignSystemPage() {
  const snapshot = await getDesignSystemSnapshot();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 rounded-xl border border-border bg-card p-5">
          <h1 className="text-2xl font-bold tracking-tight">Design System Live Spec</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is generated from your code at request time. Update tokens/components,
            refresh this page, and the spec stays in sync.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Last generated: <span className="font-mono">{snapshot.generatedAt}</span>
          </p>
        </header>

        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Source Of Truth</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {Object.entries(snapshot.sources).map(([key, file]) => (
              <li key={key}>
                <span className="font-medium text-foreground">{key}:</span> <code>{file}</code>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TokenTable title=":root Tokens" tokens={snapshot.tokens.root} />
          <TokenTable title=".dark Tokens" tokens={snapshot.tokens.dark} />
          <TokenTable title="@theme inline Tokens" tokens={snapshot.tokens.themeInline} />
          <TokenTable title="Pin Category Colors" tokens={snapshot.tokens.pinCategoryHex} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Component Recipes (Parsed)</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <h3 className="font-medium">Button</h3>
              <p className="mt-2 text-xs text-muted-foreground">Variants</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {snapshot.componentRecipes.button.variants.map((v, i) => (
                  <code key={`${v}-${i}`} className="rounded bg-muted px-2 py-0.5 text-xs">{v}</code>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Sizes</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {snapshot.componentRecipes.button.sizes.map((s, i) => (
                  <code key={`${s}-${i}`} className="rounded bg-muted px-2 py-0.5 text-xs">{s}</code>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Base classes</p>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                {snapshot.componentRecipes.button.baseClass}
              </pre>
            </div>

            <div className="rounded-lg border border-border p-3">
              <h3 className="font-medium">Input / Textarea</h3>
              <p className="mt-2 text-xs text-muted-foreground">Input class recipe</p>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                {snapshot.componentRecipes.input}
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">Textarea class recipe</p>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                {snapshot.componentRecipes.textarea}
              </pre>
            </div>

            <div className="rounded-lg border border-border p-3">
              <h3 className="font-medium">Dialog</h3>
              <p className="mt-2 text-xs text-muted-foreground">Overlay class recipe</p>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                {snapshot.componentRecipes.dialogOverlay}
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">Content class recipe</p>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                {snapshot.componentRecipes.dialogContent}
              </pre>
            </div>

            <div className="rounded-lg border border-border p-3">
              <h3 className="font-medium">Tooltip</h3>
              <p className="mt-2 text-xs text-muted-foreground">Content class recipe</p>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                {snapshot.componentRecipes.tooltipContent}
              </pre>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Raw Snapshot (JSON)</h2>
          <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted p-3 text-xs">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </section>

        {/* ── Naming Lexicon ── */}
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Naming Lexicon</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Canonical names for every page, modal, and flow. Use these exact terms when talking to Claude so there is no ambiguity.
          </p>

          {/* Pages */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pages</h3>
            <div className="mt-2 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name to use</th>
                    <th className="px-3 py-2 font-medium">Route</th>
                    <th className="px-3 py-2 font-medium">What it is</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Landing page", "/", "Public marketing / hero page"],
                    ["Login page", "/login", "Email + password or magic-link sign-in"],
                    ["Signup page", "/signup", "New account registration"],
                    ["Dashboard", "/dashboard", "Main hub — shows Given / Requested audit tabs"],
                    ["Profile page", "/dashboard/profile", "Edit display name and email"],
                    ["Settings page", "/dashboard/settings", "Change password and notification preferences"],
                    ["Set-password page", "/dashboard/set-password", "One-time page after first OAuth login"],
                    ["Archived audits page", "/dashboard/archived", "List of archived audits"],
                    ["Audit viewer", "/audit/[id]", "Full-page view of a single audit (screenshot + pins + sidebar)"],
                    ["Changelog page", "/changelog", "Product changelog / release notes"],
                    ["Design system page", "/design-system", "This page — live design tokens and lexicon"],
                  ].map(([name, route, desc]) => (
                    <tr key={route}>
                      <td className="px-3 py-2 font-medium">{name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{route}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modals & Dropdowns */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Modals &amp; Dialogs</h3>
            <div className="mt-2 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name to use</th>
                    <th className="px-3 py-2 font-medium">Component file</th>
                    <th className="px-3 py-2 font-medium">What it is / trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Add-pin modal", "AddPinModal.tsx", "Opens when you Ctrl+click a coordinate on the live page to drop a feedback pin"],
                    ["New website modal", "NewWebsiteModal.tsx", "Step 1 of Give-feedback flow — enter URL and goal"],
                    ["Share modal", "ShareModal.tsx", "Copies the public audit link; opened from the Share button inside the audit viewer"],
                    ["Share-feedback-link modal", "ShareFeedbackLinkModal.tsx", "Step 2 of Request-feedback flow — enter reviewer name and get a shareable link"],
                    ["Create floop link dropdown", "CreateFloopLinkDropdown.tsx", "Dropdown with two options: 'Request feedback' or 'Give feedback'"],
                    ["Feedback sidebar", "FeedbackSidebar.tsx", "Right-side panel in the audit viewer listing all pins and comments"],
                    ["Floop tip modal", "AuditPageClient.tsx (inline Dialog)", "\"How to add feedback\" onboarding dialog shown to authenticated users arriving at the audit viewer from the dashboard (triggered by ?floopTip=1 query param). Has a Ctrl+click animation and a 'Start flooping' CTA."],
                    ["Anonymous onboarding overlay", "AuditPageClient.tsx (inline fixed overlay)", "Full-screen Ctrl+click instruction overlay shown to unauthenticated visitors on a public audit before they can interact. Dismissed by clicking 'Start flooping feedback'."],
                    ["Login overlay", "AuditPageClient.tsx (inline fixed overlay)", "Full-screen sign-in wall that blurs the audit viewer when the audit is private and the visitor is not authenticated. Embeds the LoginForm inline."],
                    ["Mobile gate screen", "MobileGate.tsx", "Full-page frosted-glass screen that replaces all non-landing content on viewports narrower than 1024 px. Says 'Built for desktops' — not a modal, it swaps the entire layout."],
                  ].map(([name, file, desc]) => (
                    <tr key={file}>
                      <td className="px-3 py-2 font-medium">{name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{file}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Flows */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Flows</h3>
            <div className="mt-2 space-y-3">
              {[
                {
                  name: "Request-feedback flow",
                  steps: [
                    "Dashboard → Create floop link dropdown → 'Request feedback'",
                    "New website modal opens → enter URL + goal → submit",
                    "Share-feedback-link modal opens → enter reviewer name → copy link",
                  ],
                },
                {
                  name: "Give-feedback flow",
                  steps: [
                    "Dashboard → Create floop link dropdown → 'Give feedback'",
                    "New website modal opens → enter URL + goal → submit",
                    "Redirects to Audit viewer",
                    "Click on screenshot or live page → Add-pin modal → type comment → submit",
                    "Pin appears on page and in Feedback sidebar",
                  ],
                },
                {
                  name: "Pin flow",
                  steps: [
                    "Inside Audit viewer, click any coordinate on the screenshot or live page",
                    "Add-pin modal opens with that coordinate locked in",
                    "Type comment (optionally record audio) → submit",
                    "Pin marker appears on page; pin card appears in Feedback sidebar",
                    "Reply to a pin using the Pin-reply composer inside the sidebar",
                  ],
                },
                {
                  name: "Auth flow",
                  steps: [
                    "Login page → email + password OR magic link",
                    "First-time OAuth login → Set-password page",
                    "Then → Profile page to complete name / email",
                    "Ongoing: Settings page for password or notification changes",
                  ],
                },
                {
                  name: "Review-feedback flow",
                  steps: [
                    "Dashboard → 'Requested' tab → click an audit",
                    "Audit viewer opens — see reviewer pins in Feedback sidebar",
                    "Click a pin to highlight it; reply with Pin-reply composer",
                  ],
                },
                {
                  name: "Archive flow",
                  steps: [
                    "Dashboard → select audit(s) via Dashboard selection bar",
                    "Click Archive → audit moves to Archived audits page",
                    "Unarchive from Archived audits page to restore",
                  ],
                },
              ].map((flow) => (
                <div key={flow.name} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-sm">{flow.name}</p>
                  <ol className="mt-2 space-y-0.5 list-decimal list-inside text-xs text-muted-foreground">
                    {flow.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>

          {/* Key component terms */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Other Terms</h3>
            <div className="mt-2 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Term</th>
                    <th className="px-3 py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Audit", "A single feedback session — has a URL, a screenshot, pins, and metadata"],
                    ["Pin", "A positioned comment anchored to a coordinate on the screenshot or live page"],
                    ["Floop link", "The shareable URL for an audit (either a give-feedback or request-feedback audit)"],
                    ["Given tab", "Dashboard tab showing audits where the current user gave feedback"],
                    ["Requested tab", "Dashboard tab showing audits where the current user requested feedback from others"],
                    ["Live mode", "Audit viewer showing the actual live website in an iframe instead of a static screenshot"],
                    ["Screenshot mode", "Audit viewer showing a captured screenshot image"],
                    ["Minimap", "Small overview thumbnail of the full screenshot, shown inside the audit viewer for navigation"],
                    ["Dashboard selection bar", "Bottom bar that appears when one or more audit cards are checked — exposes bulk actions"],
                    ["Profile-completion banner", "Top-of-dashboard banner nudging user to fill in their profile"],
                    ["Set-password banner", "Top-of-dashboard banner nudging OAuth users to set a password"],
                  ].map(([term, meaning]) => (
                    <tr key={term as string}>
                      <td className="px-3 py-2 font-medium">{term}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
