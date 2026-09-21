import React, { useMemo, useState, useEffect } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  CalendarCheck,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import PackageFormDialog from "@/components/admin/PackageFormDialog";
import { toast } from "sonner";

const sortPackagesForDisplay = (packages) =>
  [...packages].sort((left, right) => left.name.localeCompare(right.name));

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

const dedupePackagesById = (packages) => {
  const packageMap = new Map();

  packages.forEach((pkg) => {
    if (!pkg?.id) {
      return;
    }

    packageMap.set(pkg.id, pkg);
  });

  return [...packageMap.values()];
};

const getLowestPrice = (pkg) => Math.min(
  Number(pkg.day_tour_price || 0) || Infinity,
  Number(pkg.night_tour_price || 0) || Infinity,
  Number(pkg.twenty_two_hour_price || 0) || Infinity
);

export default function AdminPackages() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [archiveId, setArchiveId] = useState(null);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: () => baseClient.entities.Package.filter({ is_active: true }, "name"),
  });

  const filteredPackages = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return sortPackagesForDisplay(dedupePackagesById(packages)).filter((pkg) => {
      const isActive = pkg.is_active !== false && pkg.is_active !== 0 && pkg.is_active !== "0";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);
      const matchesSearch = !query || [
        pkg.name,
        pkg.description,
        ...(Array.isArray(pkg.inclusions) ? pkg.inclusions : []),
      ].some((value) => String(value || "").toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [packages, searchTerm, statusFilter]);

  const uniquePackageCount = useMemo(() => dedupePackagesById(packages).length, [packages]);

  const summary = useMemo(() => {
    const uniquePackages = dedupePackagesById(packages);
    const active = uniquePackages.filter((pkg) => pkg.is_active !== false && pkg.is_active !== 0 && pkg.is_active !== "0").length;
    const withImages = uniquePackages.filter((pkg) => pkg.image_url || (Array.isArray(pkg.gallery_images) && pkg.gallery_images.length > 0)).length;
    const capacity = uniquePackages.reduce((sum, pkg) => sum + Number(pkg.max_guests || 0), 0);
    const lowestPrices = uniquePackages
      .map(getLowestPrice)
      .filter((price) => Number.isFinite(price) && price > 0);
    const startingPrice = lowestPrices.length ? Math.min(...lowestPrices) : 0;

    return {
      total: uniquePackages.length,
      active,
      withImages,
      capacity,
      startingPrice,
    };
  }, [packages]);

  const handleSave = async (data) => {
    if (editPkg) {
      const updated = await baseClient.entities.Package.update(editPkg.id, data);
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Updated Package",
        entity_type: "Package",
        entity_id: editPkg.id,
        details: `Updated package: ${data.name}`,
      });

      queryClient.setQueryData(["admin-packages"], (current = []) =>
        sortPackagesForDisplay(current.map((entry) => (entry.id === updated.id ? updated : entry)))
      );
    } else {
      const created = await baseClient.entities.Package.create(data);
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Created Package",
        entity_type: "Package",
        entity_id: created.id,
        details: `Created package: ${data.name}`,
      });

      queryClient.setQueryData(["admin-packages"], (current = []) => sortPackagesForDisplay([created, ...current]));
    }
    queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
    queryClient.invalidateQueries({ queryKey: ["packages"] });
    setEditPkg(null);
  };

  const handleArchive = async () => {
    const pkg = packages.find((p) => p.id === archiveId);

    try {
      await baseClient.entities.Package.update(archiveId, { is_active: false });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Archived Package",
        entity_type: "Package",
        entity_id: archiveId,
        details: `Archived package backup: ${pkg?.name}`,
      });
      toast.success("Package archived and moved to Archive.");

      queryClient.setQueryData(["admin-packages"], (current = []) =>
        current.filter((entry) => entry.id !== archiveId)
      );

      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-packages-archived"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    } catch (error) {
      toast.error(error?.message || "Unable to archive the package.");
    } finally {
      setArchiveId(null);
    }
  };

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid gap-6 border-b border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Package management
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Manage Packages</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              Create, price, publish, and archive resort packages shown on the guest booking website.
            </p>
          </div>
          <Button onClick={() => { setEditPkg(null); setFormOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Package
          </Button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total packages", value: summary.total, icon: Tag, tone: "text-foreground" },
            { label: "Active offers", value: summary.active, icon: CalendarCheck, tone: "text-primary" },
            { label: "With images", value: summary.withImages, icon: ImageIcon, tone: "text-secondary" },
            { label: "Guest capacity", value: summary.capacity || "Flexible", icon: Users, tone: "text-emerald-700" },
            { label: "Starting price", value: formatMoney(summary.startingPrice), icon: Wallet, tone: "text-amber-700" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-display text-2xl">Package List</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing {filteredPackages.length} of {uniquePackageCount} active package records.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search package or inclusion"
                  className="pl-9"
                />
              </div>
              <div className="flex rounded-md border border-border bg-background p-1">
                {[
                  { value: "active", label: "Active" },
                  { value: "all", label: "All" },
                ].map((item) => (
                  <Button
                    key={item.value}
                    size="sm"
                    variant={statusFilter === item.value ? "default" : "ghost"}
                    onClick={() => setStatusFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Day Tour</TableHead>
                    <TableHead>Night Tour</TableHead>
                    <TableHead>22 Hours</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Images</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.length ? (
                    filteredPackages.map((pkg) => {
                      const imageCount = Array.isArray(pkg.gallery_images) ? pkg.gallery_images.length : (pkg.image_url ? 1 : 0);
                      const coverImage = pkg.image_url || pkg.gallery_images?.[0];

                      return (
                        <TableRow key={pkg.id}>
                          <TableCell>
                            <div className="flex min-w-72 items-center gap-3">
                              {coverImage ? (
                                <img src={coverImage} alt={pkg.name} className="h-14 w-16 rounded-lg border border-border object-cover shadow-sm" />
                              ) : (
                                <div className="flex h-14 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                                  <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{pkg.name}</p>
                                <p className="mt-1 line-clamp-2 max-w-md text-xs leading-5 text-muted-foreground">
                                  {pkg.description || "No package description yet."}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-secondary">{formatMoney(pkg.day_tour_price)}</TableCell>
                          <TableCell className="font-semibold text-secondary">{formatMoney(pkg.night_tour_price)}</TableCell>
                          <TableCell className="font-semibold text-secondary">{formatMoney(pkg.twenty_two_hour_price)}</TableCell>
                          <TableCell>{pkg.max_guests || 0}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-muted/60 text-muted-foreground">
                              {imageCount} image{imageCount === 1 ? "" : "s"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={pkg.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                              {pkg.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setEditPkg(pkg); setFormOpen(true); }} title="Edit package">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700" onClick={() => setArchiveId(pkg.id)} title="Archive package">
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                        No packages match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PackageFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditPkg(null); }}
        pkg={editPkg}
        onSave={handleSave}
      />

      <AlertDialog open={!!archiveId} onOpenChange={(open) => !open && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This package data will be preserved as backup in Archive. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-amber-600 text-white hover:bg-amber-700">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
