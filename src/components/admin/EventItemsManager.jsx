import React, { useMemo, useRef, useState } from "react";
import { createPageUrl } from "@/utils";
// If using react-router-dom v6, you can use useNavigate instead
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, CheckCircle2, Grid3X3, ImagePlus, Loader2, MapPin, PencilLine, Plus, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const createEmptyForm = () => ({
  item_name: "",
  description: "",
  location_found: "",
  found_by: "",
  status: "unclaimed",
  date_found: format(new Date(), "yyyy-MM-dd"),
  image_url: "",
});

const statusStyles = {
  unclaimed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  claimed: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function EventItemsManager({ user }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(createEmptyForm());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-amenities"],
    queryFn: () => baseClient.entities.FoundItem.filter({ is_active: true }, "-date_found", 500),
  });

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch = !query || [
        item.item_name,
        item.description,
        item.location_found,
        item.found_by,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [items, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const available = items.filter((item) => item.status !== "claimed").length;
    const unavailable = items.filter((item) => item.status === "claimed").length;
    const locations = new Set(items.map((item) => item.location_found).filter(Boolean));
    const withPhotos = items.filter((item) => item.image_url).length;

    return {
      total: items.length,
      available,
      unavailable,
      locations: locations.size,
      withPhotos,
    };
  }, [items]);

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(createEmptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setForm({
      item_name: item.item_name || "",
      description: item.description || "",
      location_found: item.location_found || "",
      found_by: item.found_by || "",
      status: item.status || "unclaimed",
      date_found: item.date_found || format(new Date(), "yyyy-MM-dd"),
      image_url: item.image_url || "",
    });
    setDialogOpen(true);
  };

  const refreshItems = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-amenities"] });
    await queryClient.invalidateQueries({ queryKey: ["public-amenities"] });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { file_url } = await baseClient.integrations.Core.UploadFile({ file });
      setForm((prev) => ({ ...prev, image_url: file_url }));
      toast.success("Image uploaded.");
    } catch (error) {
      toast.error(error?.message || "Image upload failed.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const saveLog = async (action, entityId, details) => {
    await baseClient.entities.ActivityLog.create({
      user_email: user?.email,
      user_name: user?.full_name,
      action,
      entity_type: "Amenity",
      entity_id: entityId,
      details,
    });
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) {
      toast.error("Amenity name is required.");
      return;
    }

    setIsSaving(true);

    const payload = {
      item_name: form.item_name.trim(),
      description: form.description.trim() || null,
      date_found: form.date_found,
      location_found: form.location_found.trim() || null,
      found_by: form.found_by.trim() || null,
      status: form.status || "unclaimed",
      image_url: form.image_url?.trim() || null,
      claimed_guest_name: editingItem?.claimed_guest_name || null,
      claimed_contact: editingItem?.claimed_contact || null,
      claimed_reservation_id: editingItem?.claimed_reservation_id || null,
      proof_of_ownership: editingItem?.proof_of_ownership || null,
      released_by: editingItem?.released_by || null,
      date_claimed: editingItem?.date_claimed || null,
    };

    try {
      if (editingItem) {
        await baseClient.entities.FoundItem.update(editingItem.id, payload);
        await saveLog("Updated Amenity", editingItem.id, `Updated amenity ${payload.item_name}.`);
        toast.success("Amenity updated.");
      } else {
        const created = await baseClient.entities.FoundItem.create(payload);
        await saveLog("Created Amenity", created.id, `Created amenity ${payload.item_name}.`);
        toast.success("Amenity added.");
      }

      await refreshItems();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error?.message || "Unable to save amenity.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Archive the amenity "${item.item_name}"?`);
    if (!confirmed) {
      return;
    }

    setArchivingId(item.id);

    try {
      await baseClient.entities.FoundItem.update(item.id, { is_active: false });
      await saveLog("Archived Amenity", item.id, `Archived amenity ${item.item_name}.`);
      await refreshItems();
      toast.success("Amenity archived. Redirecting to Archive...");
      // Redirect to Archive page after a short delay
      setTimeout(() => {
        window.location.href = createPageUrl("AdminPackageArchive");
      }, 1200);
    } catch (error) {
      toast.error(error?.message || "Unable to archive amenity.");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <section className="w-full max-w-none px-0 pb-6 pt-0">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="grid gap-6 border-b border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Resort management
            </div>
            <CardTitle className="font-display text-3xl font-bold text-foreground">Resort Amenities</CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              Manage guest-facing facilities, photos, availability, assigned areas, and staff responsibility from one clean workspace.
            </p>
          </div>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Amenity
          </Button>
        </div>

        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total amenities", value: summary.total, icon: Grid3X3, tone: "text-foreground" },
            { label: "Available", value: summary.available, icon: CheckCircle2, tone: "text-emerald-700" },
            { label: "Unavailable", value: summary.unavailable, icon: ShieldCheck, tone: "text-amber-700" },
            { label: "Areas covered", value: summary.locations, icon: MapPin, tone: "text-primary" },
            { label: "With photos", value: summary.withPhotos, icon: ImagePlus, tone: "text-secondary" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <CardHeader className="flex flex-col gap-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <div className="relative sm:max-w-sm sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search amenity, area, or staff"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Amenities</SelectItem>
                <SelectItem value="unclaimed">Available</SelectItem>
                <SelectItem value="claimed">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Amenity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>In-Charge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No amenities match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.item_name}
                            className="h-14 w-16 rounded-lg object-cover border border-border shadow-sm"
                          />
                        ) : (
                          <div className="h-14 w-16 rounded-lg bg-muted flex items-center justify-center">
                            <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-56">
                          <p className="font-medium text-foreground">{item.item_name}</p>
                          {item.description ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {item.location_found || "No area set"}
                        </span>
                      </TableCell>
                      <TableCell>{item.found_by || "Unassigned"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <Badge variant="outline" className={statusStyles[item.status] || statusStyles.unclaimed} >
                          {item.status === "unclaimed" ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(item)}>
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => handleDelete(item)}
                            disabled={archivingId === item.id}
                            title="Archive amenity"
                          >
                            {archivingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingItem ? "Edit Amenity" : "Add Amenity"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image upload */}
            <div>
              <Label>Photo</Label>
              <div className="mt-1 flex items-start gap-3">
                {form.image_url ? (
                  <div className="relative h-20 w-20 flex-shrink-0">
                    <img
                      src={form.image_url}
                      alt="Preview"
                      className="h-20 w-20 rounded-xl object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                <label className="flex flex-1 min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <span>{isUploading ? "Uploading..." : "Upload photo"}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="item-name">Amenity Name</Label>
              <Input
                id="item-name"
                value={form.item_name}
                onChange={(event) => setForm({ ...form, item_name: event.target.value })}
                placeholder="Swimming Pool, Cottage, Event Hall..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="item-status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger id="item-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unclaimed">Available</SelectItem>
                    <SelectItem value="claimed">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="item-location">Location / Area</Label>
                <Input
                  id="item-location"
                  value={form.location_found}
                  onChange={(event) => setForm({ ...form, location_found: event.target.value })}
                  placeholder="Pool area, function hall, cottage..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="item-staff">In-Charge / Staff</Label>
              <Input
                id="item-staff"
                value={form.found_by}
                onChange={(event) => setForm({ ...form, found_by: event.target.value })}
                placeholder="Staff or team responsible"
              />
            </div>

            <div>
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Describe this amenity for guests."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving || isUploading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Saving..." : editingItem ? "Save Changes" : "Add Amenity"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
