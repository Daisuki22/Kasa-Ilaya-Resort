import React, { useEffect, useMemo, useState } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Moon,
  Package,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import PackageCard from "@/components/packages/PackageCard";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getPageBannerImages } from "@/lib/pageBannerImages";

const MAX_BOOKINGS_PER_SLOT = 1;
const tourTypeOrder = {
  day_tour: 0,
  night_tour: 1,
  "22_hours": 2,
};

const sortPackagesForDisplay = (packages) =>
  [...packages].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }

    return (tourTypeOrder[left.tour_type] ?? 99) - (tourTypeOrder[right.tour_type] ?? 99);
  });

const dedupePackagesById = (packages) => {
  const packageMap = new Map();

  packages.forEach((pkg) => {
    if (!pkg?.id) {
      return;
    }

    packageMap.set(pkg.id, pkg);
  });

  return [...packageMap.values()];
};

const filterOptions = [
  { value: "all", label: "All Packages", icon: Package },
  { value: "day_tour", label: "Day Tour", icon: Sun },
  { value: "night_tour", label: "Night Tour", icon: Moon },
  { value: "22_hours", label: "22 Hours", icon: Clock },
];

export default function Packages() {
  const [tourFilter, setTourFilter] = useState("all");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { settings: siteSettings } = useSiteSettings();
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  useEffect(() => {
    baseClient.auth.me()
      .catch(() => {
        baseClient.auth.redirectToLogin(window.location.href);
        return null;
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: () => baseClient.entities.Package.filter({ is_active: true }, "name"),
  });

  const { data: activeBookings = [] } = useQuery({
    queryKey: ["package-live-availability"],
    queryFn: () => baseClient.entities.Booking.filter({ status: ["pending", "confirmed", "completed"] }),
    refetchInterval: 15000,
  });

  const filtered = sortPackagesForDisplay(dedupePackagesById(packages));
  const packagesBannerImages = useMemo(
    () => getPageBannerImages(siteSettings),
    [siteSettings]
  );
  const showBannerControls = packagesBannerImages.length > 1;
  const activeBannerImage = packagesBannerImages[activeBannerIndex] || packagesBannerImages[0];

  const goToBannerSlide = (index) => {
    setActiveBannerIndex(index);
  };

  const showPreviousBanner = () => {
    setActiveBannerIndex((current) => (current === 0 ? packagesBannerImages.length - 1 : current - 1));
  };

  const showNextBanner = () => {
    setActiveBannerIndex((current) => (current + 1) % packagesBannerImages.length);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const liveAvailability = activeBookings.reduce((acc, booking) => {
    if (booking.booking_date !== today || !booking.package_id) {
      return acc;
    }

    acc[booking.package_id] = (acc[booking.package_id] || 0) + 1;
    return acc;
  }, {});

  const availableToday = filtered.filter((pkg) => (liveAvailability[pkg.id] || 0) < MAX_BOOKINGS_PER_SLOT).length;
  const maxGuests = filtered.reduce((sum, pkg) => sum + Number(pkg.max_guests || 0), 0);

  useEffect(() => {
    setActiveBannerIndex(0);
  }, [packagesBannerImages.length]);

  useEffect(() => {
    if (packagesBannerImages.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % packagesBannerImages.length);
    }, 9000);

    return () => window.clearInterval(intervalId);
  }, [packagesBannerImages.length]);

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
        <div className="absolute inset-0">
          <img
            key={`${activeBannerImage}-${activeBannerIndex}`}
            src={activeBannerImage}
            alt={`Kasa Ilaya resort package banner ${activeBannerIndex + 1}`}
            loading={activeBannerIndex === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={activeBannerIndex === 0 ? "high" : "auto"}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
        </div>

        {showBannerControls ? (
          <>
            <button
              type="button"
              onClick={showPreviousBanner}
              className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 sm:flex"
              aria-label="Show previous packages banner image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={showNextBanner}
              className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 sm:flex"
              aria-label="Show next packages banner image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="relative flex min-h-[34rem] w-full max-w-none flex-col justify-end px-2 pb-10 pt-20 sm:px-3 lg:min-h-[38rem] lg:px-4 lg:pb-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Choose your resort experience
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Packages designed for day tours, overnight stays, and private gatherings
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              Compare resort options, preview inclusions, and choose the schedule that fits your family, friends, or event.
            </p>
          </div>

          <div className="mt-10 grid gap-4 border-t border-white/20 pt-5 sm:grid-cols-3">
            {[
              { label: "Active packages", value: filtered.length, icon: Package },
              { label: "Available today", value: availableToday, icon: CalendarCheck },
              { label: "Guest capacity", value: maxGuests || "Flexible", icon: Users },
            ].map(({ label, value, icon: Icon }) => (
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

          {showBannerControls ? (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-sm">
              {packagesBannerImages.map((_, index) => (
                <button
                  key={`packages-banner-dot-${index}`}
                  type="button"
                  onClick={() => goToBannerSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${index === activeBannerIndex ? "w-8 bg-secondary" : "w-2.5 bg-white/60 hover:bg-white/85"}`}
                  aria-label={`Show packages banner image ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Package Finder</span>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Select your preferred tour type</h2>
            </div>
            <Tabs value={tourFilter} onValueChange={setTourFilter}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 sm:w-auto sm:grid-cols-4">
                {filterOptions.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-2 px-3 py-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </section>

      <section className="w-full max-w-none px-2 py-8 sm:px-3 lg:px-4 lg:py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold text-foreground">Available Packages</h2>
            <p className="mt-2 text-muted-foreground">
              Showing {filtered.length} package{filtered.length === 1 ? "" : "s"} with live reservation status.
            </p>
          </div>
          <Button variant="outline" onClick={() => setTourFilter("all")}>Reset filters</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card py-20 text-center text-muted-foreground">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p>No packages available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((pkg, i) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                index={i}
                selectedTour={tourFilter === "all" ? "" : tourFilter}
                liveAvailability={{
                  bookedToday: liveAvailability[pkg.id] || 0,
                  maxSlots: MAX_BOOKINGS_PER_SLOT,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
