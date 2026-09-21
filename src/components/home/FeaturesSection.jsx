import React from "react";
import { motion } from "framer-motion";
import { useSiteSettings, AMENITY_ICON_OPTIONS } from "@/hooks/useSiteSettings";

export default function FeaturesSection({ hideHeader = false }) {
  const { settings } = useSiteSettings();
  const {
    amenities_section_label,
    amenities_section_title,
    amenities_section_description,
    amenities,
  } = settings;

  return (
    <section className="bg-card py-24 sm:py-28 lg:py-32">
      <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
        {!hideHeader ? (
          <div className="mb-16 text-center lg:mb-20">
            <span className="text-secondary font-medium text-sm tracking-wider uppercase">{amenities_section_label}</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              {amenities_section_title}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-muted-foreground leading-8">
              {amenities_section_description}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {amenities.map((item, i) => {
            const iconOption = AMENITY_ICON_OPTIONS[item.icon] || AMENITY_ICON_OPTIONS.star;
            const IconComponent = iconOption.Component;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="group rounded-lg border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md sm:p-8"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <IconComponent className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
