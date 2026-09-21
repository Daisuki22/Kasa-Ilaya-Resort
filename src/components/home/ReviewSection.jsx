import React from "react";
import { useQuery } from "@tanstack/react-query";
import { baseClient } from "@/api/baseClient";
import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-secondary text-secondary" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: () => baseClient.entities.Review.filter({ is_approved: true }, "-created_date", 6),
  });

  if (reviews.length === 0) return null;

  return (
    <section className="bg-muted/40 py-24 sm:py-28 lg:py-32">
      <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
        <div className="mb-16 text-center lg:mb-20">
          <p className="text-secondary font-medium uppercase tracking-widest text-sm mb-2">Guest Stories</p>
          <h2 className="mb-5 font-display text-4xl font-bold text-foreground lg:text-5xl">What Our Guests Say</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground leading-8">
            Real experiences from verified guests who have stayed at Kasa Ilaya Resort & Event Place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {reviews.map((review) => (
            <Card key={review.id} className="relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-8">
                <Quote className="mb-4 h-8 w-8 text-primary/20" />
                <p className="mb-6 line-clamp-4 text-sm leading-7 text-foreground/80">
                  "{review.review_text}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{review.guest_name}</p>
                    {review.package_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{review.package_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StarRating rating={review.rating} />
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Verified Stay
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
