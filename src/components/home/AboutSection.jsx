import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
  TreePalm,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getPageBannerImages } from "@/lib/pageBannerImages";
import RotatingBannerBackground from "@/components/common/RotatingBannerBackground";

const fallbackGallery = [
  {
    src: "/img/room_Resort%20View.jpg",
    title: "Resort View",
    subtitle: "Open resort spaces with a quiet, refreshing setting.",
  },
  {
    src: "/img/room_eventplace.jpg",
    title: "Event Place",
    subtitle: "Flexible venue space for private celebrations and reunions.",
  },
  {
    src: "/img/room_EntireHouse_EventPlace.jpg",
    title: "Private Stay",
    subtitle: "Comfortable accommodation for family and group visits.",
  },
  {
    src: "/img/room_kubo.jpg",
    title: "Kubo Area",
    subtitle: "Relaxed corners for meals, rest, and poolside bonding.",
  },
];

const values = [
  {
    icon: HeartHandshake,
    title: "Warm Local Hospitality",
    description: "Guests are welcomed with clear communication, practical support, and a relaxed resort atmosphere.",
  },
  {
    icon: ShieldCheck,
    title: "Comfort With Care",
    description: "The resort experience is managed around safety, cleanliness, and straightforward booking expectations.",
  },
  {
    icon: Sparkles,
    title: "Simple Celebrations",
    description: "From quick escapes to private events, spaces are arranged to make planning easier for every group.",
  },
];

const milestones = [
  "Family-friendly resort spaces for day tours, overnight stays, and gatherings.",
  "Amenity and booking management designed around guest convenience.",
  "Event-ready areas for birthdays, reunions, and intimate celebrations.",
];

export default function AboutSection({ standalone = false }) {
  const { settings } = useSiteSettings();

  const gallery = useMemo(() => {
    const slides = Array.isArray(settings?.resort_gallery)
      ? settings.resort_gallery.filter((slide) => slide?.src)
      : [];

    return (slides.length > 0 ? slides : fallbackGallery).slice(0, 4).map((slide) => ({
      src: slide.src,
      title: slide.title || "Kasa Ilaya Resort",
      subtitle: slide.subtitle || "A welcoming resort space for rest, events, and shared moments.",
    }));
  }, [settings?.resort_gallery]);

  const homeSectionImage = gallery[0]?.src || settings?.hero_image_url || "/img/room_Resort%20View.jpg";
  const pageBannerImages = getPageBannerImages(settings);
  const pageBannerImage = pageBannerImages[0];
  const heroImage = standalone ? pageBannerImage : homeSectionImage;
  const siteName = settings?.site_name?.trim() || "Kasa Ilaya";

  if (!standalone) {
    return (
      <section id="about-us" className="bg-background py-20 sm:py-24 lg:py-28">
        <div className="grid w-full max-w-none gap-10 px-2 sm:px-3 lg:grid-cols-[0.95fr_1.05fr] lg:px-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <img src={heroImage} alt={`${siteName} resort view`} loading="lazy" decoding="async" className="aspect-[4/3] h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">About Us</span>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              A resort built for quiet escapes and memorable celebrations.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
              {siteName} Resort & Event Place welcomes guests looking for a comfortable getaway, flexible event space,
              and a place where families and friends can slow down together.
            </p>
            <div className="mt-7">
              <Button asChild className="gap-2">
                <Link to={createPageUrl("About")}>
                  Learn more
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="bg-background">
      <section className="relative min-h-[34rem] overflow-hidden bg-foreground text-white lg:min-h-[38rem]">
        <RotatingBannerBackground images={pageBannerImages} alt={`${siteName} about banner`} />

        <div className="relative flex min-h-[34rem] w-full max-w-none flex-col justify-end px-2 pb-10 pt-20 sm:px-3 lg:min-h-[38rem] lg:px-4 lg:pb-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              <TreePalm className="h-4 w-4" />
              About {siteName}
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              A refined resort setting for rest, gatherings, and meaningful moments
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              Kasa Ilaya Resort & Event Place brings together relaxing resort amenities, private event spaces, and
              practical guest service for families, friends, and celebration planners.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to={createPageUrl("Packages")}>
                  View packages
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link to={createPageUrl("Contact")}>
                  Contact us
                  <CalendarCheck className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="grid w-full max-w-none gap-8 px-2 py-8 sm:px-3 lg:grid-cols-4 lg:px-4 lg:py-10">
          {[
            { label: "Guest focus", value: "Clear", icon: HeartHandshake },
            { label: "Experience", value: "Resort + Events", icon: Sparkles },
            { label: "Ideal for", value: "Families & Groups", icon: Users },
            { label: "Setting", value: "Private Escape", icon: MapPin },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 font-semibold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="grid w-full max-w-none gap-10 px-2 sm:px-3 lg:grid-cols-[0.9fr_1.1fr] lg:px-4">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Our Story</span>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Designed for guests who want comfort without complication
            </h2>
            <p className="mt-5 leading-8 text-muted-foreground">
              Kasa Ilaya was shaped around a simple idea: a resort visit should feel easy to plan and comfortable to
              enjoy. Guests can choose a package, arrive with their group, and spend the day focused on rest,
              conversation, celebration, and shared time.
            </p>
            <p className="mt-4 leading-8 text-muted-foreground">
              The resort combines leisure spaces, event-ready areas, and practical accommodations so each visit can
              fit the occasion, whether it is a quiet break or a full family gathering.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:row-span-2">
              <img src={gallery[1]?.src || heroImage} alt={gallery[1]?.title || "Resort event space"} loading="lazy" decoding="async" className="h-full min-h-80 w-full object-cover" />
            </div>
            {gallery.slice(2, 4).map((slide) => (
              <div key={slide.src} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <img src={slide.src} alt={slide.title} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <p className="font-semibold text-foreground">{slide.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{slide.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/35 py-16 sm:py-20 lg:py-24">
        <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
          <div className="mb-10 max-w-3xl">
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">What Guides Us</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              Professional service with a relaxed resort feel
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="grid w-full max-w-none gap-10 px-2 sm:px-3 lg:grid-cols-[1.05fr_0.95fr] lg:px-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <img src={gallery[0]?.src || heroImage} alt="Kasa Ilaya resort grounds" loading="lazy" decoding="async" className="aspect-[16/11] w-full object-cover" />
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Guest Promise</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              Every visit should feel organized, welcoming, and worth remembering
            </h2>
            <div className="mt-6 space-y-4">
              {milestones.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm leading-7 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-foreground text-white">
        <img src={gallery[1]?.src || heroImage} alt="Plan a Kasa Ilaya visit" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative grid w-full max-w-none gap-8 px-2 py-8 sm:px-3 lg:grid-cols-[1fr_auto] lg:items-center lg:px-4 lg:py-10">
          <div>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Plan a visit that fits your group
            </h2>
            <p className="mt-4 max-w-2xl leading-8 text-white/75">
              Compare resort packages or contact the team for questions about schedules, amenities, and event use.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild size="lg" className="gap-2">
              <Link to={createPageUrl("Packages")}>
                Browse packages
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="gap-2 border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link to={createPageUrl("Contact")}>
                Ask a question
                <CalendarCheck className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
