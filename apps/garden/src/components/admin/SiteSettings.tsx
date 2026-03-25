import { useState, useEffect } from "react";

export function SiteSettings() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  useEffect(() => {
    // Show which env vars are configured (not values, just presence)
    fetch("/api/me")
      .then((r) => r.json())
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Environment info */}
        <section className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="text-lg font-semibold mb-3">Environment</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Platform</span>
              <span className="font-mono text-xs">Astro + Node.js</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Database</span>
              <span className="font-mono text-xs">SQLite (better-sqlite3)</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Content</span>
              <span className="font-mono text-xs">Markdown files + Astro Content Collections</span>
            </div>
          </div>
        </section>

        {/* Configuration checklist */}
        <section className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="text-lg font-semibold mb-3">Configuration</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            These settings are configured via environment variables in <code className="text-xs bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">.env</code>
          </p>
          <div className="space-y-2 text-sm">
            <ConfigItem label="BETTER_AUTH_SECRET" description="Authentication secret key" />
            <ConfigItem label="GOOGLE_CLIENT_ID" description="Google OAuth client ID" />
            <ConfigItem label="GOOGLE_CLIENT_SECRET" description="Google OAuth client secret" />
            <ConfigItem label="ADMIN_EMAIL" description="Auto-promoted admin email on first login" />
            <ConfigItem label="LLM_PROVIDER" description="AI seeding provider (anthropic or openai)" />
            <ConfigItem label="ANTHROPIC_API_KEY" description="Anthropic API key for AI seeding" />
            <ConfigItem label="OPENAI_API_KEY" description="OpenAI API key for AI seeding" />
          </div>
        </section>

        {/* Data paths */}
        <section className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="text-lg font-semibold mb-3">Data Locations</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Garden notes</span>
              <code className="text-xs bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">src/content/gardens/*/notes/</code>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Templates</span>
              <code className="text-xs bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">src/content/templates/</code>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Blog posts</span>
              <code className="text-xs bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">src/content/blog/</code>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Database</span>
              <code className="text-xs bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">data/garden.db</code>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--color-text-secondary)]">Inbox</span>
              <code className="text-xs bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">inbox/</code>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConfigItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <code className="text-xs font-mono bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">{label}</code>
        <span className="text-[var(--color-text-muted)] ml-2">{description}</span>
      </div>
    </div>
  );
}
