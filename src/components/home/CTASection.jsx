import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { RESORT_CONTACT } from "@/lib/resortContact";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function CTASection() {
  const { isAuthenticated } = useAuth();
  const { settings: siteSettings } = useSiteSettings();
  const packagesPageUrl = createPageUrl("Packages");
  const loginToPackagesUrl = `${createPageUrl("Login")}?next=${encodeURIComponent(packagesPageUrl)}`;
  const circleImage = siteSettings?.logo_url || null;

  return (
    <section className="relative overflow-hidden bg-primary py-24 sm:py-28 lg:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-4 top-6 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-primary-foreground/20 bg-primary-foreground/5 sm:left-8 sm:top-8 sm:h-40 sm:w-40 lg:left-10 lg:top-10 lg:h-64 lg:w-64 lg:border-2">
          {circleImage ? (
            <img src={circleImage} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-30" />
          ) : null}
        </div>
        <div className="absolute bottom-6 right-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-primary-foreground/20 bg-primary-foreground/5 sm:bottom-8 sm:right-8 sm:h-32 sm:w-32 lg:bottom-10 lg:right-10 lg:h-48 lg:w-48 lg:border-2">
          {circleImage ? (
            <img src={circleImage} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-20" />
          ) : null}
        </div>
      </div>
      <div className="relative w-full max-w-none px-2 text-center sm:px-3 lg:px-4">
        <h2 className="mb-5 font-display text-3xl font-bold text-primary-foreground sm:text-4xl lg:text-5xl">
          Ready to Book Your Stay?
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-primary-foreground/80 sm:mb-10 sm:text-lg sm:leading-8">
          Reserve now and create unforgettable memories at Kasa Ilaya Resort
        </p>
        <Link to={isAuthenticated ? packagesPageUrl : loginToPackagesUrl} className="inline-flex w-full justify-center sm:w-auto">
          <Button size="lg" className="w-full gap-2 bg-secondary px-8 text-secondary-foreground hover:bg-secondary/90 sm:w-auto">
            Book Now <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div className="mt-4">
          <Link to={createPageUrl("Contact")} className="inline-flex w-full justify-center sm:w-auto">
            <Button size="lg" variant="outline" className="w-full gap-2 border-primary-foreground/30 bg-transparent px-8 text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto">
              Contact Us
            </Button>
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { icon: Phone, text: RESORT_CONTACT.phoneDisplay },
            { icon: Mail, text: RESORT_CONTACT.email },
            { icon: MapPin, text: RESORT_CONTACT.address },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-2 text-center text-sm text-primary-foreground/80 sm:flex-row sm:text-left">
              <item.icon className="h-4 w-4" />
              <span className="break-words">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
