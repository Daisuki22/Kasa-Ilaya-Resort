import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import HeroSection from "@/components/home/HeroSection";

const ResortGallerySlider = lazy(() => import("@/components/home/ResortGallerySlider"));
const VideoPresentationSection = lazy(() => import("@/components/home/VideoPresentationSection"));
const UpcomingScheduleSection = lazy(() => import("@/components/home/UpcomingScheduleSection"));
const FeaturesSection = lazy(() => import("@/components/home/FeaturesSection"));
const ResortRulesSection = lazy(() => import("@/components/home/ResortRulesSection"));
const ReviewsSection = lazy(() => import("@/components/home/ReviewSection.jsx"));
const CTASection = lazy(() => import("@/components/home/CTASection"));

function LazyHomeSection({ children, minHeight = "16rem" }) {
  const sectionRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) {
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      setShouldRender(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "700px 0px" }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={sectionRef} style={shouldRender ? undefined : { minHeight }}>
      {shouldRender ? (
        <Suspense fallback={<div className="min-h-64 bg-background" />}>
          {children}
        </Suspense>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <HeroSection />
      <LazyHomeSection minHeight="36rem">
        <ResortGallerySlider />
      </LazyHomeSection>
      <LazyHomeSection minHeight="36rem">
        <VideoPresentationSection />
      </LazyHomeSection>
      <LazyHomeSection minHeight="32rem">
        <UpcomingScheduleSection allowAdminActions={false} />
      </LazyHomeSection>
      <LazyHomeSection>
        <FeaturesSection />
      </LazyHomeSection>
      <LazyHomeSection>
        <ResortRulesSection />
      </LazyHomeSection>
      <LazyHomeSection>
        <ReviewsSection />
      </LazyHomeSection>
      <LazyHomeSection>
        <CTASection />
      </LazyHomeSection>
    </div>
  );
}
