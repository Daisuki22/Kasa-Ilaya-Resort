import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { Archive, CalendarPlus, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

const rebookingBadgeClasses = {
  none: "border-border bg-muted text-muted-foreground",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  declined: "border-destructive/20 bg-destructive/10 text-destructive",
};

const formatStatusLabel = (value) => (value || "none").replace(/_/g, " ");
const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const canAdminReschedule = (booking) => ["pending", "confirmed"].includes(booking?.status || "");
const todayInputValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function AdminReservationManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [archiveId, setArchiveId] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ booking_date: "", note: "" });
  const [rescheduling, setRescheduling] = useState(false);
  const [rebookingBooking, setRebookingBooking] = useState(null);
  const [rebookingNote, setRebookingNote] = useState("");
  const [resolvingRebooking, setResolvingRebooking] = useState("");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => baseClient.entities.Booking.filter({}, "-created_date", 500),
  });

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await baseClient.entities.Booking.update(archiveId, { status: "archived" });
      toast.success("Booking archived.");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-archived"] });
    } catch (error) {
      toast.error(error?.message || "Unable to archive booking.");
    } finally {
      setArchiving(false);
      setArchiveId(null);
    }
  };

  const openRebookingReview = (booking) => {
    setRebookingBooking(booking);
    setRebookingNote("");
  };

  const openRescheduleDialog = (booking) => {
    setRescheduleBooking(booking);
    setRescheduleForm({
      booking_date: booking.booking_date || todayInputValue(),
      note: "",
    });
  };

  const handleRescheduleBooking = async () => {
    if (!rescheduleBooking) {
      return;
    }

    const newDate = rescheduleForm.booking_date;
    const note = rescheduleForm.note.trim();

    if (!newDate) {
      toast.error("Please choose the new booking date.");
      return;
    }

    if (newDate === rescheduleBooking.booking_date) {
      toast.error("Please choose a different date.");
      return;
    }

    setRescheduling(true);

    try {
      await baseClient.entities.Booking.update(rescheduleBooking.id, {
        booking_date: newDate,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email || null,
        user_name: user?.full_name || user?.name || "Admin",
        action: "Rescheduled Booking",
        entity_type: "Booking",
        entity_id: rescheduleBooking.id,
        details: `Rescheduled ${rescheduleBooking.booking_reference} from ${rescheduleBooking.booking_date} to ${newDate}${note ? ` - ${note}` : ""}`,
      });

      toast.success("Booking rescheduled.");
      setRescheduleBooking(null);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to reschedule booking.");
    } finally {
      setRescheduling(false);
    }
  };

  const handleResolveRebooking = async (decision) => {
    if (!rebookingBooking) {
      return;
    }

    setResolvingRebooking(decision);

    try {
      await baseClient.entities.Booking.update(rebookingBooking.id, {
        rebooking_status: decision,
        rebooking_resolution_note: rebookingNote.trim() || (decision === "approved" ? "Approved by resort admin." : "Declined by resort admin."),
      });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email || null,
        user_name: user?.full_name || user?.name || "Admin",
        action: decision === "approved" ? "Approved Rebooking" : "Declined Rebooking",
        entity_type: "Booking",
        entity_id: rebookingBooking.id,
        details: `${decision === "approved" ? "Approved" : "Declined"} rebooking ${rebookingBooking.booking_reference} from ${rebookingBooking.booking_date} to ${rebookingBooking.rebooking_requested_date}`,
      });

      toast.success(decision === "approved" ? "Rebooking approved and booking date updated." : "Rebooking request declined.");
      setRebookingBooking(null);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to update rebooking request.");
    } finally {
      setResolvingRebooking("");
    }
  };

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Reservation Management</h1>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table className="min-w-[1180px] table-fixed">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[136px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[160px]" />
                <col className="w-[300px]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rebooking</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length ? (
                  bookings.map((booking) => {
                    const rebookingStatus = booking.rebooking_status || "none";
                    const hasRebooking = rebookingStatus !== "none";

                    return (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-sm">{booking.booking_reference}</TableCell>
                        <TableCell className="max-w-[136px] overflow-hidden align-top">
                          <div className="w-full min-w-0 py-1">
                            <p className="truncate text-sm font-semibold leading-5 text-foreground">{booking.customer_name || "Guest user"}</p>
                            <p className="truncate text-xs leading-4 text-muted-foreground">{booking.customer_email || "No email"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="truncate">{booking.package_name}</TableCell>
                        <TableCell>{booking.booking_date}</TableCell>
                        <TableCell className="font-semibold text-secondary">{formatMoney(booking.total_amount)}</TableCell>
                        <TableCell className="capitalize">{formatStatusLabel(booking.status)}</TableCell>
                        <TableCell>
                          {hasRebooking ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className={rebookingBadgeClasses[rebookingStatus] || rebookingBadgeClasses.none}>
                                {formatStatusLabel(rebookingStatus)}
                              </Badge>
                              {booking.rebooking_requested_date ? (
                                <p className="text-xs text-muted-foreground">To {booking.rebooking_requested_date}</p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canAdminReschedule(booking) ? (
                              <Button variant="outline" size="sm" className="gap-2" onClick={() => openRescheduleDialog(booking)}>
                                <CalendarPlus className="h-4 w-4" /> Reschedule
                              </Button>
                            ) : null}
                            {rebookingStatus === "pending" ? (
                              <Button variant="outline" size="sm" className="gap-2" onClick={() => openRebookingReview(booking)}>
                                <CalendarPlus className="h-4 w-4" /> Review
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" className="gap-2 text-amber-600" onClick={() => setArchiveId(booking.id)} disabled={booking.status === "archived"}>
                              <Archive className="h-4 w-4" /> Archive
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No reservations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!archiveId} onOpenChange={(open) => !open && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the reservation to the archive. You can restore it later from the Archive page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-amber-600 text-white hover:bg-amber-700" disabled={archiving}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rescheduleBooking}
        onOpenChange={(open) => {
          if (!open && !rescheduling) {
            setRescheduleBooking(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reschedule Booking</DialogTitle>
          </DialogHeader>

          {rescheduleBooking ? (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-lg border bg-muted/30 p-5 text-sm sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold">{rescheduleBooking.booking_reference}</p>
                  <p className="mt-2 break-words text-sm text-muted-foreground">{rescheduleBooking.customer_name || "Guest user"}</p>
                  <p className="mt-1 break-words text-base font-semibold text-foreground">{rescheduleBooking.package_name}</p>
                </div>
                <div className="rounded-md border bg-background px-4 py-3 sm:min-w-40 sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current date</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{rescheduleBooking.booking_date}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="admin-reschedule-date" className="text-sm font-semibold">New booking date</Label>
                <Input
                  id="admin-reschedule-date"
                  type="date"
                  min={todayInputValue()}
                  value={rescheduleForm.booking_date}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, booking_date: event.target.value }))}
                  className="h-12 min-h-12 text-base font-semibold"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="admin-reschedule-note" className="text-sm font-semibold">Admin note</Label>
                <Textarea
                  id="admin-reschedule-note"
                  value={rescheduleForm.note}
                  onChange={(event) => setRescheduleForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Optional reason or note"
                  rows={5}
                  className="min-h-32 resize-y text-base leading-7"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" className="h-11 px-6" onClick={() => setRescheduleBooking(null)} disabled={rescheduling}>
              Cancel
            </Button>
            <Button onClick={handleRescheduleBooking} disabled={rescheduling} className="h-11 gap-2 px-6">
              {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Save New Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rebookingBooking} onOpenChange={(open) => !open && setRebookingBooking(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Rebooking</DialogTitle>
          </DialogHeader>

          {rebookingBooking ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Reference</p>
                  <p className="font-mono font-semibold">{rebookingBooking.booking_reference}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Guest</p>
                  <p className="font-semibold">{rebookingBooking.customer_name || "Guest user"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Current Date</p>
                  <p className="font-semibold">{rebookingBooking.booking_date}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Requested Date</p>
                  <p className="font-semibold">{rebookingBooking.rebooking_requested_date}</p>
                </div>
              </div>

              <div>
                <Label>Guest reason</Label>
                <p className="mt-2 rounded-lg bg-muted p-3 text-sm leading-6">
                  {rebookingBooking.rebooking_reason || "No reason provided."}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                Policy: one approved rebooking per reservation, requested at least 7 days before the reservation date. Payment stays non-refundable and transfers to the approved new date.
              </div>

              <div>
                <Label htmlFor="rebooking-resolution-note">Decision note</Label>
                <Textarea
                  id="rebooking-resolution-note"
                  value={rebookingNote}
                  onChange={(event) => setRebookingNote(event.target.value)}
                  placeholder="Optional note for the guest"
                  rows={3}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setRebookingBooking(null)} disabled={!!resolvingRebooking}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="destructive" className="gap-2" onClick={() => handleResolveRebooking("declined")} disabled={!!resolvingRebooking}>
                {resolvingRebooking === "declined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Decline
              </Button>
              <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleResolveRebooking("approved")} disabled={!!resolvingRebooking}>
                {resolvingRebooking === "approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
