"use client";

import { useCallback, useRef, useState } from "react";

export function HeroDemoVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const toggleMuted = useCallback(() => {
    setIsMuted((prevMuted) => {
      const video = videoRef.current;
      const nextMuted = !prevMuted;

      if (video) {
        video.muted = nextMuted;
        if (!nextMuted) {
          void video.play().catch(() => {
            // Ignore: some browsers block play() depending on autoplay policy.
          });
        }
      }

      return nextMuted;
    });
  }, []);

  return (
    // Matches `public/videos/hero-demo.mp4` (1700x1080).
    <div className="relative mb-10 w-full aspect-[85/54] rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-success/5 bg-black/50 backdrop-blur-sm">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        // Only loop while muted to reduce the chance of unexpected background audio.
        loop={isMuted}
        muted={isMuted}
        playsInline
        preload="metadata"
        poster="/videos/hero-demo-poster.jpg"
        aria-label="StrudelLM live coding music demo"
      >
        <source src="/videos/hero-demo.mp4" type="video/mp4" />
        Demo video (StrudelLM live coding with AI) is not supported in this browser.
      </video>

      <button
        type="button"
        onClick={toggleMuted}
        aria-pressed={!isMuted}
        aria-label={isMuted ? "Unmute demo video audio" : "Mute demo video audio"}
        className="absolute bottom-3 right-3 rounded-lg border border-border/50 bg-background/80 px-3 py-1.5 text-sm text-foreground shadow-sm backdrop-blur hover:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
