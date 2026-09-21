import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, History, Loader2, MessageSquareMore, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { isSuperAdmin } from "@/lib/adminAccess";

const sortPackagesForDisplay = (packages) =>
  [...packages].sort((left, right) => left.name.localeCompare(right.name));

const sortQrCodesForDisplay = (codes) =>
  [...codes].sort((left, right) => (left.display_order ?? 99) - (right.display_order ?? 99));

const sortUsersForDisplay = (users) =>
  [...users].sort((left, right) => String(left.full_name || "").localeCompare(String(right.full_name || "")));

const archiveHistoryActions = [
  "archived",
  "archive",
  "restored",
  "restore",
];

const formatHistoryDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return format(date, "MMM d, yyyy h:mm a");
};


export default function AdminPackageArchive() {

  const [error] = useState(null);
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [restoreBookingId, setRestoreBookingId] = useState(null);
  const [restorePackageId, setRestorePackageId] = useState(null);
  const [restoreQrId, setRestoreQrId] = useState(null);
  const [restoreUserId, setRestoreUserId] = useState(null);
  const [restoreAmenityId, setRestoreAmenityId] = useState(null);
  const [selectedArchivedInquiryId, setSelectedArchivedInquiryId] = useState(null);

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const canViewArchiveHistory = isSuperAdmin(user);

  // Fetch archived bookings (show both archived and cancelled as archived)
  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings-archived"],
    queryFn: () => baseClient.entities.Booking.filter({ status: ["archived", "cancelled"] }, "-created_date", 500),
  });
  const archivedBookings = bookingsQuery.data || [];
  const isLoadingBookings = bookingsQuery.isLoading;

  // Fetch archived packages
  const packagesQuery = useQuery({
    queryKey: ["admin-packages-archived"],
    queryFn: () => baseClient.entities.Package.filter({ is_active: false }, "name"),
  });
  const archivedPackages = packagesQuery.data || [];
  const isLoadingPackages = packagesQuery.isLoading;

  // Fetch QR codes
  const qrQuery = useQuery({
    queryKey: ["admin-payment-qr-codes"],
    queryFn: () => baseClient.entities.PaymentQrCode.list("display_order", 50),
  });
  const qrCodes = qrQuery.data || [];
  const isLoadingQrCodes = qrQuery.isLoading;

  const handleRestoreBooking = async () => {
    const booking = archivedBookings.find((entry) => entry.id === restoreBookingId);
    try {
      await baseClient.entities.Booking.update(restoreBookingId, { status: "pending" });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Restored Booking",
        entity_type: "Booking",
        entity_id: restoreBookingId,
        details: `Restored archived booking: ${booking?.booking_reference}`,
      });
      toast.success("Booking restored successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-archived"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to restore booking.");
    } finally {
      setRestoreBookingId(null);
    }
  };

const roleBadgeClass = {
  super_admin: "bg-primary/10 text-primary border-primary/30",
  admin: "bg-accent/20 text-accent-foreground border-accent/30",
  guest: "bg-muted text-muted-foreground border-border",
};

const roleLabel = {
  super_admin: "Super Admin",
  admin: "Admin",
  guest: "Guest",
};

// Duplicate component and state declarations removed. Only one AdminPackageArchive component should exist.


  // Fetch users
  const usersQuery = useQuery({
    queryKey: ["admin-user-permissions"],
    queryFn: () => baseClient.entities.User.list("full_name", 1000),
  });
  const users = usersQuery.data || [];
  const isLoadingUsers = usersQuery.isLoading;

  // Fetch archived amenities
  const amenitiesQuery = useQuery({
    queryKey: ["admin-amenities-archived"],
    queryFn: () => baseClient.entities.FoundItem.filter({ is_active: false }, "-date_found", 500),
  });
  const archivedAmenities = amenitiesQuery.data || [];
  const isLoadingAmenities = amenitiesQuery.isLoading;

  const archiveHistoryQuery = useQuery({
    queryKey: ["admin-archive-history"],
    queryFn: () => baseClient.entities.ActivityLog.list("-created_date", 500),
    enabled: canViewArchiveHistory,
  });

  const archiveHistory = useMemo(
    () => (archiveHistoryQuery.data || []).filter((log) => {
      const content = `${log.action || ""} ${log.details || ""}`.toLowerCase();
      return archiveHistoryActions.some((keyword) => content.includes(keyword));
    }),
    [archiveHistoryQuery.data]
  );

  const archivedInquiriesQuery = useQuery({
    queryKey: ["admin-inquiries-archived"],
    queryFn: () => baseClient.inquiries.list("archived"),
    enabled: canViewArchiveHistory,
  });
  const archivedInquiries = archivedInquiriesQuery.data || [];

  const archivedInquiryThreadQuery = useQuery({
    queryKey: ["admin-archived-inquiry-thread", selectedArchivedInquiryId],
    queryFn: () => baseClient.inquiries.thread(selectedArchivedInquiryId),
    enabled: Boolean(canViewArchiveHistory && selectedArchivedInquiryId),
  });

  const inquiryArchiveLogById = useMemo(() => {
    const logsById = new Map();

    for (const log of archiveHistory) {
      if (log.entity_type !== "Inquiry" || !String(log.action || "").toLowerCase().includes("archived")) {
        continue;
      }

      if (!logsById.has(log.entity_id)) {
        logsById.set(log.entity_id, log);
      }
    }

    return logsById;
  }, [archiveHistory]);

  const archivedQrCodes = useMemo(
    () => sortQrCodesForDisplay((qrCodes || []).filter((entry) => entry.is_active === false || entry.is_active === 0 || entry.is_active === "0")),
    [qrCodes]
  );

  const archivedUsers = useMemo(
    () => sortUsersForDisplay((users || []).filter((entry) => Boolean(entry.disabled))),
    [users]
  );


  // Combine all loading and error states
  const isLoading = isLoadingPackages || isLoadingQrCodes || isLoadingUsers || isLoadingBookings || isLoadingAmenities;
  const queryError = bookingsQuery.error || packagesQuery.error || qrQuery.error || usersQuery.error || amenitiesQuery.error || archiveHistoryQuery.error || archivedInquiriesQuery.error || archivedInquiryThreadQuery.error;

  const handleRestorePackage = async () => {
    const pkg = archivedPackages.find((entry) => entry.id === restorePackageId);

    try {
      await baseClient.entities.Package.update(restorePackageId, { is_active: true });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Restored Package",
        entity_type: "Package",
        entity_id: restorePackageId,
        details: `Restored archived package: ${pkg?.name}`,
      });

      toast.success("Package restored successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-packages-archived"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to restore package.");
    } finally {
      setRestorePackageId(null);
    }
  };

  const handleRestoreQrCode = async () => {
    const target = archivedQrCodes.find((entry) => entry.id === restoreQrId);

    try {
      await baseClient.entities.PaymentQrCode.update(restoreQrId, { is_active: true });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Restored Payment QR Code",
        entity_type: "PaymentQrCode",
        entity_id: restoreQrId,
        details: `Restored QR code: ${target?.label || restoreQrId}`,
      });

      toast.success("QR code restored.");
      queryClient.invalidateQueries({ queryKey: ["admin-payment-qr-codes"] });
      queryClient.invalidateQueries({ queryKey: ["booking-payment-qr-codes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to restore QR code.");
    } finally {
      setRestoreQrId(null);
    }
  };

  const handleRestoreUser = async () => {
    const target = archivedUsers.find((entry) => entry.id === restoreUserId);

    try {
      await baseClient.entities.User.update(restoreUserId, { disabled: false });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Restored User Account",
        entity_type: "User",
        entity_id: restoreUserId,
        details: `Restored account for ${target?.email || restoreUserId}`,
      });

      toast.success("User account restored.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    } catch (error) {
      toast.error(error?.message || "Unable to restore user account.");
    } finally {
      setRestoreUserId(null);
    }
  };

    const handleRestoreAmenity = async () => {
      const amenity = archivedAmenities.find((entry) => entry.id === restoreAmenityId);
      try {
        await baseClient.entities.FoundItem.update(restoreAmenityId, { is_active: true });
        await baseClient.entities.ActivityLog.create({
          user_email: user?.email,
          user_name: user?.full_name,
          action: "Restored Amenity",
          entity_type: "Amenity",
          entity_id: restoreAmenityId,
          details: `Restored amenity: ${amenity?.item_name}`,
        });
        toast.success("Amenity restored.");
        queryClient.invalidateQueries({ queryKey: ["admin-amenities"] });
        queryClient.invalidateQueries({ queryKey: ["admin-amenities-archived"] });
        queryClient.invalidateQueries({ queryKey: ["public-amenities"] });
      } catch (error) {
        toast.error(error?.message || "Unable to restore amenity.");
      } finally {
        setRestoreAmenityId(null);
      }
    };

  if (error || queryError) {
    return (
      <div style={{ color: 'red', padding: 32 }}>
        <h2>Error in Archive Page</h2>
        <pre>{(error && (error.message || String(error))) || (queryError && (queryError.message || String(queryError)))}</pre>
      </div>
    );
  }
  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Archive</h1>
          <p className="mt-1 text-muted-foreground">
            Restore archived packages, QR codes, user accounts, amenities, and reservations from one page.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold text-foreground">Archived Reservations</h2>
              <p className="mt-1 text-sm text-muted-foreground">Restore archived reservations back to Reservation Management.</p>
            </div>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedBookings.length ? (
                      archivedBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-sm">{booking.booking_reference}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{booking.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{booking.customer_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{booking.package_name}</TableCell>
                          <TableCell>{booking.booking_date ? format(new Date(booking.booking_date), "MMM d, yyyy") : "-"}</TableCell>
                          <TableCell className="font-semibold text-secondary">PHP {booking.total_amount?.toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{booking.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRestoreBookingId(booking.id)}>
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No archived reservations.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold text-foreground">Archived Packages</h2>
              <p className="mt-1 text-sm text-muted-foreground">Restore package offers back into the public package list.</p>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Day Tour</TableHead>
                      <TableHead>Night Tour</TableHead>
                      <TableHead>22 Hours</TableHead>
                      <TableHead>Max Guests</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortPackagesForDisplay(archivedPackages).length ? (
                      sortPackagesForDisplay(archivedPackages).map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-medium">{pkg.name}</TableCell>
                          <TableCell className="font-semibold text-secondary">PHP {pkg.day_tour_price?.toLocaleString() || 0}</TableCell>
                          <TableCell className="font-semibold text-secondary">PHP {pkg.night_tour_price?.toLocaleString() || 0}</TableCell>
                          <TableCell className="font-semibold text-secondary">PHP {pkg.twenty_two_hour_price?.toLocaleString() || 0}</TableCell>
                          <TableCell>{pkg.max_guests}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRestorePackageId(pkg.id)}>
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No archived packages.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold text-foreground">Archived QR Codes</h2>
              <p className="mt-1 text-sm text-muted-foreground">Restore payment QR options when they should appear again in booking.</p>
            </div>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedQrCodes.length ? (
                      archivedQrCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell>
                            <img src={code.image_url} alt={code.label} className="h-16 w-16 rounded-lg border border-border object-cover" />
                          </TableCell>
                          <TableCell className="font-medium">{code.label}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{code.account_name || "No account name"}</p>
                              <p className="text-muted-foreground">{code.account_number || "No account number"}</p>
                            </div>
                          </TableCell>
                          <TableCell>{code.display_order}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRestoreQrId(code.id)}>
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No archived QR codes.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold text-foreground">Archived User Accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">Restore archived accounts so they can sign in and appear in active user management again.</p>
            </div>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedUsers.length ? (
                      archivedUsers.map((targetUser) => (
                        <TableRow key={targetUser.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{targetUser.full_name || "Unnamed"}</p>
                              <p className="text-xs font-mono text-muted-foreground">{targetUser.id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{targetUser.email}</p>
                              <p className="text-xs text-muted-foreground">{targetUser.phone || "No phone"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleBadgeClass[targetUser.role] || roleBadgeClass.guest}>
                              {roleLabel[targetUser.role] || targetUser.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {targetUser.created_date ? format(new Date(targetUser.created_date), "MMM d, yyyy") : "Unknown"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRestoreUserId(targetUser.id)}>
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No archived user accounts.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

        <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold text-foreground">Archived Amenities</h2>
              <p className="mt-1 text-sm text-muted-foreground">Restore archived amenities so they can be seen in the active amenities list again.</p>
            </div>
          <Card>
                    <CardContent className="overflow-x-auto p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Photo</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>In-Charge</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {archivedAmenities.length ? (
                            archivedAmenities.map((amenity) => (
                              <TableRow key={amenity.id}>
                                <TableCell>
                                  {amenity.image_url ? (
                                    <img src={amenity.image_url} alt={amenity.item_name} className="h-12 w-12 rounded-lg object-cover border border-border" />
                                  ) : (
                                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{amenity.item_name}</TableCell>
                                <TableCell>{amenity.description || "-"}</TableCell>
                                <TableCell>{amenity.location_found || "-"}</TableCell>
                                <TableCell>{amenity.found_by || "-"}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setRestoreAmenityId(amenity.id)}>
                                    <RotateCcw className="h-4 w-4" />
                                    Restore
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                No archived amenities.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
        </section>

        {canViewArchiveHistory ? (
          <section>
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold text-foreground">Archived Inquiry Chats</h2>
              <p className="mt-1 text-sm text-muted-foreground">Review archived guest inquiry conversations and their archive details.</p>
            </div>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                {archivedInquiriesQuery.isLoading ? (
                  <div className="flex justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Last Message</TableHead>
                        <TableHead>Archived By</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedInquiries.length ? (
                        archivedInquiries.map((inquiry) => {
                          const archiveLog = inquiryArchiveLogById.get(inquiry.id);

                          return (
                            <TableRow key={inquiry.id}>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{inquiry.guest_name || "Guest"}</p>
                                  <p className="text-xs text-muted-foreground">{inquiry.guest_email || "No email"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{inquiry.subject || "-"}</TableCell>
                              <TableCell className="min-w-[18rem] text-sm text-muted-foreground">{inquiry.last_message_preview || "-"}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{archiveLog?.user_name || "Unknown"}</p>
                                  <p className="text-xs text-muted-foreground">{archiveLog?.user_email || "No archive log"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {formatHistoryDate(inquiry.last_message_at || inquiry.updated_date)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedArchivedInquiryId(inquiry.id)}>
                                  <Eye className="h-4 w-4" />
                                  View Chat
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                            No archived inquiry chats.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {canViewArchiveHistory ? (
          <section>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Archive History</h2>
                <p className="mt-1 text-sm text-muted-foreground">Track archived and restored items with the admin account that performed each action.</p>
              </div>
              <Badge variant="outline" className="w-fit gap-2">
                <History className="h-3.5 w-3.5" />
                Super admin only
              </Badge>
            </div>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                {archiveHistoryQuery.isLoading ? (
                  <div className="flex justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Item Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Admin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archiveHistory.length ? (
                        archiveHistory.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {formatHistoryDate(log.created_date || log.updated_date)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {log.action || "Archive action"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{log.entity_type || "-"}</TableCell>
                            <TableCell className="min-w-[18rem] text-sm text-muted-foreground">{log.details || "-"}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium text-foreground">{log.user_name || "System"}</p>
                                <p className="text-xs text-muted-foreground">{log.user_email || "No email"}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                            No archive history yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
      )}

      <AlertDialog open={!!restorePackageId} onOpenChange={(open) => !open && setRestorePackageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the package back to Manage Packages and make it available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestorePackage}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreQrId} onOpenChange={(open) => !open && setRestoreQrId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore QR Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will make the QR code available again for future reservation payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreQrCode}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreUserId} onOpenChange={(open) => !open && setRestoreUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore User Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reactivate the archived account and allow the user to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreUser}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreAmenityId} onOpenChange={(open) => !open && setRestoreAmenityId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Amenity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the amenity back to the active amenities list and make it available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreAmenity}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreBookingId} onOpenChange={(open) => !open && setRestoreBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Reservation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move the reservation back to Reservation Management and make it active again.
              </AlertDialogDescription>
            </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreBooking}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedArchivedInquiryId} onOpenChange={(open) => !open && setSelectedArchivedInquiryId(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Archived Inquiry Chat</DialogTitle>
          </DialogHeader>
          {archivedInquiryThreadQuery.isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-lg font-semibold text-foreground">{archivedInquiryThreadQuery.data?.inquiry?.subject || "Archived inquiry"}</p>
                <p className="text-sm text-muted-foreground">
                  {archivedInquiryThreadQuery.data?.inquiry?.guest_name || "Guest"} &bull; {archivedInquiryThreadQuery.data?.inquiry?.guest_email || "No email"}
                </p>
              </div>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/10 p-4">
                {(archivedInquiryThreadQuery.data?.messages || []).map((message) => {
                  const isAdminMessage = message.sender_type === "admin";

                  return (
                    <div key={message.id} className={`flex ${isAdminMessage ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          isAdminMessage
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <MessageSquareMore className="h-3.5 w-3.5" />
                          <span>{message.sender_name}</span>
                          <span>{formatHistoryDate(message.created_date)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-6">{message.message}</p>
                      </div>
                    </div>
                  );
                })}

                {!archivedInquiryThreadQuery.data?.messages?.length ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No messages found for this archived inquiry.</div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
