"use client";

import { useCallback, useRef, useState } from "react";

export function HeroDemoVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const toggleMuted = useCallback(() => {
    const video = videoRef.current;
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);
    if (video) {
      video.muted = nextMuted;
      if (!nextMuted) {
        void video.play().catch(() => {});
      }
    }
  }, [isMuted]);

  return (
    // Matches `public/videos/hero-demo.mp4` (1700x1080).
    <div className="relative mb-10 mx-auto w-full max-w-2xl aspect-[85/54] rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-success/5 bg-black/50 backdrop-blur-sm">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        aria-label="StrudelLM live coding music demo"
      >
        <source src="/videos/hero-demo.mp4" type="video/mp4" />
        Demo video (StrudelLM live coding with AI) is not supported in this browser.
      </video>

      <button
        type="button"
        onClick={toggleMuted}
        aria-pressed={!isMuted}
        aria-label={isMuted ? "Unmute demo video" : "Mute demo video"}
        className="absolute bottom-3 right-3 rounded-lg border border-border/50 bg-background/80 px-3 py-1.5 text-sm text-foreground shadow-sm backdrop-blur hover:bg-background/90"
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
