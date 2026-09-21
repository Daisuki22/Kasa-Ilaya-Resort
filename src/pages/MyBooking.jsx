import React, { useEffect, useMemo, useState } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Hash,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import LeaveReviewDialog from "@/components/mybookings/LeaveReviewDialog.jsx";
import { addDays, format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusColors = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-primary/20 bg-primary/10 text-primary",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  completed: "border-border bg-muted text-muted-foreground",
  archived: "border-border bg-muted text-muted-foreground",
};

const paymentColors = {
  unpaid: "bg-destructive/10 text-destructive",
  pending_verification: "bg-amber-100 text-amber-800",
  paid: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

const getDisplayPaymentStatus = (booking) => {
  if (booking?.status === "cancelled" || booking?.status === "archived") {
    return booking.status;
  }

  return booking?.payment_status || "unpaid";
};

const formatStatusLabel = (value) => (value || "unpaid").replace(/_/g, " ");

const tourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};

const paymentTypeLabels = {
  downpayment: "Downpayment",
  full_payment: "Full Payment",
};

const statusFilters = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const REBOOKING_NOTICE_DAYS = 7;

const formatDate = (value) => {
  if (!value) {
    return "No date";
  }

  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
};

const getBookingEndTime = (booking) => {
  if (!booking?.booking_date || !booking?.tour_type) {
    return null;
  }

  if (booking.tour_type === "day_tour") {
    return new Date(`${booking.booking_date}T18:00:00`);
  }

  if (booking.tour_type === "night_tour") {
    return new Date(new Date(`${booking.booking_date}T18:00:00`).getTime() + 12 * 60 * 60 * 1000);
  }

  if (booking.tour_type === "22_hours") {
    return new Date(new Date(`${booking.booking_date}T18:00:00`).getTime() + 22 * 60 * 60 * 1000);
  }

  return null;
};

const getBookingStartTime = (booking) => {
  if (!booking?.booking_date || !booking?.tour_type) {
    return null;
  }

  if (booking.tour_type === "day_tour") {
    return new Date(`${booking.booking_date}T08:00:00`);
  }

  return new Date(`${booking.booking_date}T18:00:00`);
};

const canLeaveReview = (booking) => {
  if (!booking || booking.status === "cancelled" || booking.status === "pending") {
    return false;
  }

  const endTime = getBookingEndTime(booking);
  if (!endTime) {
    return false;
  }

  return Date.now() >= endTime.getTime();
};

const getDismissedReviewStorageKey = (email) => `kasa-ilaya-dismissed-reviews:${email || "guest"}`;

const canCancelBooking = (booking) => {
  if (!booking || booking.status !== "pending") {
    return false;
  }

  return (booking.payment_status || "unpaid") !== "paid";
};

const getCancellationLockedReason = (booking) => {
  if (!booking || booking.status === "cancelled" || booking.status === "completed") {
    return "";
  }

  const paymentStatus = booking.payment_status || "unpaid";

  if (paymentStatus === "paid") {
    return "Paid bookings can no longer be cancelled online because the reservation has already been paid.";
  }

  if (booking.status === "confirmed") {
    return "Accepted bookings can no longer be cancelled online because the reservation has already been approved by the resort.";
  }

  return "";
};

const getRebookingLockedReason = (booking) => {
  if (!booking) {
    return "Select a booking first.";
  }

  if (!["pending", "confirmed"].includes(booking.status)) {
    return "Only pending or confirmed bookings can request rebooking.";
  }

  if ((booking.rebooking_status || "none") === "pending") {
    return "This booking already has a pending rebooking request.";
  }

  if (Number(booking.rebooking_count || 0) >= 1) {
    return "This booking has already used its one allowed rebooking.";
  }

  const startTime = getBookingStartTime(booking);
  if (!startTime) {
    return "This booking date cannot be checked for rebooking.";
  }

  const cutoff = new Date(startTime.getTime() - REBOOKING_NOTICE_DAYS * 24 * 60 * 60 * 1000);
  if (Date.now() > cutoff.getTime()) {
    return "Rebooking requests must be submitted at least 7 days before the reservation date.";
  }

  return "";
};

const canRequestRebooking = (booking) => getRebookingLockedReason(booking) === "";

const dateInputValue = (date) => format(date, "yyyy-MM-dd");
const createDateFromKey = (value) => (value ? new Date(`${value}T00:00:00`) : undefined);

export default function MyBookings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [bookingToRebook, setBookingToRebook] = useState(null);
  const [rebookingForm, setRebookingForm] = useState({ requested_date: "", reason: "" });
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [isRequestingRebooking, setIsRequestingRebooking] = useState(false);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [dismissedReviewBookingIds, setDismissedReviewBookingIds] = useState([]);
  const [submittedReviewBookingIds, setSubmittedReviewBookingIds] = useState([]);
  const [hasLoadedDismissedReviewState, setHasLoadedDismissedReviewState] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {
      baseClient.auth.redirectToLogin(window.location.href);
    });
  }, []);

  useEffect(() => {
    if (!user?.email || typeof window === "undefined") {
      setDismissedReviewBookingIds([]);
      setHasLoadedDismissedReviewState(false);
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(getDismissedReviewStorageKey(user.email));
      const parsed = stored ? JSON.parse(stored) : [];
      setDismissedReviewBookingIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDismissedReviewBookingIds([]);
    } finally {
      setHasLoadedDismissedReviewState(true);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      getDismissedReviewStorageKey(user.email),
      JSON.stringify(dismissedReviewBookingIds)
    );
  }, [dismissedReviewBookingIds, user?.email]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings", user?.email],
    queryFn: () => baseClient.entities.Booking.filter({ customer_email: user.email }, "-created_date"),
    enabled: !!user?.email,
  });

  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ["my-booking-reviews", user?.email],
    queryFn: () => baseClient.entities.Review.filter({ guest_email: user.email }, "-created_date"),
    enabled: !!user?.email,
  });

  const { data: rebookingAvailabilityBookings = [], isLoading: isLoadingRebookingAvailability } = useQuery({
    queryKey: ["rebooking-availability"],
    queryFn: () => baseClient.entities.Booking.filter({ status: ["pending", "confirmed", "completed"] }),
    enabled: !!bookingToRebook,
    refetchInterval: 15000,
  });

  const { data: rebookingManualSchedules = [], isLoading: isLoadingRebookingSchedules } = useQuery({
    queryKey: ["rebooking-manual-schedules"],
    queryFn: () => baseClient.entities.UpcomingSchedule.list("schedule_date", 500),
    enabled: !!bookingToRebook,
    refetchInterval: 30000,
  });

  const reviewedBookingIds = new Set(reviews.map((review) => review.booking_id));
  const blockedReviewBookingIds = new Set([...submittedReviewBookingIds, ...reviews.map((review) => review.booking_id)]);

  const eligibleReviewBookings = useMemo(
    () => bookings.filter(
      (booking) =>
        canLeaveReview(booking) &&
        !blockedReviewBookingIds.has(booking.id) &&
        !dismissedReviewBookingIds.includes(booking.id)
    ),
    [bookings, blockedReviewBookingIds, dismissedReviewBookingIds]
  );

  const filteredBookings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesSearch = !query || [
        booking.booking_reference,
        booking.package_name,
        booking.tour_type,
        booking.payment_status,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [bookings, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const upcoming = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status)).length;
    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const paid = bookings.filter((booking) => booking.payment_status === "paid").length;
    const totalSpend = bookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);

    return {
      total: bookings.length,
      upcoming,
      completed,
      paid,
      totalSpend,
    };
  }, [bookings]);

  const rebookingManualScheduleDates = useMemo(
    () => new Set(rebookingManualSchedules.map((schedule) => schedule.schedule_date).filter(Boolean)),
    [rebookingManualSchedules]
  );

  const rebookingReservedDates = useMemo(() => {
    if (!bookingToRebook) {
      return [];
    }

    return rebookingAvailabilityBookings
      .filter((booking) =>
        booking.id !== bookingToRebook.id &&
        booking.package_id === bookingToRebook.package_id &&
        booking.tour_type === bookingToRebook.tour_type &&
        booking.booking_date
      )
      .map((booking) => createDateFromKey(booking.booking_date))
      .filter(Boolean);
  }, [bookingToRebook, rebookingAvailabilityBookings]);

  const rebookingManualDates = useMemo(
    () => [...rebookingManualScheduleDates].map(createDateFromKey).filter(Boolean),
    [rebookingManualScheduleDates]
  );

  const selectedRebookingDate = createDateFromKey(rebookingForm.requested_date);
  const isCheckingRebookingDate = isLoadingRebookingAvailability || isLoadingRebookingSchedules;

  const getRebookingDateIssue = (date, booking = bookingToRebook) => {
    if (!date || !booking) {
      return "";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliestRebookingDate = addDays(today, 1);

    const dateKey = dateInputValue(date);

    if (date < earliestRebookingDate) {
      return "Please choose a future date for rebooking.";
    }

    if (dateKey === booking.booking_date) {
      return "This is your current reservation date. Please choose a different date.";
    }

    if (rebookingManualScheduleDates.has(dateKey)) {
      return "This date is blocked by a resort schedule or event.";
    }

    const reservedBooking = rebookingAvailabilityBookings.find((entry) =>
      entry.id !== booking.id &&
      entry.package_id === booking.package_id &&
      entry.tour_type === booking.tour_type &&
      entry.booking_date === dateKey &&
      ["pending", "confirmed", "completed"].includes(entry.status)
    );

    if (reservedBooking) {
      return `This date is already reserved for ${booking.package_name} (${tourLabels[booking.tour_type] || booking.tour_type}).`;
    }

    return "";
  };

  const isRebookingDateDisabled = (date) => Boolean(getRebookingDateIssue(date));

  const rebookingDateStatus = useMemo(() => {
    if (!bookingToRebook || !rebookingForm.requested_date) {
      return {
        tone: "muted",
        message: "Select a preferred date to check if the schedule is available.",
      };
    }

    if (isCheckingRebookingDate) {
      return {
        tone: "checking",
        message: "Checking schedule availability...",
      };
    }

    const issue = getRebookingDateIssue(selectedRebookingDate, bookingToRebook);

    if (issue) {
      return {
        tone: "blocked",
        message: issue,
      };
    }

    return {
      tone: "available",
      message: "Available for rebooking. This date can be submitted for admin approval.",
    };
  }, [bookingToRebook, isCheckingRebookingDate, rebookingForm.requested_date, selectedRebookingDate, rebookingAvailabilityBookings, rebookingManualScheduleDates]);

  useEffect(() => {
    if (isLoadingReviews || !hasLoadedDismissedReviewState || !eligibleReviewBookings.length || reviewBooking) {
      return;
    }

    setReviewBooking(eligibleReviewBookings[0]);
  }, [eligibleReviewBookings, hasLoadedDismissedReviewState, isLoadingReviews, reviewBooking]);

  useEffect(() => {
    if (!reviewBooking?.id || isLoadingReviews) {
      return;
    }

    if (blockedReviewBookingIds.has(reviewBooking.id)) {
      setReviewBooking(null);
    }
  }, [blockedReviewBookingIds, isLoadingReviews, reviewBooking]);

  const handleReviewDismiss = () => {
    if (reviewBooking?.id) {
      setDismissedReviewBookingIds((prev) => (
        prev.includes(reviewBooking.id) ? prev : [...prev, reviewBooking.id]
      ));
    }

    setReviewBooking(null);
  };

  const handleReviewOpen = (booking) => {
    setDismissedReviewBookingIds((prev) => prev.filter((id) => id !== booking.id));
    setReviewBooking(booking);
  };

  const handleReviewSubmitted = () => {
    if (!reviewBooking?.id) {
      setReviewBooking(null);
      return;
    }

    const submittedBookingId = reviewBooking.id;

    setDismissedReviewBookingIds((prev) => prev.filter((id) => id !== submittedBookingId));
    setSubmittedReviewBookingIds((prev) => (
      prev.includes(submittedBookingId) ? prev : [...prev, submittedBookingId]
    ));

    queryClient.setQueryData(["my-booking-reviews", user?.email], (currentReviews = []) => {
      if (currentReviews.some((review) => review.booking_id === submittedBookingId)) {
        return currentReviews;
      }

      return [
        {
          id: `submitted-${submittedBookingId}`,
          booking_id: submittedBookingId,
          guest_email: user?.email,
        },
        ...currentReviews,
      ];
    });

    setReviewBooking(null);
    queryClient.invalidateQueries({ queryKey: ["my-booking-reviews"] });
    queryClient.invalidateQueries({ queryKey: ["public-reviews"] });
  };

  const requestCancelBooking = (booking) => {
    if (!canCancelBooking(booking)) {
      toast.error(getCancellationLockedReason(booking) || "This booking can no longer be cancelled.");
      return;
    }

    setBookingToCancel(booking);
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) {
      return;
    }

    if (!canCancelBooking(bookingToCancel)) {
      toast.error(getCancellationLockedReason(bookingToCancel) || "This booking can no longer be cancelled.");
      setBookingToCancel(null);
      return;
    }

    setIsCancellingBooking(true);

    try {
      await baseClient.entities.Booking.update(bookingToCancel.id, { status: "cancelled", payment_status: "unpaid" });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "User Cancelled Booking",
        entity_type: "Booking",
        entity_id: bookingToCancel.id,
        details: `User cancelled booking ${bookingToCancel.booking_reference}`,
      });

      toast.success("Booking cancelled successfully.");
      setBookingToCancel(null);
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to cancel booking.");
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const requestRebooking = (booking) => {
    const lockedReason = getRebookingLockedReason(booking);
    if (lockedReason) {
      toast.error(lockedReason);
      return;
    }

    setBookingToRebook(booking);
    setRebookingForm({ requested_date: "", reason: "" });
  };

  const handleRebookingRequest = async () => {
    if (!bookingToRebook) {
      return;
    }

    const lockedReason = getRebookingLockedReason(bookingToRebook);
    if (lockedReason) {
      toast.error(lockedReason);
      setBookingToRebook(null);
      return;
    }

    const requestedDate = rebookingForm.requested_date;
    const reason = rebookingForm.reason.trim();

    if (!requestedDate) {
      toast.error("Please choose your preferred new date.");
      return;
    }

    if (requestedDate === bookingToRebook.booking_date) {
      toast.error("Please choose a different date from your current booking.");
      return;
    }

    if (isCheckingRebookingDate) {
      toast.error("Please wait while the schedule availability is checked.");
      return;
    }

    const dateIssue = getRebookingDateIssue(createDateFromKey(requestedDate), bookingToRebook);
    if (dateIssue) {
      toast.error(dateIssue);
      return;
    }

    if (reason.length < 10) {
      toast.error("Please include a short reason for the rebooking request.");
      return;
    }

    setIsRequestingRebooking(true);

    try {
      await baseClient.entities.Booking.update(bookingToRebook.id, {
        rebooking_status: "pending",
        rebooking_requested_date: requestedDate,
        rebooking_reason: reason,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "User Requested Rebooking",
        entity_type: "Booking",
        entity_id: bookingToRebook.id,
        details: `User requested rebooking ${bookingToRebook.booking_reference} from ${bookingToRebook.booking_date} to ${requestedDate}`,
      });

      toast.success("Rebooking request submitted for admin approval.");
      setBookingToRebook(null);
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
    } catch (error) {
      toast.error(error?.message || "Unable to submit rebooking request.");
    } finally {
      setIsRequestingRebooking(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <section className="border-b border-border bg-card">
        <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Guest reservations
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">My Bookings</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Track reservation status, payment progress, rebooking requests, cancellation options, and post-stay reviews from one place.
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to={createPageUrl("Packages")}>
                Browse Packages
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total bookings", value: summary.total, helper: "All reservations", icon: Package, tone: "text-foreground" },
              { label: "Upcoming", value: summary.upcoming, helper: "Pending or confirmed", icon: CalendarCheck, tone: "text-primary" },
              { label: "Completed", value: summary.completed, helper: "Finished stays", icon: CheckCircle2, tone: "text-emerald-700" },
              { label: "Total booked value", value: formatMoney(summary.totalSpend), helper: `${summary.paid} paid`, icon: CreditCard, tone: "text-secondary" },
            ].map(({ label, value, helper, icon: Icon, tone }) => (
              <div key={label} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <Icon className={`h-4 w-4 ${tone}`} />
                </div>
                <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, package, tour, or payment status"
              className="h-11 w-full rounded-md border border-input bg-background px-3 pl-10 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={statusFilter === item.value ? "default" : "outline"}
                onClick={() => setStatusFilter(item.value)}
                className="shrink-0"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <Card className="border-dashed py-16 text-center">
            <CardContent>
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-display text-xl font-bold text-foreground">No Bookings Yet</h3>
              <p className="mt-2 text-muted-foreground">You have not made any reservations yet.</p>
              <Button asChild className="mt-6 gap-2">
                <Link to={createPageUrl("Packages")}>
                  View Packages
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredBookings.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <CardContent>
              <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
              <h3 className="font-display text-xl font-bold text-foreground">No bookings match your filters</h3>
              <p className="mt-2 text-muted-foreground">Try another status or search term.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {filteredBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden border-border/80 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                <CardContent className="p-0">
                  <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-2xl font-bold text-foreground">{booking.package_name || "Resort Package"}</h3>
                            <Badge className={statusColors[booking.status] || statusColors.pending} variant="outline">
                              {(booking.status || "pending").replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Reservation for {booking.guest_count || 0} guest{Number(booking.guest_count || 0) === 1 ? "" : "s"}.
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm text-muted-foreground">Total amount</p>
                          <p className="text-2xl font-bold text-secondary">{formatMoney(booking.total_amount)}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <span className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-primary" />
                          {booking.booking_reference || booking.id}
                        </span>
                        <span className="flex items-center gap-2">
                          <CalendarCheck className="h-4 w-4 text-primary" />
                          {formatDate(booking.booking_date)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          {tourLabels[booking.tour_type] || booking.tour_type || "Tour"}
                        </span>
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {booking.guest_count || 0} guests
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-3 border-t border-border bg-muted/25 p-5 lg:min-w-64 lg:border-l lg:border-t-0">
                      <Badge className={`${paymentColors[getDisplayPaymentStatus(booking)] || paymentColors.unpaid} justify-center py-1.5`}>
                        {formatStatusLabel(getDisplayPaymentStatus(booking))}
                      </Badge>
                      {(booking.rebooking_status || "none") !== "none" ? (
                        <Badge variant="outline" className="justify-center py-1.5">
                          Rebooking {formatStatusLabel(booking.rebooking_status)}
                        </Badge>
                      ) : null}
                      <Button variant="outline" className="gap-2" onClick={() => setSelectedBooking(booking)}>
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                      {canRequestRebooking(booking) ? (
                        <Button variant="outline" className="gap-2" onClick={() => requestRebooking(booking)}>
                          <CalendarPlus className="h-4 w-4" />
                          Request Rebooking
                        </Button>
                      ) : null}
                      {canCancelBooking(booking) ? (
                        <Button variant="destructive" className="gap-2" onClick={() => requestCancelBooking(booking)}>
                          <XCircle className="h-4 w-4" />
                          Cancel Booking
                        </Button>
                      ) : null}
                      {!isLoadingReviews && canLeaveReview(booking) && !blockedReviewBookingIds.has(booking.id) && !reviewedBookingIds.has(booking.id) ? (
                        <Button
                          variant="outline"
                          className="gap-2 border-secondary/40 text-secondary hover:bg-secondary/10"
                          onClick={() => handleReviewOpen(booking)}
                        >
                          <Star className="h-4 w-4" />
                          Leave Review
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {reviewBooking && (
        <LeaveReviewDialog
          booking={reviewBooking}
          open={!!reviewBooking}
          onClose={handleReviewDismiss}
          onSubmitted={handleReviewSubmitted}
        />
      )}

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="font-display text-xl font-bold text-foreground">{selectedBooking.package_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedBooking.booking_reference}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Detail label="Status">
                  <Badge className={statusColors[selectedBooking.status]} variant="outline">{selectedBooking.status}</Badge>
                </Detail>
                <Detail label="Payment">
                  <Badge className={`${paymentColors[getDisplayPaymentStatus(selectedBooking)] || paymentColors.unpaid} max-w-full whitespace-normal break-words`}>
                    {formatStatusLabel(getDisplayPaymentStatus(selectedBooking))}
                  </Badge>
                </Detail>
                <Detail label="Date">{formatDate(selectedBooking.booking_date)}</Detail>
                <Detail label="Tour">{tourLabels[selectedBooking.tour_type] || selectedBooking.tour_type}</Detail>
                <Detail label="Guests">{selectedBooking.guest_count}</Detail>
                <Detail label="Total Amount"><span className="font-bold text-secondary">{formatMoney(selectedBooking.total_amount)}</span></Detail>
                <Detail label="Reservation Fee"><span className="font-bold text-primary">{formatMoney(selectedBooking.reservation_fee_amount)}</span></Detail>
                <Detail label="Payment Type">{paymentTypeLabels[selectedBooking.payment_type] || "Downpayment"}</Detail>
                <Detail label="Amount Submitted"><span className="font-bold text-primary">{formatMoney(selectedBooking.payment_amount_due || selectedBooking.reservation_fee_amount)}</span></Detail>
                <Detail label="Mode of Payment">{selectedBooking.payment_mode || selectedBooking.payment_qr_code_label || "Not selected"}</Detail>
                {(selectedBooking.rebooking_status || "none") !== "none" ? (
                  <>
                    <Detail label="Rebooking Status">{formatStatusLabel(selectedBooking.rebooking_status)}</Detail>
                    <Detail label="Original Date">{formatDate(selectedBooking.rebooking_original_date || selectedBooking.booking_date)}</Detail>
                    <Detail label="Requested Date">{formatDate(selectedBooking.rebooking_requested_date)}</Detail>
                    <Detail label="Rebooking Count">{selectedBooking.rebooking_count || 0}</Detail>
                  </>
                ) : null}
              </div>

              {selectedBooking.rebooking_reason ? (
                <div>
                  <span className="text-sm text-muted-foreground">Rebooking Reason</span>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm leading-6">{selectedBooking.rebooking_reason}</p>
                </div>
              ) : null}

              {selectedBooking.rebooking_resolution_note ? (
                <div>
                  <span className="text-sm text-muted-foreground">Rebooking Decision Note</span>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm leading-6">{selectedBooking.rebooking_resolution_note}</p>
                </div>
              ) : null}

              {selectedBooking.receipt_url ? (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Payment Proof</span>
                  <a href={selectedBooking.receipt_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border bg-muted/20">
                    <img src={selectedBooking.receipt_url} alt="Payment proof" className="max-h-[42vh] w-full bg-white object-contain sm:max-h-72" />
                  </a>
                </div>
              ) : null}

              {selectedBooking.special_requests ? (
                <div>
                  <span className="text-sm text-muted-foreground">Special Requests</span>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm leading-6">{selectedBooking.special_requests}</p>
                </div>
              ) : null}

              {getCancellationLockedReason(selectedBooking) ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                  {getCancellationLockedReason(selectedBooking)}
                </div>
              ) : null}

              {canRequestRebooking(selectedBooking) || canCancelBooking(selectedBooking) ? (
                <DialogFooter className="sm:justify-between">
                  {canRequestRebooking(selectedBooking) ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2 sm:w-auto"
                      onClick={() => requestRebooking(selectedBooking)}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Request Rebooking
                    </Button>
                  ) : null}
                  {canCancelBooking(selectedBooking) ? (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => requestCancelBooking(selectedBooking)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Booking
                  </Button>
                  ) : null}
                </DialogFooter>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!bookingToRebook}
        onOpenChange={(open) => {
          if (!open && !isRequestingRebooking) {
            setBookingToRebook(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto pb-0 sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Request Rebooking</DialogTitle>
          </DialogHeader>
          {bookingToRebook ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="font-semibold text-foreground">{bookingToRebook.package_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bookingToRebook.booking_reference} - Current date: {formatDate(bookingToRebook.booking_date)}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <p className="font-semibold">Rebooking Policy</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>One approved rebooking is allowed per reservation.</li>
                  <li>Requests must be submitted at least 7 days before the reservation date.</li>
                  <li>The new date must be available for the same package and tour type.</li>
                  <li>Reservation payments are non-refundable and transfer to the approved new date.</li>
                  <li>The original booking date stays active until admin approval.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Label htmlFor="rebooking-date">Preferred new date</Label>
                <div className="overflow-hidden rounded-lg border border-border bg-background p-2 sm:p-4">
                  <Calendar
                    id="rebooking-date"
                    mode="single"
                    selected={selectedRebookingDate}
                    onSelect={(date) => {
                      setRebookingForm((current) => ({
                        ...current,
                        requested_date: date ? dateInputValue(date) : "",
                      }));
                    }}
                    disabled={isRebookingDateDisabled}
                    fromDate={addDays(new Date(), 1)}
                    modifiers={{
                      reserved: rebookingReservedDates,
                      manual: rebookingManualDates,
                      current: bookingToRebook.booking_date ? [createDateFromKey(bookingToRebook.booking_date)] : [],
                    }}
                    modifiersClassNames={{
                      reserved: "bg-destructive/15 text-destructive font-semibold ring-1 ring-destructive/40 line-through",
                      manual: "bg-amber-100 text-amber-800 font-semibold ring-1 ring-amber-300 line-through",
                      current: "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30",
                    }}
                    classNames={{
                      months: "flex justify-center",
                      month: "w-full max-w-[22rem] space-y-4",
                      caption: "relative flex h-9 items-center justify-center px-10",
                      caption_label: "text-base font-semibold",
                      nav: "absolute inset-x-0 top-0 flex items-center justify-center gap-8",
                      nav_button: "flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-muted-foreground opacity-80 hover:bg-muted hover:text-foreground hover:opacity-100",
                      table: "w-full table-fixed border-collapse",
                      head_row: "grid grid-cols-7",
                      head_cell: "flex h-8 items-center justify-center rounded-md text-xs font-medium text-muted-foreground",
                      row: "grid grid-cols-7 gap-y-1",
                      cell: "flex h-10 items-center justify-center p-0 text-center text-sm",
                      day: "flex h-9 w-9 items-center justify-center rounded-md p-0 text-sm font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground sm:h-10 sm:w-10",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-transparent font-semibold text-foreground ring-1 ring-border",
                      day_outside: "day-outside text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-45 hover:bg-transparent line-through",
                    }}
                    className="mx-auto w-full p-0"
                  />
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-destructive/20 ring-1 ring-destructive/40" />
                    Reserved
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-100 ring-1 ring-amber-300" />
                    Resort schedule
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-primary/10 ring-1 ring-primary/30" />
                    Current date
                  </span>
                </div>
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    rebookingDateStatus.tone === "available"
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : rebookingDateStatus.tone === "blocked"
                        ? "border-destructive/25 bg-destructive/10 text-destructive"
                        : "border-border bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {rebookingDateStatus.message}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rebooking-reason">Reason</Label>
                <Textarea
                  id="rebooking-reason"
                  rows={4}
                  value={rebookingForm.reason}
                  onChange={(event) => setRebookingForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Tell us why you need to move this reservation."
                />
              </div>

              <DialogFooter className="sticky bottom-0 -mx-6 border-t border-border bg-background px-6 py-4">
                <Button variant="outline" onClick={() => setBookingToRebook(null)} disabled={isRequestingRebooking}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRebookingRequest}
                  disabled={isRequestingRebooking || rebookingDateStatus.tone !== "available"}
                  className="gap-2"
                >
                  {isRequestingRebooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!bookingToCancel}
        onOpenChange={(open) => {
          if (!open && !isCancellingBooking) {
            setBookingToCancel(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel booking {bookingToCancel?.booking_reference || "this reservation"} for {bookingToCancel?.package_name || "your selected package"}. This action cannot be undone from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingBooking}>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancellingBooking}
              onClick={(event) => {
                event.preventDefault();
                handleCancelBooking();
              }}
            >
              {isCancellingBooking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Booking"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3">
      <span className="text-muted-foreground">{label}</span>
      <p className="mt-1 break-words font-medium text-foreground">{children}</p>
    </div>
  );
}
