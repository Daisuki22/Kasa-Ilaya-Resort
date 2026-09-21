import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ImagePlus, Save, X, Plus, ArrowUp, ArrowDown, Images } from "lucide-react";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/lib/adminAccess";
import { defaultSiteSettings, FONT_STYLE_OPTIONS, AMENITY_ICON_OPTIONS, useSiteSettings } from "@/hooks/useSiteSettings";

const buildForm = (settings) => ({
  site_name: settings?.site_name || defaultSiteSettings.site_name,
  logo_url: settings?.logo_url || "",
  hero_image_url: settings?.hero_image_url || defaultSiteSettings.hero_image_url,
  hero_images: Array.isArray(settings?.hero_images) && settings.hero_images.length > 0
    ? settings.hero_images
    : defaultSiteSettings.hero_images,
  packages_banner_url: settings?.packages_banner_url || defaultSiteSettings.packages_banner_url,
  packages_banner_images: Array.isArray(settings?.packages_banner_images) && settings.packages_banner_images.length > 0
    ? settings.packages_banner_images
    : defaultSiteSettings.packages_banner_images,
  hero_badge_text: settings?.hero_badge_text || defaultSiteSettings.hero_badge_text,
  hero_title_line1: settings?.hero_title_line1 || defaultSiteSettings.hero_title_line1,
  hero_title_line2: settings?.hero_title_line2 || defaultSiteSettings.hero_title_line2,
  hero_description: settings?.hero_description || defaultSiteSettings.hero_description,
  body_font_style: settings?.body_font_style || defaultSiteSettings.body_font_style,
  heading_font_style: settings?.heading_font_style || defaultSiteSettings.heading_font_style,
  amenities_section_label: settings?.amenities_section_label || defaultSiteSettings.amenities_section_label,
  amenities_section_title: settings?.amenities_section_title || defaultSiteSettings.amenities_section_title,
  amenities_section_description: settings?.amenities_section_description || defaultSiteSettings.amenities_section_description,
  terms_title: settings?.terms_title || defaultSiteSettings.terms_title,
  terms_summary: settings?.terms_summary || defaultSiteSettings.terms_summary,
  terms_content: settings?.terms_content || defaultSiteSettings.terms_content,
});

export default function SystemSettingsManager({ embedded = false, actorUser = null, section = null }) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { settings, settingRecord, isLoading } = useSiteSettings();
  const activeUser = actorUser || authUser;
  const canManageSuperAdminMedia = isSuperAdmin(activeUser);

  const [form, setForm] = useState(buildForm(settings));
  const [amenities, setAmenities] = useState(settings?.amenities || defaultSiteSettings.amenities);
  const [resortGallery, setResortGallery] = useState(settings?.resort_gallery || defaultSiteSettings.resort_gallery);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingPackagesBanner, setUploadingPackagesBanner] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  useEffect(() => {
    setForm(buildForm(settings));
    setAmenities(settings?.amenities || defaultSiteSettings.amenities);
    setResortGallery(settings?.resort_gallery || defaultSiteSettings.resort_gallery);
  }, [settings]);

  const previewHeroImages = Array.isArray(form.hero_images) && form.hero_images.length > 0
    ? form.hero_images.filter(Boolean)
    : [form.hero_image_url || defaultSiteSettings.hero_image_url].filter(Boolean);
  const previewLogo = form.logo_url?.trim() || "";
  const previewSiteName = form.site_name?.trim() || defaultSiteSettings.site_name;
  const previewBadge = form.hero_badge_text?.trim() || defaultSiteSettings.hero_badge_text;
  const previewTitleLine1 = form.hero_title_line1?.trim() || defaultSiteSettings.hero_title_line1;
  const previewTitleLine2 = form.hero_title_line2?.trim() || defaultSiteSettings.hero_title_line2;
  const previewDescription = form.hero_description?.trim() || defaultSiteSettings.hero_description;

  const updateAmenity = (index, field, value) =>
    setAmenities((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  const removeAmenity = (index) =>
    setAmenities((prev) => prev.filter((_, i) => i !== index));

  const addAmenity = () =>
    setAmenities((prev) => [...prev, { icon: "star", title: "New Amenity", desc: "Description here" }]);

  const updateGallerySlide = (index, field, value) =>
    setResortGallery((prev) => prev.map((slide, slideIndex) => (slideIndex === index ? { ...slide, [field]: value } : slide)));

  const removeGallerySlide = (index) =>
    setResortGallery((prev) => prev.filter((_, slideIndex) => slideIndex !== index));

  const moveGallerySlide = (index, direction) => {
    setResortGallery((prev) => {
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const nextSlides = [...prev];
      const [selectedSlide] = nextSlides.splice(index, 1);
      nextSlides.splice(targetIndex, 0, selectedSlide);
      return nextSlides;
    });
  };

  const uploadGalleryImages = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);

    if (!files.length) {
      return;
    }

    setUploadingGallery(true);

    try {
      const uploadedSlides = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await baseClient.integrations.Core.UploadFile({ file });
          const fallbackTitle = file.name.replace(/\.[^.]+$/, "").trim() || "Resort Photo";

          return {
            src: file_url,
            title: fallbackTitle,
            subtitle: "Add a short description for this resort photo.",
          };
        })
      );

      setResortGallery((prev) => [...prev, ...uploadedSlides]);
      toast.success(`${uploadedSlides.length} resort image${uploadedSlides.length > 1 ? "s" : ""} uploaded.`);
    } catch (error) {
      toast.error(error?.message || "Unable to upload resort gallery images.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const uploadImage = async (file, type) => {
    if (!file) {
      return;
    }

    const setUploading = type === "logo"
      ? setUploadingLogo
      : type === "packages-banner"
        ? setUploadingPackagesBanner
        : setUploadingHero;
    setUploading(true);

    try {
      const { file_url } = await baseClient.integrations.Core.UploadFile({ file });
      setForm((prev) => ({
        ...prev,
        [type === "logo" ? "logo_url" : type === "packages-banner" ? "packages_banner_url" : "hero_image_url"]: file_url,
      }));
      toast.success(`${type === "logo" ? "Logo" : type === "packages-banner" ? "Packages banner image" : "Homepage image"} uploaded.`);
    } catch (error) {
      toast.error(error?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const uploadSiteImages = async (fileList, field) => {
    const files = Array.from(fileList || []).filter(Boolean);

    if (!files.length) {
      return;
    }

    const setUploading = field === "hero_images" ? setUploadingHero : setUploadingPackagesBanner;
    setUploading(true);

    try {
      const uploadedImages = [];

      for (const file of files) {
        const { file_url } = await baseClient.integrations.Core.UploadFile({ file });
        uploadedImages.push(file_url);
      }

      setForm((prev) => {
        const nextImages = [...(Array.isArray(prev[field]) ? prev[field] : []), ...uploadedImages];

        return {
          ...prev,
          [field]: nextImages,
          [field === "hero_images" ? "hero_image_url" : "packages_banner_url"]: nextImages[0] || "",
        };
      });

      toast.success(`${uploadedImages.length} ${field === "hero_images" ? "homepage hero" : "packages banner"} image${uploadedImages.length > 1 ? "s" : ""} uploaded.`);
    } catch (error) {
      toast.error(error?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removeSiteImage = (field, imageUrl) => {
    setForm((prev) => {
      const nextImages = (Array.isArray(prev[field]) ? prev[field] : []).filter((entry) => entry !== imageUrl);

      return {
        ...prev,
        [field]: nextImages,
        [field === "hero_images" ? "hero_image_url" : "packages_banner_url"]: nextImages[0] || "",
      };
    });
  };

  const setSiteImageCover = (field, imageUrl) => {
    setForm((prev) => {
      const withoutTarget = (Array.isArray(prev[field]) ? prev[field] : []).filter((entry) => entry !== imageUrl);
      const nextImages = [imageUrl, ...withoutTarget];

      return {
        ...prev,
        [field]: nextImages,
        [field === "hero_images" ? "hero_image_url" : "packages_banner_url"]: imageUrl,
      };
    });
  };

  const handleSave = async () => {
    if (!form.site_name.trim()) {
      toast.error("Website name is required.");
      return;
    }

    setIsSaving(true);

    const payload = {
      site_name: form.site_name.trim(),
      logo_url: form.logo_url?.trim() || null,
      hero_image_url: form.hero_images?.[0]?.trim() || form.hero_image_url?.trim() || null,
      hero_images_json: (Array.isArray(form.hero_images) ? form.hero_images : []).filter(Boolean),
      packages_banner_url: form.packages_banner_images?.[0]?.trim() || form.packages_banner_url?.trim() || null,
      packages_banner_images_json: (Array.isArray(form.packages_banner_images) ? form.packages_banner_images : []).filter(Boolean),
      hero_badge_text: form.hero_badge_text?.trim() || null,
      hero_title_line1: form.hero_title_line1?.trim() || null,
      hero_title_line2: form.hero_title_line2?.trim() || null,
      hero_description: form.hero_description?.trim() || null,
      body_font_style: form.body_font_style,
      heading_font_style: form.heading_font_style,
      amenities_section_label: form.amenities_section_label?.trim() || null,
      amenities_section_title: form.amenities_section_title?.trim() || null,
      amenities_section_description: form.amenities_section_description?.trim() || null,
      terms_title: form.terms_title?.trim() || null,
      terms_summary: form.terms_summary?.trim() || null,
      terms_content: form.terms_content?.trim() || null,
      resort_gallery_json:
        resortGallery
          .map((slide) => ({
            src: slide?.src?.trim() || "",
            title: slide?.title?.trim() || "Resort Photo",
            subtitle: slide?.subtitle?.trim() || "",
          }))
          .filter((slide) => slide.src),
      amenities_json: amenities,
    };

    const savePayload = settingRecord?.id
      ? { ...settingRecord, ...payload }
      : {
          id: "site-settings-main",
          ...defaultSiteSettings,
          ...payload,
        };

    try {
      if (settingRecord?.id) {
        await baseClient.entities.SiteSetting.update(settingRecord.id, savePayload);
      } else {
        await baseClient.entities.SiteSetting.create(savePayload);
      }

      await baseClient.entities.ActivityLog.create({
        user_email: activeUser?.email || null,
        user_name: activeUser?.full_name || "Admin",
        action: "Updated System Settings",
        entity_type: "SiteSetting",
        entity_id: settingRecord?.id || "site-settings-main",
        details: "Updated homepage content, packages banner, resort gallery, amenities, typography, and legal settings.",
      });

      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("System settings saved.");
    } catch (error) {
      toast.error(error?.message || "Unable to save system settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={embedded || section ? "flex justify-center py-12" : "flex justify-center py-28"}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={embedded || section ? "space-y-6" : "w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4"}>
      {!embedded && !section && (
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-foreground">Manage System Settings</h1>
          <p className="text-muted-foreground">
            Update the website logo, text style, and main homepage hero section.
          </p>
        </div>
      )}
      {embedded && (
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Homepage Content Settings</h2>
          <p className="text-muted-foreground mt-1">Edit homepage branding, text style, and hero section content.</p>
        </div>
      )}

      {(embedded || !section || section === "homepage") && (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Branding & Homepage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="site-name">Website Name</Label>
            <Input
              id="site-name"
              value={form.site_name}
              onChange={(event) => setForm((prev) => ({ ...prev, site_name: event.target.value }))}
              placeholder="kaka liana"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Label>Website Logo</Label>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <p className="text-xs text-muted-foreground">No custom logo uploaded</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <Button type="button" variant="outline" className="w-full gap-2" asChild>
                      <span>
                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        Upload Logo
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploadingLogo}
                      onChange={(event) => uploadImage(event.target.files?.[0], "logo")}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2"
                    onClick={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Main Homepage Hero Images</Label>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {form.hero_images?.[0] ? (
                    <img src={form.hero_images[0]} alt="Hero preview" className="h-full w-full object-cover" />
                  ) : (
                    <p className="text-xs text-muted-foreground">No hero images selected</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <Button type="button" variant="outline" className="w-full gap-2" asChild>
                      <span>
                        {uploadingHero ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        Upload Hero Images
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={uploadingHero}
                      onChange={(event) => {
                        uploadSiteImages(event.target.files, "hero_images");
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2"
                    onClick={() => setForm((prev) => ({ ...prev, hero_images: [], hero_image_url: "" }))}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>

                {form.hero_images?.length ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {form.hero_images.map((imageUrl, index) => (
                        <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                          <img src={imageUrl} alt={`Hero preview ${index + 1}`} className="h-24 w-full object-cover" />
                          <div className="space-y-2 p-2">
                            <div className="text-[11px] text-muted-foreground">
                              {index === 0 ? "Cover image" : `Image ${index + 1}`}
                            </div>
                            <div className="flex gap-2">
                              {index !== 0 ? (
                                <Button type="button" variant="outline" size="sm" className="h-8 flex-1 px-2 text-xs" onClick={() => setSiteImageCover("hero_images", imageUrl)}>
                                  Set Cover
                                </Button>
                              ) : null}
                              <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => removeSiteImage("hero_images", imageUrl)}>
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">The first image is used as the homepage cover image and rotates with the rest on the guest homepage.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label htmlFor="hero-badge">Hero Badge Text</Label>
              <Input
                id="hero-badge"
                value={form.hero_badge_text}
                onChange={(event) => setForm((prev) => ({ ...prev, hero_badge_text: event.target.value }))}
                placeholder="Welcome to Paradise"
              />
            </div>
            <div>
              <Label htmlFor="hero-title-line-1">Hero Title Line 1</Label>
              <Input
                id="hero-title-line-1"
                value={form.hero_title_line1}
                onChange={(event) => setForm((prev) => ({ ...prev, hero_title_line1: event.target.value }))}
                placeholder="Kasa Ilaya"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="hero-title-line-2">Hero Title Line 2</Label>
            <Input
              id="hero-title-line-2"
              value={form.hero_title_line2}
              onChange={(event) => setForm((prev) => ({ ...prev, hero_title_line2: event.target.value }))}
              placeholder="Resort & Event Place"
            />
          </div>

          <div>
            <Label htmlFor="hero-description">Hero Description</Label>
            <Textarea
              id="hero-description"
              value={form.hero_description}
              rows={4}
              onChange={(event) => setForm((prev) => ({ ...prev, hero_description: event.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>Homepage Preview</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Live preview of the homepage hero section using the values above.
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="gap-2 self-start">
                    Show Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl gap-0 overflow-hidden p-0 sm:max-h-[90vh]">
                  <DialogHeader className="border-b border-border px-6 py-5 text-left">
                    <DialogTitle className="font-display text-2xl text-foreground">Homepage Preview</DialogTitle>
                    <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
                      Popup preview of the homepage hero section based on the current system settings values.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="overflow-y-auto">
                    <div className="overflow-hidden bg-card">
                      <div className="relative min-h-[420px] bg-slate-950 text-white">
                        {previewHeroImages.length > 0 ? (
                          <img
                            src={previewHeroImages[0]}
                            alt="Homepage hero preview"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/10" />
                        <div className="relative flex min-h-[420px] flex-col justify-between p-6 sm:p-8 lg:p-12">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/90 shadow-lg">
                              {previewLogo ? (
                                <img src={previewLogo} alt="Homepage logo preview" className="h-full w-full object-contain" />
                              ) : (
                                <span className="font-display text-lg font-bold text-primary">
                                  {previewSiteName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-display text-lg font-semibold text-white">{previewSiteName}</p>
                              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Resort Preview</p>
                            </div>
                          </div>

                          <div className="max-w-3xl space-y-4">
                            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
                              {previewBadge}
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                                {previewTitleLine1}
                              </h3>
                              <h4 className="font-display text-3xl font-semibold leading-tight text-white/90 sm:text-4xl lg:text-5xl">
                                {previewTitleLine2}
                              </h4>
                            </div>
                            <p className="max-w-2xl text-sm leading-7 text-white/80 sm:text-base lg:text-lg">
                              {previewDescription}
                            </p>
                            <div className="flex flex-wrap gap-3 pt-2">
                              <div className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                                Explore Packages
                              </div>
                              <div className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                                Learn More
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 border-t border-border bg-muted/20 p-4 sm:grid-cols-3 lg:p-6">
                        <div className="rounded-2xl bg-background/90 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Gallery</p>
                          <p className="mt-2 text-sm text-foreground">Homepage gallery and resort visuals continue below the hero section.</p>
                        </div>
                        <div className="rounded-2xl bg-background/90 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Amenities</p>
                          <p className="mt-2 text-sm text-foreground">Feature cards highlight your amenities and guest experience details.</p>
                        </div>
                        <div className="rounded-2xl bg-background/90 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rules & Reviews</p>
                          <p className="mt-2 text-sm text-foreground">Guest rules, reviews, and calls to action appear further down the homepage.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {(embedded || !section || section === "packages-banner") && canManageSuperAdminMedia && (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Guest Page Banners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Change the background photos used on guest-facing page banners, excluding the homepage hero. Super admins only.
          </p>

          <div className="space-y-3">
            <Label>Page Banner Images</Label>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {form.packages_banner_images?.[0] ? (
                  <img src={form.packages_banner_images[0]} alt="Packages banner preview" className="h-full w-full object-cover" />
                ) : (
                  <p className="text-xs text-muted-foreground">No page banner images selected</p>
                )}
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <Button type="button" variant="outline" className="w-full gap-2" asChild>
                    <span>
                      {uploadingPackagesBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Upload Page Banner Images
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploadingPackagesBanner}
                    onChange={(event) => {
                      uploadSiteImages(event.target.files, "packages_banner_images");
                      event.target.value = "";
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => setForm((prev) => ({ ...prev, packages_banner_images: [], packages_banner_url: "" }))}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              </div>

              {form.packages_banner_images?.length ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {form.packages_banner_images.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                        <img src={imageUrl} alt={`Packages banner preview ${index + 1}`} className="h-24 w-full object-cover" />
                        <div className="space-y-2 p-2">
                          <div className="text-[11px] text-muted-foreground">
                            {index === 0 ? "Cover image" : `Image ${index + 1}`}
                          </div>
                          <div className="flex gap-2">
                            {index !== 0 ? (
                              <Button type="button" variant="outline" size="sm" className="h-8 flex-1 px-2 text-xs" onClick={() => setSiteImageCover("packages_banner_images", imageUrl)}>
                                Set Cover
                              </Button>
                            ) : null}
                            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => removeSiteImage("packages_banner_images", imageUrl)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">The first image is used as the initial banner cover on guest pages outside the homepage.</p>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {(embedded || !section || section === "text-style") && (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Text Style</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div>
            <Label htmlFor="body-font">Body Font Style</Label>
            <Select
              value={form.body_font_style}
              onValueChange={(value) => setForm((prev) => ({ ...prev, body_font_style: value }))}
            >
              <SelectTrigger id="body-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FONT_STYLE_OPTIONS).map(([key, option]) => (
                  <SelectItem key={key} value={key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="heading-font">Heading Font Style</Label>
            <Select
              value={form.heading_font_style}
              onValueChange={(value) => setForm((prev) => ({ ...prev, heading_font_style: value }))}
            >
              <SelectTrigger id="heading-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FONT_STYLE_OPTIONS).map(([key, option]) => (
                  <SelectItem key={key} value={key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      )}

      {(embedded || !section || section === "amenities") && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-2xl">Amenities Section</CardTitle>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addAmenity}>
              <Plus className="h-4 w-4" /> Add Amenity
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Label htmlFor="amenities-label">Section Label</Label>
              <Input
                id="amenities-label"
                value={form.amenities_section_label}
                onChange={(e) => setForm((prev) => ({ ...prev, amenities_section_label: e.target.value }))}
                placeholder="Our Amenities"
              />
            </div>
            <div>
              <Label htmlFor="amenities-title">Section Title</Label>
              <Input
                id="amenities-title"
                value={form.amenities_section_title}
                onChange={(e) => setForm((prev) => ({ ...prev, amenities_section_title: e.target.value }))}
                placeholder="Everything You Need"
              />
            </div>
            <div>
              <Label htmlFor="amenities-desc">Section Description</Label>
              <Input
                id="amenities-desc"
                value={form.amenities_section_description}
                onChange={(e) => setForm((prev) => ({ ...prev, amenities_section_description: e.target.value }))}
                placeholder="Enjoy world-class amenities..."
              />
            </div>
          </div>

          <div className="space-y-3">
            {amenities.map((item, i) => {
              const iconOption = AMENITY_ICON_OPTIONS[item.icon] || AMENITY_ICON_OPTIONS.star;
              const PreviewIcon = iconOption.Component;
              return (
                <div key={i} className="flex flex-wrap gap-3 items-end rounded-xl border border-border bg-muted/20 p-4">
                  <div className="w-48 shrink-0">
                    <Label className="mb-1 block">Icon</Label>
                    <Select value={item.icon} onValueChange={(val) => updateAmenity(i, "icon", val)}>
                      <SelectTrigger className="gap-2">
                        <PreviewIcon className="h-4 w-4 shrink-0 text-primary" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AMENITY_ICON_OPTIONS).map(([key, opt]) => {
                          const Ico = opt.Component;
                          return (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-2">
                                <Ico className="h-4 w-4" />
                                {opt.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-36">
                    <Label className="mb-1 block">Title</Label>
                    <Input
                      value={item.title}
                      onChange={(e) => updateAmenity(i, "title", e.target.value)}
                      placeholder="Amenity name"
                    />
                  </div>
                  <div className="flex-1 min-w-48">
                    <Label className="mb-1 block">Description</Label>
                    <Input
                      value={item.desc}
                      onChange={(e) => updateAmenity(i, "desc", e.target.value)}
                      placeholder="Short description"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAmenity(i)}
                    title="Remove amenity"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {amenities.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No amenities added yet. Click "Add Amenity" to create one.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {(embedded || !section || section === "terms-conditions") && (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="terms-title">Dialog Title</Label>
            <Input
              id="terms-title"
              value={form.terms_title}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_title: event.target.value }))}
              placeholder="Terms and Conditions"
            />
          </div>

          <div>
            <Label htmlFor="terms-summary">Short Summary</Label>
            <Textarea
              id="terms-summary"
              value={form.terms_summary}
              rows={3}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_summary: event.target.value }))}
              placeholder="Explain what guests are agreeing to before they book."
            />
          </div>

          <div>
            <Label htmlFor="terms-content">Full Terms Content</Label>
            <Textarea
              id="terms-content"
              value={form.terms_content}
              rows={16}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_content: event.target.value }))}
              placeholder="Write the complete terms and conditions shown to guests."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Separate sections with blank lines to keep the public dialog readable.
            </p>
          </div>
        </CardContent>
      </Card>
      )}

      {(embedded || !section || section === "resort-gallery") && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-2xl">Resort Gallery Slider</CardTitle>
            <label>
              <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                <span>
                  {uploadingGallery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
                  Upload Images
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={uploadingGallery}
                onChange={(event) => {
                  uploadGalleryImages(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            These images appear on the user home page slider. Only super admins can access this settings page.
          </p>

          {resortGallery.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No resort gallery images yet. Upload photos to populate the home page slider.
            </div>
          ) : (
            <div className="space-y-4">
              {resortGallery.map((slide, index) => (
                <div key={`${slide.src || "slide"}-${index}`} className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 lg:grid-cols-[200px_minmax(0,1fr)_auto]">
                  <div className="overflow-hidden rounded-xl border border-border bg-muted">
                    {slide.src ? (
                      <img src={slide.src} alt={slide.title || `Resort slide ${index + 1}`} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">No image</div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block">Title</Label>
                      <Input
                        value={slide.title || ""}
                        onChange={(event) => updateGallerySlide(index, "title", event.target.value)}
                        placeholder="Resort View"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block">Subtitle</Label>
                      <Textarea
                        value={slide.subtitle || ""}
                        rows={3}
                        onChange={(event) => updateGallerySlide(index, "subtitle", event.target.value)}
                        placeholder="Describe what guests are seeing in this photo."
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 lg:flex-col">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveGallerySlide(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveGallerySlide(index, 1)}
                      disabled={index === resortGallery.length - 1}
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeGallerySlide(index)}
                      title="Remove slide"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <div className="flex justify-end">
        <Button type="button" className="gap-2" onClick={handleSave} disabled={isSaving || uploadingLogo || uploadingHero || uploadingPackagesBanner || uploadingGallery}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save System Settings
        </Button>
      </div>
    </div>
  );
}
