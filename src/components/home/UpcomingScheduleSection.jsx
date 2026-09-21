import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isBefore, isSameDay, startOfDay } from "date-fns";
import { baseClient } from "@/api/baseClient";
import { useAuth } from "@/lib/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarCheck, Clock3, Loader2, MapPin, PencilLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const createEmptyForm = (date) => ({
  title: "",
  schedule_date: format(date, "yyyy-MM-dd"),
  start_time: "",
  end_time: "",
  location: "",
  description: "",
});

const formatTimeRange = (schedule) => {
  if (schedule.start_time && schedule.end_time) {
    return `${schedule.start_time} - ${schedule.end_time}`;
  }

  if (schedule.start_time) {
    return `Starts at ${schedule.start_time}`;
  }

  return "Time to be announced";
};

const bookingStatusColors = {
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-muted text-muted-foreground border-border",
};

const bookingTourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};
const asArray = (value) => (Array.isArray(value) ? value : []);

const getBookingDateSpan = (booking) => {
  const start = new Date(`${booking.booking_date}T00:00:00`);
  if (booking.tour_type === "22_hours") {
    return [start, addDays(start, 1)];
  }
  return [start];
};

export default function UpcomingScheduleSection({ allowAdminActions = false }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManageSchedules = Boolean(isAdmin && allowAdminActions);
  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [form, setForm] = useState(createEmptyForm(today));
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["upcoming-schedules"],
    queryFn: () => baseClient.entities.UpcomingSchedule.list("schedule_date", 200),
    refetchInterval: 30000,
  });

  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ["calendar-bookings"],
    queryFn: () => baseClient.entities.Booking.filter({ status: ["pending", "confirmed", "completed"] }, "booking_date", 500),
  });

  const upcomingSchedules = asArray(schedules).filter((schedule) => {
    const date = new Date(`${schedule.schedule_date}T00:00:00`);
    return !isBefore(startOfDay(date), today);
  });

  const upcomingBookings = asArray(bookings).filter((booking) => {
    const span = getBookingDateSpan(booking);
    const lastDate = span[span.length - 1];
    return !isBefore(startOfDay(lastDate), today);
  });

  const selectedDateSchedules = upcomingSchedules.filter((schedule) =>
    isSameDay(new Date(`${schedule.schedule_date}T00:00:00`), selectedDate)
  );

  const selectedDateBookings = upcomingBookings.filter((booking) =>
    getBookingDateSpan(booking).some((date) => isSameDay(date, selectedDate))
  );

  const featuredUpcomingSchedules = [
    ...upcomingSchedules.map((schedule) => ({
      id: `schedule-${schedule.id}`,
      type: "schedule",
      title: schedule.title,
      date: schedule.schedule_date,
      timeLabel: schedule.start_time || "All day",
    })),
    ...upcomingBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: "booking",
      title: booking.package_name,
      date: booking.booking_date,
      timeLabel: bookingTourLabels[booking.tour_type] || "Reserved",
    })),
  ]
    .sort((left, right) => new Date(`${left.date}T00:00:00`) - new Date(`${right.date}T00:00:00`))
    .slice(0, 5);

  const scheduledDates = upcomingSchedules.map((schedule) => new Date(`${schedule.schedule_date}T00:00:00`));
  const bookingDates = upcomingBookings.flatMap((booking) => getBookingDateSpan(booking));

  const openCreateDialog = () => {
    if (!canManageSchedules) {
      return;
    }
    setEditingSchedule(null);
    setForm(createEmptyForm(selectedDate));
    setDialogOpen(true);
  };

  const openEditDialog = (schedule) => {
    if (!canManageSchedules) {
      return;
    }
    setEditingSchedule(schedule);
    setForm({
      title: schedule.title || "",
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
      location: schedule.location || "",
      description: schedule.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!canManageSchedules) {
      return;
    }

    if (!form.title.trim() || !form.schedule_date) {
      toast.error("Schedule title and date are required.");
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
          details: `Updated schedule ${payload.title} for ${payload.schedule_date}`,
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
          details: `Created schedule ${payload.title} for ${payload.schedule_date}`,
        });
        toast.success("Schedule added.");
      }

      await queryClient.invalidateQueries({ queryKey: ["upcoming-schedules"] });
      setSelectedDate(new Date(`${form.schedule_date}T00:00:00`));
      setDialogOpen(false);
    } catch (error) {
      toast.error(error?.message || "Unable to save the schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (schedule) => {
    if (!canManageSchedules) {
      return;
    }

    const confirmed = window.confirm(`Delete the schedule "${schedule.title}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(schedule.id);

    try {
      await baseClient.entities.UpcomingSchedule.delete(schedule.id);
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Deleted Upcoming Schedule",
        entity_type: "UpcomingSchedule",
        entity_id: schedule.id,
        details: `Deleted schedule ${schedule.title} on ${schedule.schedule_date}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["upcoming-schedules"] });
      toast.success("Schedule deleted.");
    } catch (error) {
      toast.error(error?.message || "Unable to delete the schedule.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="bg-gradient-to-b from-background via-muted/20 to-background py-24 sm:py-28 lg:py-32">
      <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/20 bg-primary/5 text-primary">
              {canManageSchedules ? "Reservation" : "Resort Calendar"}
            </Badge>
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              {canManageSchedules ? "Reservation" : "Upcoming Schedule"}
            </h2>
            <p className="mt-3 max-w-3xl text-muted-foreground leading-8">
              Browse reserved dates and upcoming events at Kasa Ilaya.
            </p>
          </div>
          {canManageSchedules && (
            <Button className="gap-2 self-start sm:self-auto" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Add Schedule
            </Button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-10">
          <Card className="overflow-hidden border-primary/10 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-card/80">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Calendar View
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  disabled={{ before: today }}
                  onSelect={(date) => {
                    if (!date || isBefore(startOfDay(date), today)) {
                      return;
                    }

                    setSelectedDate(date);
                  }}
                  modifiers={{ scheduled: scheduledDates, booked: bookingDates }}
                  modifiersClassNames={{
                    scheduled: "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30",
                    booked: "bg-secondary/20 text-secondary-foreground font-semibold ring-1 ring-secondary/40",
                  }}
                  className="rounded-lg border bg-background p-4 sm:p-5"
                  classNames={{
                    months: "flex flex-col gap-6",
                    month: "space-y-5",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-base sm:text-lg font-semibold",
                    head_cell: "text-muted-foreground rounded-md w-12 sm:w-14 font-normal text-sm",
                    cell: "h-12 w-12 sm:h-14 sm:w-14 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-12 w-12 sm:h-14 sm:w-14 p-0 text-sm sm:text-base font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md",
                    day_disabled: "text-muted-foreground opacity-35 pointer-events-none hover:bg-transparent hover:text-muted-foreground",
                  }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary/15 ring-1 ring-primary/30" />
                  <span>Manual schedules</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-secondary/20 ring-1 ring-secondary/40" />
                  <span>Booking schedules</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-xl">
                  {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading || isLoadingBookings ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : selectedDateSchedules.length === 0 && selectedDateBookings.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No scheduled event for this date yet.
                  </div>
                ) : (
                  <>
                    {selectedDateSchedules.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                          Manual Schedules
                        </div>
                        {selectedDateSchedules.map((schedule) => (
                          <div key={schedule.id} className="rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-foreground">{schedule.title}</h3>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                  <p className="flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-primary" />
                                    {formatTimeRange(schedule)}
                                  </p>
                                  {schedule.location && (
                                    <p className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-primary" />
                                      {schedule.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {canManageSchedules && (
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="icon" onClick={() => openEditDialog(schedule)}>
                                    <PencilLine className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(schedule)}
                                    disabled={deletingId === schedule.id}
                                  >
                                    {deletingId === schedule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </div>
                              )}
                            </div>
                            {schedule.description && (
                              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{schedule.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDateBookings.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                          <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
                          Booking Schedules
                        </div>
                        {selectedDateBookings.map((booking) => (
                          <div key={booking.id} className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-foreground">{booking.package_name}</h3>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                  <p className="flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-secondary" />
                                    {bookingTourLabels[booking.tour_type] || "Reserved booking"}
                                  </p>
                                  {booking.tour_type === "22_hours" && (
                                    <p className="text-xs text-muted-foreground">
                                      22-hour stay spans check-in and checkout day
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Reservation status: {booking.status}
                                  </p>
                                </div>
                              </div>
                              <Badge className={bookingStatusColors[booking.status] || bookingStatusColors.pending} variant="outline">
                                {booking.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-xl">Next Scheduled Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading || isLoadingBookings ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : featuredUpcomingSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming schedules available.</p>
                ) : (
                  featuredUpcomingSchedules.map((schedule) => (
                    <button
                      key={schedule.id}
                      type="button"
                      className="flex w-full items-start justify-between rounded-lg border border-border px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                      onClick={() => setSelectedDate(new Date(`${schedule.date}T00:00:00`))}
                    >
                      <div>
                        <p className="font-medium text-foreground">{schedule.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{format(new Date(`${schedule.date}T00:00:00`), "EEEE, MMM d")}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={schedule.type === "booking" ? "border-secondary/20 bg-secondary/5 text-secondary-foreground" : "border-primary/20 bg-primary/5 text-primary"}
                      >
                        {schedule.timeLabel}
                      </Badge>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingSchedule ? "Edit Schedule" : "Add Schedule"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="schedule-title">Title</Label>
                <Input
                  id="schedule-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Pool maintenance, private event, family day..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="schedule-date">Date</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={form.schedule_date}
                    onChange={(event) => setForm({ ...form, schedule_date: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-location">Location</Label>
                  <Input
                    id="schedule-location"
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder="Main pool, pavilion, cottage area"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="schedule-start">Start Time</Label>
                  <Input
                    id="schedule-start"
                    type="time"
                    value={form.start_time}
                    onChange={(event) => setForm({ ...form, start_time: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-end">End Time</Label>
                  <Input
                    id="schedule-end"
                    type="time"
                    value={form.end_time}
                    onChange={(event) => setForm({ ...form, end_time: event.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="schedule-description">Description</Label>
                <Textarea
                  id="schedule-description"
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Add notes for this schedule entry."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
                  {isSaving ? "Saving..." : editingSchedule ? "Save Changes" : "Add Schedule"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
