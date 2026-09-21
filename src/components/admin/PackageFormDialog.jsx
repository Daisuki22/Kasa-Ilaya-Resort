import React, { useEffect, useState } from "react";
import { baseClient } from "@/api/baseClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Check, ImagePlus, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

const createDefaultForm = () => ({
  name: "",
  description: "",
  tour_type: "day_tour",
  price: 0,
  day_tour_price: 0,
  night_tour_price: 0,
  twenty_two_hour_price: 0,
  max_guests: 10,
  inclusions: [],
  gallery_images: [],
  image_url: "",
  is_active: true,
});

export default function PackageFormDialog({ open, onOpenChange, pkg, onSave }) {
  const [form, setForm] = useState(createDefaultForm());
  const [newInclusion, setNewInclusion] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(pkg ? {
      ...createDefaultForm(),
      ...pkg,
      inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
      gallery_images: Array.isArray(pkg.gallery_images)
        ? pkg.gallery_images
        : (pkg.image_url ? [pkg.image_url] : []),
    } : createDefaultForm());
    setNewInclusion("");
    setSaving(false);
    setUploadingImages(false);
  }, [open, pkg]);

  const handleSubmit = async () => {
    const dayTourPrice = Number(form.day_tour_price) || 0;
    const nightTourPrice = Number(form.night_tour_price) || 0;
    const twentyTwoHourPrice = Number(form.twenty_two_hour_price) || 0;

    const payload = {
      name: form.name,
      description: form.description,
      tour_type: form.tour_type,
      price: Math.min(dayTourPrice, nightTourPrice, twentyTwoHourPrice),
      day_tour_price: dayTourPrice,
      night_tour_price: nightTourPrice,
      twenty_two_hour_price: twentyTwoHourPrice,
      max_guests: Number(form.max_guests) || 1,
      inclusions: Array.isArray(form.inclusions) ? form.inclusions : [],
      gallery_images: Array.isArray(form.gallery_images) ? form.gallery_images : [],
      image_url: form.gallery_images?.[0] || form.image_url || "",
      is_active: Boolean(form.is_active),
    };

    setSaving(true);

    try {
      await onSave(payload);
      toast.success(pkg ? "Package updated successfully." : "Package created successfully.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error?.message || "Unable to save package.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setUploadingImages(true);

    try {
      const uploadedImages = [];

      for (const file of files) {
        const { file_url } = await baseClient.integrations.Core.UploadFile({ file });
        uploadedImages.push(file_url);
      }

      setForm((prev) => {
        const nextGallery = [...(Array.isArray(prev.gallery_images) ? prev.gallery_images : []), ...uploadedImages];
        return {
          ...prev,
          gallery_images: nextGallery,
          image_url: nextGallery[0] || "",
        };
      });
      toast.success(`${uploadedImages.length} package image${uploadedImages.length > 1 ? "s" : ""} uploaded.`);
    } catch (error) {
      toast.error(error?.message || "Unable to upload package images.");
    } finally {
      setUploadingImages(false);
      event.target.value = "";
    }
  };

  const removeImage = (imageUrl) => {
    setForm((prev) => {
      const nextGallery = (prev.gallery_images || []).filter((entry) => entry !== imageUrl);
      return {
        ...prev,
        gallery_images: nextGallery,
        image_url: nextGallery[0] || "",
      };
    });
  };

  const setCoverImage = (imageUrl) => {
    setForm((prev) => {
      const withoutTarget = (prev.gallery_images || []).filter((entry) => entry !== imageUrl);
      const nextGallery = [imageUrl, ...withoutTarget];
      return {
        ...prev,
        gallery_images: nextGallery,
        image_url: imageUrl,
      };
    });
  };

  const addInclusion = () => {
    if (!newInclusion.trim()) return;
    setForm({ ...form, inclusions: [...(form.inclusions || []), newInclusion.trim()] });
    setNewInclusion("");
  };

  const removeInclusion = (idx) => {
    setForm({ ...form, inclusions: form.inclusions.filter((_, i) => i !== idx) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={pkg?.id || "new-package"} className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{pkg ? "Edit Package" : "Add New Package"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure details, tour pricing, capacity, inclusions, and images for the guest booking page.
          </p>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <section className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground">Package Details</h3>
              <p className="text-sm text-muted-foreground">Name and description shown to guests.</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Package Name *</Label>
                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Deluxe Resort Package" className="mt-1" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Describe the package experience, spaces, and best-fit guests..." rows={4} className="mt-1" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground">Pricing & Capacity</h3>
              <p className="text-sm text-muted-foreground">Set rates for each tour type and the maximum guest capacity.</p>
            </div>
            <Label>Tour Prices (PHP) *</Label>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs text-muted-foreground">Day Tour</Label>
                <Input type="number" value={form.day_tour_price} onChange={(event) => setForm((prev) => ({ ...prev, day_tour_price: parseFloat(event.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Night Tour</Label>
                <Input type="number" value={form.night_tour_price} onChange={(event) => setForm((prev) => ({ ...prev, night_tour_price: parseFloat(event.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">22 Hours</Label>
                <Input type="number" value={form.twenty_two_hour_price} onChange={(event) => setForm((prev) => ({ ...prev, twenty_two_hour_price: parseFloat(event.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>
            <div className="mt-4 max-w-xs">
              <Label>Max Guests</Label>
              <Input type="number" value={form.max_guests} onChange={(event) => setForm((prev) => ({ ...prev, max_guests: parseInt(event.target.value) || 10 }))} className="mt-1" />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImagePlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Package Images</h3>
                <p className="text-sm text-muted-foreground">Upload photos and choose the cover image used on cards and booking previews.</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                {uploadingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{uploadingImages ? "Uploading images..." : "Upload one or more images"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} />
              </label>
              {form.gallery_images?.length ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {form.gallery_images.map((imageUrl, index) => (
                      <div key={imageUrl} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                        <img src={imageUrl} alt={`${form.name || "Package"} preview ${index + 1}`} className="h-28 w-full object-cover" />
                        <div className="space-y-2 p-2">
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {index === 0 ? <Check className="h-3 w-3 text-primary" /> : null}
                            {index === 0 ? "Cover image" : `Image ${index + 1}`}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {index !== 0 ? (
                              <Button type="button" variant="outline" size="sm" className="h-8 flex-1 px-2 text-xs" onClick={() => setCoverImage(imageUrl)}>
                                Set Cover
                              </Button>
                            ) : null}
                            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => removeImage(imageUrl)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">The first image is used as the package cover and booking preview.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No images uploaded yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground">Inclusions & Visibility</h3>
              <p className="text-sm text-muted-foreground">List what guests receive and choose whether this package is public.</p>
            </div>
            <Label>Inclusions</Label>
            <div className="mt-1 flex gap-2">
              <Input value={newInclusion} onChange={(event) => setNewInclusion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addInclusion())} placeholder="e.g. Free breakfast" />
              <Button type="button" size="icon" variant="outline" onClick={addInclusion}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.inclusions?.map((item, i) => (
                <span key={`${item}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  {item}
                  <button type="button" onClick={() => removeInclusion(i)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <Switch checked={form.is_active} onCheckedChange={(value) => setForm((prev) => ({ ...prev, is_active: value }))} />
              <Label>Active and visible to users</Label>
            </div>
          </section>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || uploadingImages || !form.name || (!form.day_tour_price && !form.night_tour_price && !form.twenty_two_hour_price)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pkg ? "Update" : "Create"} Package
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
