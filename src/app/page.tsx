import type { Metadata } from "next";
import Link from "next/link";

import { HeroDemoVideo } from "@/components/landing/hero-demo-video";

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
            <span className="text-success">Strudel</span>
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

          <HeroDemoVideo />

          {/* CTA Button */}
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-success text-success-foreground font-medium rounded-xl text-lg transition-all duration-200 hover:bg-success/90 hover:scale-[1.02] active:scale-[0.98]"
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

      {/* Open Source Section */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-6">
            <svg
              className="w-8 h-8 text-foreground"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">
            Open Source
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            StrudelLM is completely open source. Check out the code, run it
            yourself, or contribute to the project.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/tambo-ai/strudellm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background font-medium rounded-xl transition-all duration-200 hover:opacity-90"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
            <a
              href="https://github.com/tambo-ai/strudellm/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-xl text-foreground hover:bg-muted/50 transition-colors"
            >
              Report an Issue
            </a>
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
              className="text-success hover:underline"
            >
              Strudel
            </a>{" "}
            and{" "}
            <a
              href="https://tambo.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-success hover:underline"
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
      <h3 className="text-lg font-medium mb-2 text-card-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
