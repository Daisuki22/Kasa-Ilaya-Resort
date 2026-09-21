import React, { useState } from "react";
import { PlayCircle, Video, MapPin, MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";

const RESORT_VIDEO = {
  embedUrl: "",
  localVideoUrl: "/img/video.mp4",
  posterUrl: "/img/room_Resort%20View.jpg",
};

export default function VideoPresentationSection() {
  const [loadFailed, setLoadFailed] = useState(false);
  const { isAuthenticated } = useAuth();
  const hasEmbed = RESORT_VIDEO.embedUrl.trim() !== "";

  return (
    <section
      id="video-presentation"
      className="relative overflow-hidden bg-[linear-gradient(180deg,hsl(var(--muted)/0.55),hsl(var(--background)))] py-24 sm:py-28 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
      <div className="relative grid w-full max-w-none gap-14 px-2 sm:px-3 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16 lg:px-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <Video className="h-4 w-4" />
            Welcome to Kasa Ilaya
          </div>
          <h2 className="mt-6 font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            See Kasa Ilaya before you book
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg lg:text-xl">
            Explore the resort atmosphere, event-ready spaces, and stay options in one presentation view through the Kasa Ilaya resort video.
          </p>

          <div className="mt-8 space-y-4 text-sm text-muted-foreground sm:text-base">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              <span>Best for showcasing cottages, pool views, event space setup, and accommodation highlights.</span>
            </div>
            <div className="flex items-start gap-3">
              <MapIcon className="mt-0.5 h-4 w-4 text-primary" />
              <span>Located in Kaong Silang, Cavite.</span>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild className="gap-2">
              <a href={createPageUrl("Packages")}>View Packages</a>
            </Button>
            {!isAuthenticated ? (
              <Button asChild variant="outline" className="gap-2">
                <a href={createPageUrl("Login")}>Register Now!</a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card shadow-[0_20px_60px_rgba(15,23,42,0.12)] lg:origin-center lg:scale-[1.02]">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/45 px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
            <span>Kasa Ilaya Resort & Event Place</span>
          </div>

          <div className="relative aspect-video min-h-[360px] bg-black pt-12 sm:min-h-[420px] lg:min-h-[520px]">
            {hasEmbed ? (
              <iframe
                className="h-full w-full"
                src={RESORT_VIDEO.embedUrl}
                title="Welcome To Kasa Ilaya Resort"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <>
                <video
                  className="h-full w-full object-cover"
                  controls
                  preload="metadata"
                  poster={RESORT_VIDEO.posterUrl}
                  onError={() => setLoadFailed(true)}
                >
                  <source src={RESORT_VIDEO.localVideoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>

                {loadFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center text-white backdrop-blur-sm">
                    <PlayCircle className="h-12 w-12 text-secondary" />
                    <div>
                      <p className="text-lg font-semibold">Presentation video unavailable</p>
                      <p className="mt-2 text-sm text-white/80">Add the official resort MP4 to enable playback in this section.</p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
