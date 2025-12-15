"use client";

export function ApiKeyMissing() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-md px-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-1">Strudel AI</h1>
          <p className="text-sm text-muted-foreground">
            Live coding with AI assistance
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-foreground mb-3">
            No API key found. Set up your Tambo API key to get started:
          </p>
          <code className="block px-4 py-2 bg-background rounded text-sm font-mono text-primary">
            npx tambo init
          </code>
          <p className="text-xs text-muted-foreground mt-3">
            Or add <code className="text-primary">NEXT_PUBLIC_TAMBO_API_KEY</code> to your{" "}
            <code className="text-primary">.env.local</code> file, then refresh the page.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Get your free API key at{" "}
          <a
            href="https://tambo.co/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            tambo.co/dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
