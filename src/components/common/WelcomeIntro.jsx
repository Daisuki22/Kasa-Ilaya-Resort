import React, { useEffect, useMemo, useState } from "react";
import { TreePalm } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const INTRO_DURATION_MS = 2800;
const INTRO_FADE_MS = 550;

export default function WelcomeIntro() {
  const { settings } = useSiteSettings();
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const siteName = settings?.site_name?.trim() || "Kasa Ilaya";
  const logoUrl = settings?.logo_url?.trim();
  const heroImage = useMemo(() => {
    const gallery = Array.isArray(settings?.resort_gallery)
      ? settings.resort_gallery.find((slide) => slide?.src)?.src
      : null;

    return gallery || settings?.packages_banner_url || settings?.hero_image_url || "/img/room_Resort%20View.jpg";
  }, [settings?.hero_image_url, settings?.packages_banner_url, settings?.resort_gallery]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const leaveTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, INTRO_DURATION_MS);

    const removeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, INTRO_DURATION_MS + INTRO_FADE_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isVisible]);

  const closeIntro = () => {
    setIsLeaving(true);
    window.setTimeout(() => setIsVisible(false), INTRO_FADE_MS);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`welcome-intro ${isLeaving ? "welcome-intro--leaving" : ""}`}
      role="dialog"
      aria-label="Welcome intro"
      aria-modal="true"
    >
      <img src={heroImage} alt="" loading="eager" decoding="async" fetchPriority="high" className="welcome-intro__image" />
      <div className="welcome-intro__shade" />
      <div className="welcome-intro__panel welcome-intro__panel--left" />
      <div className="welcome-intro__panel welcome-intro__panel--right" />

      <div className="welcome-intro__content">
        <div className="welcome-intro__mark" aria-hidden="true">
          {logoUrl ? (
            <img src={logoUrl} alt="" loading="eager" decoding="async" />
          ) : (
            <TreePalm className="h-10 w-10" />
          )}
        </div>
        <p className="welcome-intro__eyebrow">Welcome to</p>
        <h1 className="welcome-intro__title">{siteName}</h1>
        <div className="welcome-intro__line" />
        <p className="welcome-intro__subtitle">Resort & Event Place</p>
      </div>

      <button type="button" className="welcome-intro__skip" onClick={closeIntro}>
        Skip
      </button>
    </div>
  );
}
