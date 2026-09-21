import React, { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { baseClient } from "@/api/baseClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, CheckCheck, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SCHEDULE_COLOR = "#2563eb";
const BOOKING_COLORS = {
  pending: "#f59e0b",
  confirmed: "#16a34a",
  completed: "#64748b",
  cancelled: "#ef4444",
};
const asArray = (value) => (Array.isArray(value) ? value : []);

const statusBadgeClasses = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
};

const tourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};

const createEmptyForm = (date) => ({
  title: "",
  schedule_date: format(date || new Date(), "yyyy-MM-dd"),
  start_time: "",
  end_time: "",
  location: "",
  description: "",
});

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

const formatDate = (value, pattern = "MMM d, yyyy") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, pattern);
};

function BookingField({ label, children }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 break-words text-sm font-medium text-foreground">{children || "-"}</div>
    </div>
  );
}

export default function FullCalendarView({ embedded = false }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const canManage = user?.role === "admin" || user?.role === "super_admin";
  const shellClass = embedded ? "space-y-5" : "w-full max-w-none px-2 py-6 sm:px-3 lg:px-4";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [form, setForm] = useState(createEmptyForm(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const updateBookingStatus = async (bookingId, newStatus) => {
    if (newStatus === "cancelled") {
      toast.error("Owner and staff cannot cancel bookings. Only guests can cancel their own pending bookings before they are marked paid or approved.");
      return;
    }

    const booking = viewingBooking;
    const nextPaymentStatus =
      newStatus === "confirmed" || newStatus === "completed" ? "paid" : booking?.payment_status || "unpaid";

    try {
      await baseClient.entities.Booking.update(bookingId, { status: newStatus, payment_status: nextPaymentStatus });
      await queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success(`Booking marked as ${newStatus}.`);
      setViewingBooking(null);
      setDialogOpen(false);
    } catch (err) {
      toast.error(err?.message || "Unable to update booking.");
    }
  };

  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["upcoming-schedules"],
    queryFn: () => baseClient.entities.UpcomingSchedule.list("schedule_date", 500),
  });

  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ["calendar-bookings"],
    queryFn: () =>
      baseClient.entities.Booking.filter(
        { status: ["pending", "confirmed", "completed"] },
        "booking_date",
        500
      ),
  });

  const isLoading = isLoadingSchedules || isLoadingBookings;

  const calendarEvents = [
    ...asArray(schedules).map((schedule) => ({
      id: `schedule-${schedule.id}`,
      title: schedule.title,
      start: schedule.start_time
        ? `${schedule.schedule_date}T${schedule.start_time}`
        : schedule.schedule_date,
      end: schedule.end_time ? `${schedule.schedule_date}T${schedule.end_time}` : undefined,
      allDay: !schedule.start_time,
      backgroundColor: SCHEDULE_COLOR,
      borderColor: SCHEDULE_COLOR,
      extendedProps: { type: "schedule", raw: schedule },
    })),
    ...asArray(bookings).flatMap((booking) => {
      const color = BOOKING_COLORS[booking.status] || BOOKING_COLORS.pending;
      const base = {
        id: `booking-${booking.id}`,
        title: booking.package_name || "Booking",
        backgroundColor: color,
        borderColor: color,
        extendedProps: { type: "booking", raw: booking },
      };

      if (booking.tour_type === "22_hours") {
        return [{
          ...base,
          start: booking.booking_date,
          end: format(addDays(new Date(`${booking.booking_date}T00:00:00`), 2), "yyyy-MM-dd"),
          allDay: true,
        }];
      }

      return [{ ...base, start: booking.booking_date, allDay: true }];
    }),
  ];

  const openScheduleDialog = (date = new Date()) => {
    setEditingSchedule(null);
    setViewingBooking(null);
    setForm(createEmptyForm(date));
    setDialogOpen(true);
  };

  const handleDateClick = (info) => {
    if (!canManage) return;
    const clickedDate = new Date(info.dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (clickedDate < today) {
      toast.error("You cannot add a schedule on a past date.");
      return;
    }

    openScheduleDialog(clickedDate);
  };

  const handleEventClick = (info) => {
    const { type, raw } = info.event.extendedProps;

    if (type === "booking") {
      setViewingBooking(raw);
      setEditingSchedule(null);
      setDialogOpen(true);
      return;
    }

    if (!canManage) return;

    setViewingBooking(null);
    setEditingSchedule(raw);
    setForm({
      title: raw.title || "",
      schedule_date: raw.schedule_date,
      start_time: raw.start_time || "",
      end_time: raw.end_time || "",
      location: raw.location || "",
      description: raw.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!canManage) return;

    if (!form.title.trim() || !form.schedule_date) {
      toast.error("Title and date are required.");
      return;
    }

    const selectedDate = new Date(form.schedule_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast.error("You cannot add a schedule on a past date.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        schedule_date: form.schedule_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        created_by_name: user?.full_name || null,
        created_by_email: user?.email || null,
      };

      if (editingSchedule) {
        await baseClient.entities.UpcomingSchedule.update(editingSchedule.id, payload);
        await baseClient.entities.ActivityLog.create({
          user_email: user?.email,
          user_name: user?.full_name,
          action: "Updated Upcoming Schedule",
          entity_type: "UpcomingSchedule",
          entity_id: editingSchedule.id,
          details: `Updated schedule "${payload.title}" for ${payload.schedule_date}`,
        });
        toast.success("Schedule updated.");
      } else {
        const created = await baseClient.entities.UpcomingSchedule.create(payload);
        await baseClient.entities.ActivityLog.create({
          user_email: user?.email,
          user_name: user?.full_name,
          action: "Created Upcoming Schedule",
          entity_type: "UpcomingSchedule",
          entity_id: created.id,
          details: `Created schedule "${payload.title}" for ${payload.schedule_date}`,
        });
        toast.success("Schedule added.");
      }

      await queryClient.invalidateQueries({ queryKey: ["upcoming-schedules"] });
      await queryClient.invalidateQueries({ queryKey: ["booking-manual-schedules"] });
      setDialogOpen(false);
    } catch (err) {
      toast.error(err?.message || "Unable to save schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManage || !editingSchedule) return;
    if (!window.confirm(`Delete "${editingSchedule.title}"?`)) return;

    setDeletingId(editingSchedule.id);
    try {
      await baseClient.entities.UpcomingSchedule.delete(editingSchedule.id);
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Deleted Upcoming Schedule",
        entity_type: "UpcomingSchedule",
        entity_id: editingSchedule.id,
        details: `Deleted schedule "${editingSchedule.title}"`,
      });
      await queryClient.invalidateQueries({ queryKey: ["upcoming-schedules"] });
      await queryClient.invalidateQueries({ queryKey: ["booking-manual-schedules"] });
      toast.success("Schedule deleted.");
      setDialogOpen(false);
    } catch (err) {
      toast.error(err?.message || "Unable to delete schedule.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={shellClass}>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Reservation Calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">See guest reservations and manual resort schedules in one calendar.</p>
          </div>
          {canManage && (
            <Button className="gap-2 self-start sm:self-auto" onClick={() => openScheduleDialog()}>
              <Plus className="h-4 w-4" />
              Add Schedule
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-4 border-b border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: SCHEDULE_COLOR }} />
            Manual Schedule
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: BOOKING_COLORS.pending }} />
            Pending Booking
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: BOOKING_COLORS.confirmed }} />
            Confirmed Booking
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: BOOKING_COLORS.completed }} />
            Completed Booking
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="fc-wrapper overflow-hidden rounded-lg border border-border bg-background p-3 sm:p-4">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                buttonText={{
                  today: "today",
                  month: "month",
                  week: "week",
                  day: "day",
                }}
                events={calendarEvents}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                editable={false}
                selectable={canManage}
                dayMaxEvents={3}
                height="auto"
                eventDisplay="block"
                dayCellContent={function(arg) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const cellDate = new Date(arg.date);
                  cellDate.setHours(0, 0, 0, 0);

                  if (cellDate < today) {
                    return (
                      <div style={{ position: "relative", width: "100%", height: "100%" }}>
                        <span style={{ color: "#ef4444", fontWeight: "bold", position: "absolute", top: 2, right: 4, fontSize: "1.2em", pointerEvents: "none" }}>x</span>
                        <span>{arg.dayNumberText}</span>
                      </div>
                    );
                  }

                  return arg.dayNumberText;
                }}
              />
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen && !viewingBooking}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setViewingBooking(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingSchedule ? "Edit Schedule" : "New Schedule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="fc-title">Title</Label>
              <Input
                id="fc-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Event title"
              />
            </div>
            <div>
              <Label htmlFor="fc-date">Date</Label>
              <Input
                id="fc-date"
                type="date"
                value={form.schedule_date}
                onChange={(event) => setForm((current) => ({ ...current, schedule_date: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fc-start">Start Time</Label>
                <Input
                  id="fc-start"
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="fc-end">End Time</Label>
                <Input
                  id="fc-end"
                  type="time"
                  value={form.end_time}
                  onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="fc-location">Location</Label>
              <Input
                id="fc-location"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="fc-desc">Description</Label>
              <Textarea
                id="fc-desc"
                rows={3}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingSchedule && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto gap-2"
                onClick={handleDelete}
                disabled={!!deletingId}
              >
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingSchedule ? "Save Changes" : "Add Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen && !!viewingBooking}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setViewingBooking(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Calendar Reservation</DialogTitle>
          </DialogHeader>
          {viewingBooking && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary">{viewingBooking.booking_reference || "-"}</p>
                    <h3 className="mt-1 text-lg font-bold text-foreground">{viewingBooking.package_name || "Selected package"}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(viewingBooking.booking_date)}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusBadgeClasses[viewingBooking.status] || statusBadgeClasses.pending}>
                    {(viewingBooking.status || "pending").replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <BookingField label="Tour Type">{tourLabels[viewingBooking.tour_type] || viewingBooking.tour_type}</BookingField>
                <BookingField label="Customer">{viewingBooking.customer_name || "Guest"}</BookingField>
                <BookingField label="Guests">{viewingBooking.guest_count || 0}</BookingField>
                <BookingField label="Total">{formatMoney(viewingBooking.total_amount)}</BookingField>
                <BookingField label="Email">
                  <span className="break-all">{viewingBooking.customer_email || "-"}</span>
                </BookingField>
                <BookingField label="Phone">{viewingBooking.customer_phone || "-"}</BookingField>
              </div>

              {viewingBooking.status === "pending" && canManage && (
                <div className="space-y-3 border-t border-border pt-3">
                  <Button size="sm" className="w-full gap-2" onClick={() => updateBookingStatus(viewingBooking.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Reservation
                  </Button>
                  <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Owner and staff cannot cancel bookings. Guests may only cancel their own pending bookings before they are marked paid or approved.
                  </p>
                </div>
              )}
              {viewingBooking.status === "confirmed" && canManage && (
                <div className="border-t border-border pt-3">
                  <Button size="sm" className="w-full gap-2" onClick={() => updateBookingStatus(viewingBooking.id, "completed")}>
                    <CheckCheck className="h-4 w-4" />
                    Mark as Completed
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setViewingBooking(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
