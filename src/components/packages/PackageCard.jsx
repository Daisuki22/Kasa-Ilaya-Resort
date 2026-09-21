import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	ArrowRight,
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	ShieldCheck,
	Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

const tourLabels = {
	day_tour: 'Day Tour',
	night_tour: 'Night Tour',
	'22_hours': '22 Hours',
};

const getTourPrice = (pkg, tourType) => {
	if (tourType === 'day_tour') {
		return Number(pkg.day_tour_price ?? pkg.price ?? 0);
	}

	if (tourType === 'night_tour') {
		return Number(pkg.night_tour_price ?? pkg.price ?? 0);
	}

	if (tourType === '22_hours') {
		return Number(pkg.twenty_two_hour_price ?? pkg.price ?? 0);
	}

	return Number(pkg.price ?? 0);
};

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

export default function PackageCard({ pkg, index = 0, liveAvailability, selectedTour }) {
	const { isAuthenticated } = useAuth();
	const galleryImages = Array.isArray(pkg.gallery_images) && pkg.gallery_images.length > 0
		? pkg.gallery_images
		: [pkg.image_url || '/img/room_Resort%20View.jpg'];
	const [activeImageIndex, setActiveImageIndex] = useState(0);
	const bookedToday = liveAvailability?.bookedToday || 0;
	const maxSlots = liveAvailability?.maxSlots || 1;
	const remainingToday = Math.max(0, maxSlots - bookedToday);
	const isFullyBookedToday = remainingToday === 0;
	const hasMultipleImages = galleryImages.length > 1;
	const activeImageUrl = galleryImages[activeImageIndex] || galleryImages[0];
	const dayTourPrice = getTourPrice(pkg, 'day_tour');
	const nightTourPrice = getTourPrice(pkg, 'night_tour');
	const twentyTwoHourPrice = getTourPrice(pkg, '22_hours');
	const tourPrices = [
		{ id: 'day_tour', label: 'Day', price: dayTourPrice },
		{ id: 'night_tour', label: 'Night', price: nightTourPrice },
		{ id: '22_hours', label: '22 Hrs', price: twentyTwoHourPrice },
	];
	const heroPrice = selectedTour ? getTourPrice(pkg, selectedTour) : Math.min(dayTourPrice, nightTourPrice, twentyTwoHourPrice);
	const bookingPageUrl = `${createPageUrl('BookingForm')}?packageId=${pkg.id}`;
	const loginToBookingUrl = `${createPageUrl('Login')}?next=${encodeURIComponent(bookingPageUrl)}`;

	useEffect(() => {
		setActiveImageIndex(0);
	}, [pkg.id, galleryImages.length]);

	useEffect(() => {
		if (!hasMultipleImages) {
			return undefined;
		}

		const intervalId = window.setInterval(() => {
			setActiveImageIndex((current) => (current + 1) % galleryImages.length);
		}, 7000);

		return () => window.clearInterval(intervalId);
	}, [galleryImages.length, hasMultipleImages]);

	const goToPrevious = () => {
		setActiveImageIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
	};

	const goToNext = () => {
		setActiveImageIndex((current) => (current + 1) % galleryImages.length);
	};

	return (
		<Card
			className="group overflow-hidden border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
			style={{ animationDelay: `${index * 80}ms` }}
		>
			<div className="relative h-60 overflow-hidden bg-muted sm:h-64">
				<img
					key={`${pkg.id}-${activeImageUrl}-${activeImageIndex}`}
					src={activeImageUrl}
					alt={`${pkg.name} ${activeImageIndex + 1}`}
					loading={index < 2 ? 'eager' : 'lazy'}
					decoding="async"
					fetchPriority={index < 2 ? 'high' : 'auto'}
					className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

				<div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
					<Badge className="border-white/20 bg-white/90 text-slate-950 hover:bg-white">
						{selectedTour ? tourLabels[selectedTour] : 'Flexible Options'}
					</Badge>
					<Badge className="bg-secondary text-secondary-foreground">
						From {formatMoney(heroPrice)}
					</Badge>
				</div>

				<div className="absolute bottom-4 left-4 right-4">
					<h2 className="font-display text-xl font-bold leading-tight text-white sm:text-2xl">{pkg.name}</h2>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/85">
						<span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur">
							<Users className="h-3.5 w-3.5" />
							Up to {pkg.max_guests || 10} guests
						</span>
						<span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur">
							<ShieldCheck className="h-3.5 w-3.5" />
							Managed package
						</span>
					</div>
				</div>

				{hasMultipleImages ? (
					<>
						<div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-3">
							<button type="button" onClick={goToPrevious} className="rounded-full border border-white/25 bg-black/35 p-2 text-white backdrop-blur-sm transition hover:bg-black/55" aria-label={`Previous image for ${pkg.name}`}>
								<ChevronLeft className="h-4 w-4" />
							</button>
							<button type="button" onClick={goToNext} className="rounded-full border border-white/25 bg-black/35 p-2 text-white backdrop-blur-sm transition hover:bg-black/55" aria-label={`Next image for ${pkg.name}`}>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
						<div className="absolute bottom-4 right-4 flex gap-1.5">
							{galleryImages.map((imageUrl, dotIndex) => (
								<button
									key={`${imageUrl}-dot-${dotIndex}`}
									type="button"
									onClick={() => setActiveImageIndex(dotIndex)}
									className={`h-2 rounded-full transition-all ${dotIndex === activeImageIndex ? 'w-7 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'}`}
									aria-label={`View image ${dotIndex + 1} for ${pkg.name}`}
								/>
							))}
						</div>
					</>
				) : null}
			</div>

			<CardContent className="space-y-5">
				<div>
					<p className="text-sm leading-7 text-muted-foreground">
						{pkg.description || 'A curated resort experience designed for memorable stays, celebrations, and quiet escapes.'}
					</p>
					<div
						className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold leading-none ${
							isFullyBookedToday
								? 'border-destructive/30 bg-destructive/10 text-destructive'
								: 'border-primary/20 bg-primary/10 text-primary'
						}`}
					>
						{isFullyBookedToday ? 'Reserved today' : `${remainingToday} slot available today`}
					</div>
				</div>

				<div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
					{tourPrices.map((tour) => (
						<div
							key={tour.id}
							className={`rounded-lg border px-3 py-3 text-center ${
								selectedTour === tour.id
									? 'border-primary bg-primary/10'
									: 'border-border bg-muted/35'
							}`}
						>
							<div className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
								{tour.label}
							</div>
							<div className="mt-1 text-sm font-semibold text-foreground">{formatMoney(tour.price)}</div>
						</div>
					))}
				</div>

				{Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0 ? (
					<div className="space-y-2 border-t border-border pt-4">
						{pkg.inclusions.slice(0, 4).map((item) => (
							<div key={item} className="flex items-start gap-2 text-sm text-foreground/85">
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<span>{item}</span>
							</div>
						))}
					</div>
				) : null}

				<Button asChild className="w-full gap-2">
					<Link to={isAuthenticated ? bookingPageUrl : loginToBookingUrl}>
						Book This Package
						<ArrowRight className="h-4 w-4" />
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
