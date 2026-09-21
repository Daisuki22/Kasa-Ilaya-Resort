const DEFAULT_PAGE_BANNER = "/img/room_Resort%20View.jpg";

const isUsableBannerImage = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return !value.toLowerCase().includes("logo.png");
};

const uniqueImages = (images) => {
  const seen = new Set();

  return images.filter((image) => {
    if (!isUsableBannerImage(image) || seen.has(image)) {
      return false;
    }

    seen.add(image);
    return true;
  });
};

export function getPageBannerImages(settings, fallback = DEFAULT_PAGE_BANNER) {
  const packageBannerImages = Array.isArray(settings?.packages_banner_images)
    ? settings.packages_banner_images
    : [];
  const galleryImages = Array.isArray(settings?.resort_gallery)
    ? settings.resort_gallery.map((slide) => slide?.src)
    : [];

  const images = uniqueImages([
    ...packageBannerImages,
    settings?.packages_banner_url,
    ...galleryImages,
    settings?.hero_image_url,
    fallback,
  ]);

  return images.length > 0 ? images : [fallback];
}
