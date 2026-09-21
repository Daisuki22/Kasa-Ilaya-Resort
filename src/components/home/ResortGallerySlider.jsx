import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { baseClient } from "@/api/baseClient";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const FALLBACK_IMAGES = [
  { src: "/img/room_Resort%20View.jpg", title: "Resort View", subtitle: "Wide-open leisure spaces and refreshing scenery." },
  { src: "/img/room_eventplace.jpg", title: "Event Space", subtitle: "A venue designed for celebrations, reunions, and special occasions." },
  { src: "/img/room_EntireHouse_EventPlace.jpg", title: "Private Stay", subtitle: "Comfortable accommodations for families and barkada getaways." },
  { src: "/img/room_kubo.jpg", title: "Kubo Area", subtitle: "Relaxed corners for rest, dining, and poolside bonding." },
  { src: "/img/kubo_accomodation.jpg", title: "Kubo Accommodation", subtitle: "A more rustic stay experience with resort comfort." },
];

export default function ResortGallerySlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { settings } = useSiteSettings();
  const customSlides = Array.isArray(settings?.resort_gallery) ? settings.resort_gallery.filter((slide) => slide?.src) : [];

  const { data: packages = [] } = useQuery({
    queryKey: ["home-gallery-packages"],
    queryFn: () => baseClient.entities.Package.filter({ is_active: true }, "name", 50),
    enabled: customSlides.length === 0,
  });

  const packageSlides = useMemo(() => {
    const collectedSlides = [];
    const seenImages = new Set();

    for (const pkg of packages) {
      const galleryImages = Array.isArray(pkg.gallery_images) && pkg.gallery_images.length > 0
        ? pkg.gallery_images
        : [pkg.image_url].filter(Boolean);

      for (const imageUrl of galleryImages) {
        if (!imageUrl || seenImages.has(imageUrl)) {
          continue;
        }

        seenImages.add(imageUrl);
        collectedSlides.push({
          src: imageUrl,
          title: pkg.name || "Resort Experience",
          subtitle: pkg.description || "Explore another corner of Kasa Ilaya Resort.",
        });
      }
    }

    for (const fallbackImage of FALLBACK_IMAGES) {
      if (!seenImages.has(fallbackImage.src)) {
        seenImages.add(fallbackImage.src);
        collectedSlides.push(fallbackImage);
      }
    }

    return collectedSlides.slice(0, 8);
  }, [packages]);

  const slides = useMemo(() => {
    if (customSlides.length > 0) {
      return customSlides.slice(0, 8).map((slide) => ({
        src: slide.src,
        title: slide.title || "Resort Photo",
        subtitle: slide.subtitle || "Discover more of Kasa Ilaya Resort.",
      }));
    }

    return packageSlides;
  }, [customSlides, packageSlides]);

  useEffect(() => {
    if (!slides.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => (current >= slides.length ? 0 : current));
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (!slides.length) {
    return null;
  }

  const activeSlide = slides[activeIndex];

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,161,105,0.16),_transparent_42%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))] px-4 py-20 sm:px-6 lg:px-10 xl:px-14">
      <div className="w-full max-w-none space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <ImageIcon className="h-4 w-4" />
            Resort Gallery
          </div>
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Take a look around the resort before you book
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            Browse photos of the resort, accommodations, and event spaces to get a better feel for the experience on the guest side.
          </p>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,320px)]">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7 }}
            className="relative overflow-hidden rounded-lg border border-border/70 bg-card/70 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.65)]"
          >
            <div className="relative aspect-[16/9] overflow-hidden">
              <img
                key={activeSlide.src}
                src={activeSlide.src}
                alt={activeSlide.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

              {slides.length > 1 ? (
                <>
                  <div className="absolute inset-y-0 left-4 flex items-center">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 rounded-full border-white/35 bg-black/30 text-white hover:bg-black/45"
                      onClick={goToPrevious}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="absolute inset-y-0 right-4 flex items-center">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 rounded-full border-white/35 bg-black/30 text-white hover:bg-black/45"
                      onClick={goToNext}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <div className="max-w-xl rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white backdrop-blur-md sm:px-5 sm:py-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/70 sm:text-xs">Featured Photo</div>
                  <h3 className="mt-1.5 font-display text-xl font-bold sm:text-2xl">{activeSlide.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-white/80 sm:text-sm sm:leading-6">{activeSlide.subtitle}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.75 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2"
          >
            {slides.map((slide, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={`${slide.src}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`group overflow-hidden rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-primary shadow-lg shadow-primary/15"
                      : "border-border/70 bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={slide.src}
                      alt={slide.title}
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full object-cover transition duration-500 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="text-sm font-semibold text-white">{slide.title}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
