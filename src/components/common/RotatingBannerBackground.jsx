import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function RotatingBannerBackground({
  images,
  alt = "Page banner",
  intervalMs = 9000,
  overlayClassName = "bg-gradient-to-r from-black/75 via-black/45 to-transparent",
}) {
  const bannerImages = Array.isArray(images) && images.length > 0 ? images : ["/img/room_Resort%20View.jpg"];
  const [activeIndex, setActiveIndex] = useState(0);
  const showControls = bannerImages.length > 1;
  const activeImage = bannerImages[activeIndex] || bannerImages[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [bannerImages.length]);

  useEffect(() => {
    if (!showControls) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % bannerImages.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [bannerImages.length, intervalMs, showControls]);

  const showPrevious = () => {
    setActiveIndex((current) => (current === 0 ? bannerImages.length - 1 : current - 1));
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % bannerImages.length);
  };

  return (
    <div className="absolute inset-0">
      <div
        className="h-full w-full"
      >
        <img
          key={`${activeImage}-${activeIndex}`}
          src={activeImage}
          alt={`${alt} ${activeIndex + 1}`}
          loading={activeIndex === 0 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={activeIndex === 0 ? "high" : "auto"}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black/55" />
      <div className={`absolute inset-0 ${overlayClassName}`} />

      {showControls ? (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 sm:flex"
            aria-label="Show previous banner image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 sm:flex"
            aria-label="Show next banner image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-sm">
            {bannerImages.map((_, index) => (
              <button
                key={`banner-dot-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-8 bg-secondary" : "w-2.5 bg-white/60 hover:bg-white/85"}`}
                aria-label={`Show banner image ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
