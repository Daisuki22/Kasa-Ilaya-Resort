import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ImageIcon,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  TreePalm,
  Users,
  Waves,
} from "lucide-react";
import { baseClient } from "@/api/baseClient";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { AMENITY_ICON_OPTIONS, useSiteSettings } from "@/hooks/useSiteSettings";
import { getPageBannerImages } from "@/lib/pageBannerImages";
import RotatingBannerBackground from "@/components/common/RotatingBannerBackground";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23eef2f7'/%3E%3Cpath d='M225 380l112-138 82 96 52-62 104 104H225z' fill='%23cbd5e1'/%3E%3Ccircle cx='545' cy='205' r='44' fill='%23d8dee8'/%3E%3Ctext x='50%25' y='500' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='28' fill='%2394a3b8'%3EKasa Ilaya%3C/text%3E%3C/svg%3E";

const FALLBACK_GALLERY = [
  {
    src: "/img/room_Resort%20View.jpg",
    title: "Resort View",
    subtitle: "Open-air leisure spaces with calming resort scenery.",
  },
  {
    src: "/img/room_eventplace.jpg",
    title: "Event Place",
    subtitle: "Flexible spaces for birthdays, reunions, and private gatherings.",
  },
  {
    src: "/img/room_kubo.jpg",
    title: "Kubo Area",
    subtitle: "Easygoing corners for meals, rest, and poolside bonding.",
  },
];

const experienceNotes = [
  "Comfortable spaces for families, barkada trips, and private events.",
  "Photo-friendly resort areas with natural views and relaxed seating.",
  "Guest facilities organized for day tours, overnight stays, and celebrations.",
];

const statusStyles = {
  unclaimed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  claimed: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function Amenities() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { settings } = useSiteSettings();

  useEffect(() => {
    baseClient.auth
      .me()
      .catch(() => {
        baseClient.auth.redirectToLogin(window.location.href);
        return null;
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  const { data: propertyItems = [], isLoading: isLoadingProperties } = useQuery({
    queryKey: ["public-amenities"],
    queryFn: () => baseClient.entities.FoundItem.filter({ is_active: true }, "-date_found", 300),
    enabled: !isCheckingAuth,
  });

  const gallerySlides = useMemo(() => {
    const slides = Array.isArray(settings?.resort_gallery)
      ? settings.resort_gallery.filter((slide) => slide?.src)
      : [];

    return (slides.length > 0 ? slides : FALLBACK_GALLERY).map((slide) => ({
      src: slide.src,
      title: slide.title || "Resort Space",
      subtitle: slide.subtitle || "Discover one of the guest areas at Kasa Ilaya Resort.",
    }));
  }, [settings?.resort_gallery]);

  const heroImages = getPageBannerImages(settings);
  const heroImage = heroImages[0];
  const featuredImages = gallerySlides.slice(0, 4);
  const amenities = Array.isArray(settings?.amenities) ? settings.amenities.filter((item) => item?.title) : [];
  const locations = new Set(propertyItems.map((item) => item.location_found).filter(Boolean));

  const metrics = [
    { label: "Featured amenities", value: Math.max(amenities.length, 1), icon: Sparkles },
    { label: "Guest areas", value: Math.max(locations.size, featuredImages.length), icon: MapPin },
    { label: "Managed facilities", value: propertyItems.length || amenities.length, icon: ShieldCheck },
  ];

  if (isCheckingAuth) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <section className="relative min-h-[34rem] overflow-hidden bg-foreground text-white lg:min-h-[38rem]">
        <RotatingBannerBackground
          images={heroImages}
          alt="Kasa Ilaya resort amenities banner"
          overlayClassName="bg-gradient-to-r from-black/70 via-black/35 to-transparent"
        />

        <div className="relative flex min-h-[34rem] w-full max-w-none flex-col justify-end px-2 pb-10 pt-20 sm:px-3 lg:min-h-[38rem] lg:px-4 lg:pb-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              <TreePalm className="h-4 w-4" />
              Resort amenities
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Amenities made for restful stays and memorable gatherings
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              Explore Kasa Ilaya Resort&apos;s pools, event spaces, private corners, and guest facilities before planning your visit.
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
                  Ask about availability
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/20 pt-5 sm:grid-cols-3">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1 text-sm text-white/72">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="grid w-full max-w-none gap-8 px-2 py-8 sm:px-3 lg:grid-cols-[0.9fr_1.1fr] lg:px-4 lg:py-10">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">
              {settings?.amenities_section_label || "Our Amenities"}
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              {settings?.amenities_section_title || "Everything You Need"}
            </h2>
            <p className="mt-4 max-w-xl leading-8 text-muted-foreground">
              {settings?.amenities_section_description ||
                "Enjoy practical, comfortable resort facilities designed for your stay, celebration, or quick escape."}
            </p>
          </div>

          <div className="grid gap-3">
            {experienceNotes.map((note) => (
              <div key={note} className="flex gap-3 rounded-lg border border-border bg-background p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm leading-7 text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Highlights</span>
              <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
                Resort comforts at a glance
              </h2>
            </div>
            <p className="max-w-2xl leading-8 text-muted-foreground">
              A concise look at the facilities guests most often need when choosing a resort for a day tour, overnight stay, or event.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((item, index) => {
              const iconOption = AMENITY_ICON_OPTIONS[item.icon] || AMENITY_ICON_OPTIONS.star;
              const IconComponent = iconOption.Component;

              return (
                <article
                  key={`${item.title}-${index}`}
                  className="group rounded-lg border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/35 py-16 sm:py-20 lg:py-24">
        <div className="grid w-full max-w-none gap-8 px-2 sm:px-3 lg:grid-cols-[1.1fr_0.9fr] lg:px-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="relative aspect-[16/10]">
              <img
                src={featuredImages[0]?.src || PLACEHOLDER_IMAGE}
                alt={featuredImages[0]?.title || "Featured resort space"}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-white sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                  <Camera className="h-4 w-4" />
                  Featured space
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold">{featuredImages[0]?.title || "Resort View"}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                  {featuredImages[0]?.subtitle || "Preview one of the resort spaces available to guests."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Spaces</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              See the setting before you arrive
            </h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              From poolside relaxation to event-ready areas, the resort layout supports simple family visits and larger celebrations.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {featuredImages.slice(1, 4).map((slide) => (
                <div key={slide.src} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={slide.src} alt={slide.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-foreground">{slide.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{slide.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Facilities</span>
              <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
                Available resort amenities
              </h2>
            </div>
            <p className="max-w-2xl leading-8 text-muted-foreground">
              These are the current amenity entries managed by the resort team, including location and availability details where provided.
            </p>
          </div>

          {isLoadingProperties ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : propertyItems.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {propertyItems.map((item) => (
                <AmenityPropertyCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
              <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-4 font-medium text-foreground">Detailed facility listings are being prepared.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                The resort highlights above are available now. Please contact the team for specific facility requests.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="relative overflow-hidden bg-foreground text-white">
        <img
          src={featuredImages[1]?.src || heroImage}
          alt="Plan a Kasa Ilaya visit"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative grid w-full max-w-none gap-8 px-2 py-8 sm:px-3 lg:grid-cols-[1fr_auto] lg:items-center lg:px-4 lg:py-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium">
              <Star className="h-4 w-4" />
              Plan your visit
            </div>
            <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
              Ready to match the amenities with the right package?
            </h2>
            <p className="mt-4 max-w-2xl leading-8 text-white/75">
              Compare day tour, night tour, and longer stay options so your group gets the right space, schedule, and facilities.
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
                Contact resort
                <MapPin className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AmenityPropertyCard({ item }) {
  const [imgError, setImgError] = useState(false);
  const imageSrc = item.image_url && !imgError ? item.image_url : PLACEHOLDER_IMAGE;
  const isAvailable = item.status !== "claimed";
  const statusClass = statusStyles[item.status] || statusStyles.unclaimed;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={imageSrc}
          alt={item.item_name || "Resort amenity"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-300 hover:scale-105"
          onError={() => setImgError(true)}
        />
        <span className={`absolute right-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
          {isAvailable ? "Available" : "Unavailable"}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-7 text-foreground">{item.item_name || "Resort amenity"}</h3>
          {isAvailable ? <Waves className="mt-1 h-5 w-5 shrink-0 text-primary" /> : <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
        </div>
        {item.description ? (
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
        ) : null}
        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
          {item.location_found ? (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {item.location_found}
            </p>
          ) : null}
          {item.found_by ? (
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {item.found_by}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
