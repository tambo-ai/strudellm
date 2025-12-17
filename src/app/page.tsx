import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "StrudelLM - AI-Powered Live Coding Music",
  description:
    "Create music with AI assistance using Strudel, the live coding environment. Generate beats, melodies, and soundscapes through natural language.",
  keywords: [
    "strudel",
    "live coding",
    "music",
    "AI",
    "generative music",
    "algorithmic music",
    "tidal cycles",
  ],
  openGraph: {
    title: "StrudelLM - AI-Powered Live Coding Music",
    description:
      "Create music with AI assistance using Strudel, the live coding environment.",
    type: "website",
    url: "https://strudel.tambo.co",
    siteName: "StrudelLM",
  },
  twitter: {
    card: "summary_large_image",
    title: "StrudelLM - AI-Powered Live Coding Music",
    description:
      "Create music with AI assistance using Strudel, the live coding environment.",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="landing-glow landing-glow-1" aria-hidden="true" />
          <div className="landing-glow landing-glow-2" aria-hidden="true" />
          <div className="landing-glow landing-glow-3" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo/Title */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            <span className="text-primary">Strudel</span>
            <span className="text-foreground">LM</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            Live coding music with AI assistance
          </p>

          {/* Description */}
          <p className="text-base md:text-lg text-muted-foreground/80 mb-12 max-w-xl mx-auto leading-relaxed">
            Generate beats, melodies, and soundscapes through natural language.
            Powered by Strudel and AI.
          </p>

          {/* CTA Button */}
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-medium rounded-xl text-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Creating
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </main>

      {/* Video Section - uncomment when video asset is ready
      <section className="px-6 py-16 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8">
            See it in action
          </h2>

          <div className="relative aspect-video bg-muted rounded-xl overflow-hidden border border-border">
            <video
              className="w-full h-full object-cover"
              controls
              playsInline
              preload="metadata"
            >
              <source
                src="https://github.com/user-attachments/assets/YOUR_VIDEO.mp4"
                type="video/mp4"
              />
              <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                Your browser does not support the video tag.
              </p>
            </video>
          </div>
        </div>
      </section>
      */}

      {/* Features Section */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="Natural Language"
              description="Describe what you want to create and let AI generate the code."
            />
            <FeatureCard
              title="Live Coding"
              description="See and hear your changes in real-time as the code evolves."
            />
            <FeatureCard
              title="Learn by Doing"
              description="Explore Strudel patterns and techniques with AI guidance."
            />
          </div>
        </div>
      </section>

      {/* Built with Tambo Section */}
      <section className="px-6 py-20 border-t border-border">
        <div className="max-w-lg mx-auto text-center">
          <a
            href="https://tambo.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block group"
          >
            <img
              src="/Tambo-Vertical-Lockup-DM.svg"
              alt="Tambo"
              className="h-48 mx-auto mb-8 opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </a>
          <p className="text-lg text-foreground mb-3">
            Built by the Tambo team
          </p>
          <p className="text-muted-foreground mb-6">
            Interested in building AI-powered apps like StrudelLM? Check out
            Tambo.
          </p>
          <a
            href="https://docs.tambo.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-xl text-foreground hover:bg-muted/50 transition-colors"
          >
            Go to Tambo Docs
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            Built with{" "}
            <a
              href="https://strudel.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Strudel
            </a>{" "}
            and{" "}
            <a
              href="https://tambo.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Tambo
            </a>
          </p>
          <Link
            href="/chat"
            className="hover:text-foreground transition-colors"
          >
            Go to App
          </Link>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-card border border-border">
      <h3 className="text-lg font-medium mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
