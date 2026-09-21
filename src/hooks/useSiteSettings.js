import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { baseClient } from "@/api/baseClient";
import {
  Waves, Music, Car, Shield, Sun, Play,
  UtensilsCrossed, Wifi, Coffee, TreePalm,
  Star, Heart, Bike, Fish, Dumbbell, Flame, Camera,
} from "lucide-react";

export const FONT_STYLE_OPTIONS = {
  inter: {
    label: "Inter",
    cssFamily: "'Inter', sans-serif",
  },
  poppins: {
    label: "Poppins",
    cssFamily: "'Poppins', sans-serif",
  },
  nunito: {
    label: "Nunito",
    cssFamily: "'Nunito', sans-serif",
  },
  playfair: {
    label: "Playfair Display",
    cssFamily: "'Playfair Display', serif",
  },
  merriweather: {
    label: "Merriweather",
    cssFamily: "'Merriweather', serif",
  },
  lora: {
    label: "Lora",
    cssFamily: "'Lora', serif",
  },
};

export const AMENITY_ICON_OPTIONS = {
  waves:    { label: "Waves (Pool)",          Component: Waves },
  music:    { label: "Music / Karaoke",       Component: Music },
  car:      { label: "Car / Parking",         Component: Car },
  shield:   { label: "Shield / Security",     Component: Shield },
  sun:      { label: "Sun / Relaxation",      Component: Sun },
  play:     { label: "Play / Activities",     Component: Play },
  utensils: { label: "Utensils / Food",       Component: UtensilsCrossed },
  wifi:     { label: "Wifi / Internet",       Component: Wifi },
  coffee:   { label: "Coffee / Cafe",         Component: Coffee },
  tree:     { label: "Tree / Nature",         Component: TreePalm },
  star:     { label: "Star / Premium",        Component: Star },
  heart:    { label: "Heart / Wellness",      Component: Heart },
  bike:     { label: "Bike / Cycling",        Component: Bike },
  fish:     { label: "Fish / Fishing",        Component: Fish },
  dumbbell: { label: "Dumbbell / Gym",        Component: Dumbbell },
  flame:    { label: "Flame / Bonfire",       Component: Flame },
  camera:   { label: "Camera / Photography",  Component: Camera },
};

const DEFAULT_AMENITIES = [
  { icon: "waves",    title: "Swimming Pool",               desc: "Crystal clear infinity pool with scenic views" },
  { icon: "music",    title: "Karaoke & Events",            desc: "Entertainment and event hosting facilities" },
  { icon: "car",      title: "Free Parking",                desc: "Spacious parking for all guests" },
  { icon: "shield",   title: "Safe & Secure",               desc: "24/7 security for your peace of mind" },
  { icon: "sun",      title: "Sunbathing & Relaxation",     desc: "Enjoy the sun and relax by the pool" },
  { icon: "play",     title: "Entertainment & Activities",  desc: "Fun activities and entertainment for all ages" },
];

const DEFAULT_RESORT_GALLERY = [
  {
    src: "/img/room_Resort%20View.jpg",
    title: "Resort View",
    subtitle: "Wide-open leisure spaces and refreshing scenery.",
  },
  {
    src: "/img/room_eventplace.jpg",
    title: "Event Space",
    subtitle: "A venue designed for celebrations, reunions, and special occasions.",
  },
  {
    src: "/img/room_EntireHouse_EventPlace.jpg",
    title: "Private Stay",
    subtitle: "Comfortable accommodations for families and barkada getaways.",
  },
  {
    src: "/img/room_kubo.jpg",
    title: "Kubo Area",
    subtitle: "Relaxed corners for rest, dining, and poolside bonding.",
  },
  {
    src: "/img/kubo_accomodation.jpg",
    title: "Kubo Accommodation",
    subtitle: "A more rustic stay experience with resort comfort.",
  },
];

const DEFAULT_HERO_IMAGES = ["/img/Logo.png"];
const DEFAULT_PACKAGES_BANNER_IMAGES = ["/img/Logo.png"];

const normalizeJsonField = (value, fallback) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
};

export const defaultSiteSettings = {
  site_name: "Kasa Ilaya",
  logo_url: "/img/apple-touch-icon.png",
  hero_image_url: "/img/Logo2~no.png",
  hero_images: DEFAULT_HERO_IMAGES,
  packages_banner_url: "/img/Logo.png",
  packages_banner_images: DEFAULT_PACKAGES_BANNER_IMAGES,
  hero_badge_text: "Welcome to Paradise",
  hero_title_line1: "Kasa Ilaya",
  hero_title_line2: "Resort & Event Place",
  hero_description:
    "Escape to serenity. Experience our premium resort packages with breathtaking views, world-class amenities, and unforgettable moments.",
  body_font_style: "inter",
  heading_font_style: "playfair",
  amenities_section_label: "Our Amenities",
  amenities_section_title: "Everything You Need",
  amenities_section_description: "Enjoy world-class amenities designed for your comfort and pleasure",
  resort_gallery: DEFAULT_RESORT_GALLERY,
  terms_title: "Terms and Conditions",
  terms_summary: "Please review the booking, payment, rebooking, no-refund, and cancellation rules before confirming your reservation.",
  terms_content:
    "1. All bookings are subject to availability and confirmation by Kasa Ilaya Resort.\n\n" +
    "2. Guests must provide accurate personal information and valid contact details during reservation.\n\n" +
    "3. A reservation payment is required to process the booking. Submitted payment proofs are reviewed before final confirmation.\n\n" +
    "4. Reservation fees and payments made to secure a booking are non-refundable unless Kasa Ilaya Resort approves otherwise in writing.\n\n" +
    "5. One approved rebooking is allowed per reservation. Rebooking requests must be submitted at least 7 days before the reservation date, the requested date must be available for the same package and tour type, and the original booking date remains active until admin approval.\n\n" +
    "6. Guests may cancel their own booking while it is still pending, but online cancellation is no longer allowed once the booking is marked paid or approved by the resort.\n\n" +
    "7. Guests must follow resort rules, safety guidelines, staff instructions, and capacity limits throughout their stay.\n\n" +
    "8. Damages to resort property, missing items, or violations of house rules may result in additional charges or cancellation of the reservation.\n\n" +
    "9. Kasa Ilaya Resort may decline or cancel a booking for policy violations, fraudulent transactions, safety concerns, or force majeure events.\n\n" +
    "10. By proceeding with a reservation, the guest confirms that they have read and accepted these terms and conditions.",
  amenities: DEFAULT_AMENITIES,
  require_strong_password: true,
  min_password_length: 8,
  session_timeout_minutes: 120,
  max_login_attempts: 5,
  lockout_minutes: 15,
  enable_login_notifications: true,
};

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => baseClient.entities.SiteSetting.list("-updated_date", 1),
  });

  const settings = useMemo(() => {
    const latest = query.data?.[0] || null;
    const amenities = normalizeJsonField(latest?.amenities_json, DEFAULT_AMENITIES);
    const resortGallery = normalizeJsonField(latest?.resort_gallery_json, DEFAULT_RESORT_GALLERY);
    const heroImages = normalizeJsonField(latest?.hero_images_json, DEFAULT_HERO_IMAGES);
    const packagesBannerImages = normalizeJsonField(latest?.packages_banner_images_json, DEFAULT_PACKAGES_BANNER_IMAGES);

    const normalizedHeroImages = Array.isArray(heroImages) && heroImages.length > 0
      ? heroImages.filter((image) => typeof image === "string" && image.trim())
      : (latest?.hero_image_url ? [latest.hero_image_url] : DEFAULT_HERO_IMAGES);

    const normalizedPackagesBannerImages = Array.isArray(packagesBannerImages) && packagesBannerImages.length > 0
      ? packagesBannerImages.filter((image) => typeof image === "string" && image.trim())
      : (latest?.packages_banner_url ? [latest.packages_banner_url] : DEFAULT_PACKAGES_BANNER_IMAGES);

    return {
      ...defaultSiteSettings,
      ...(latest || {}),
      logo_url: latest?.logo_url?.trim() || defaultSiteSettings.logo_url,
      amenities,
      hero_image_url: normalizedHeroImages[0] || defaultSiteSettings.hero_image_url,
      hero_images: normalizedHeroImages.length > 0 ? normalizedHeroImages : DEFAULT_HERO_IMAGES,
      packages_banner_url: normalizedPackagesBannerImages[0] || defaultSiteSettings.packages_banner_url,
      packages_banner_images: normalizedPackagesBannerImages.length > 0 ? normalizedPackagesBannerImages : DEFAULT_PACKAGES_BANNER_IMAGES,
      resort_gallery: Array.isArray(resortGallery) && resortGallery.length > 0 ? resortGallery : DEFAULT_RESORT_GALLERY,
    };
  }, [query.data]);

  return {
    ...query,
    settings,
    settingRecord: query.data?.[0] || null,
  };
}
