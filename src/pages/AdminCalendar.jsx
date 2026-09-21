import React, { useEffect, useMemo, useState } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Archive,
  CalendarCheck,
  CheckCircle2,
  CheckCheck,
  Clock3,
  CreditCard,
  Eye,
  Loader2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import FullCalendarView from "@/components/admin/FullCalendarView";

const statusColors = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
};

const paymentColors = {
  unpaid: "border-destructive/20 bg-destructive/10 text-destructive",
  pending_verification: "border-sky-200 bg-sky-50 text-sky-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const tourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};

const paymentTypeLabels = {
  downpayment: "Downpayment",
  full_payment: "Full payment",
};

const statusOptions = [
  { value: "all", label: "All active" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString()}`;

const getSubmittedPaymentAmount = (booking) => Number(
  booking?.payment_amount_due || booking?.reservation_fee_amount || 0
);

const getPaymentChannel = (booking) => (
  booking?.payment_mode || booking?.payment_qr_code_label || "Not selected"
);

const formatDate = (value, pattern = "MMM d, yyyy") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, pattern);
};

const normalizeText = (value) => String(value || "").toLowerCase();

function MetricCard({ icon: Icon, label, value, helper, tone = "text-foreground" }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-start gap-4 p-5 sm:p-6 sm:pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <Icon className={`h-5 w-5 ${tone}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, children }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="mt-1 min-w-0 break-words text-sm font-medium text-foreground">{children || "-"}</div>
    </div>
  );
}

export default function AdminCalendar() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => baseClient.entities.Booking.list("-created_date", 500),
  });

  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "archived"),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    const term = normalizeText(searchTerm).trim();

    return activeBookings.filter((booking) => {
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const searchable = [
        booking.booking_reference,
        booking.customer_name,
        booking.customer_email,
        booking.customer_phone,
        booking.package_name,
        tourLabels[booking.tour_type],
        booking.status,
        booking.payment_status,
        paymentTypeLabels[booking.payment_type],
        booking.payment_mode,
        booking.payment_qr_code_label,
      ].map(normalizeText).join(" ");

      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [activeBookings, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const pending = activeBookings.filter((booking) => booking.status === "pending").length;
    const confirmed = activeBookings.filter((booking) => booking.status === "confirmed").length;
    const completed = activeBookings.filter((booking) => booking.status === "completed").length;
    const pendingPayments = activeBookings.filter((booking) => booking.payment_status === "pending_verification").length;
    const expectedRevenue = activeBookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);

    return {
      total: activeBookings.length,
      pending,
      confirmed,
      completed,
      pendingPayments,
      expectedRevenue,
    };
  }, [activeBookings]);

  const archiveBooking = async (bookingId) => {
    const booking = bookings.find((item) => item.id === bookingId);

    try {
      await baseClient.entities.Booking.update(bookingId, {
        status: "archived",
      });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Booking archived",
        entity_type: "Booking",
        entity_id: bookingId,
        details: `Archived booking ${booking?.booking_reference}`,
      });
      toast.success("Booking archived.");
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-archived"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      setSelectedBooking(null);
    } catch (error) {
      toast.error(error?.message || "Unable to archive booking.");
    }
  };

  const getNextPaymentStatus = (booking, newStatus) => {
    if (newStatus === "confirmed" || newStatus === "completed") {
      return "paid";
    }

    if (newStatus === "cancelled") {
      return booking.payment_status || "unpaid";
    }

    return booking.payment_status || "unpaid";
  };

  const updateStatus = async (bookingId, newStatus) => {
    if (newStatus === "cancelled") {
      toast.error("Owner and staff cannot cancel bookings. Only guests can cancel their own pending bookings before they are marked paid or approved.");
      return;
    }

    const booking = bookings.find((item) => item.id === bookingId);
    const nextPaymentStatus = getNextPaymentStatus(booking, newStatus);

    try {
      await baseClient.entities.Booking.update(bookingId, {
        status: newStatus,
        payment_status: nextPaymentStatus,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: `Booking ${newStatus}`,
        entity_type: "Booking",
        entity_id: bookingId,
        details: `Updated booking ${booking?.booking_reference} to ${newStatus} with payment status ${nextPaymentStatus}`,
      });

      if (newStatus === "confirmed") {
        toast.success("Reservation approved and guest notification processed.");
      } else if (newStatus === "completed") {
        toast.success("Reservation marked as completed.");
      }

      await queryClient.refetchQueries({ queryKey: ["admin-all-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["admin-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["calendar-bookings"] });
      await queryClient.refetchQueries({ queryKey: ["my-bookings"] });
      setSelectedBooking(null);
    } catch (error) {
      toast.error(error?.message || "Unable to update reservation.");
    }
  };

  return (
    <div className="bg-muted/20">
      <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8">
            <div>
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                Reservation management
              </Badge>
              <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
                Manage resort reservations with confidence.
              </h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Review guest bookings, payment verification, arrival dates, and approval actions from one organized workspace.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reservations tracked</p>
                  <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">Needs review</p>
                  <p className="mt-1 font-semibold text-amber-700">{metrics.pending}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">Payment checks</p>
                  <p className="mt-1 font-semibold text-sky-700">{metrics.pendingPayments}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Clock3}
            label="Pending"
            value={metrics.pending}
            helper="Awaiting resort review"
            tone="text-amber-600"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Confirmed"
            value={metrics.confirmed}
            helper="Approved active bookings"
            tone="text-emerald-600"
          />
          <MetricCard
            icon={CheckCheck}
            label="Completed"
            value={metrics.completed}
            helper="Finished guest stays"
            tone="text-slate-600"
          />
          <MetricCard
            icon={CreditCard}
            label="Booked Value"
            value={formatMoney(metrics.expectedRevenue)}
            helper="Excludes cancelled bookings"
            tone="text-primary"
          />
        </section>

        <FullCalendarView embedded />

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Reservation Queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing {filteredBookings.length} of {activeBookings.length} active reservation{activeBookings.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search reservations"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[1300px] table-fixed">
                  <colgroup>
                    <col className="w-[150px]" />
                    <col className="w-[136px]" />
                    <col className="w-[190px]" />
                    <col className="w-[140px]" />
                    <col className="w-[125px]" />
                    <col className="w-[150px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[169px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Reference</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Submitted Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.length ? (
                      filteredBookings.map((booking) => (
                        <TableRow key={booking.id} className="align-top">
                          <TableCell>
                            <p className="font-mono text-sm font-semibold text-foreground">{booking.booking_reference || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(booking.created_date)}</p>
                          </TableCell>
                          <TableCell className="max-w-[136px] overflow-hidden align-top">
                            <div className="w-full min-w-0 py-1">
                              <p className="truncate text-sm font-semibold leading-5 text-foreground">{booking.customer_name || "Guest user"}</p>
                              <p className="truncate text-xs leading-4 text-muted-foreground">{booking.customer_email || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{booking.package_name || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{tourLabels[booking.tour_type] || booking.tour_type || "-"}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{formatDate(booking.booking_date)}</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {booking.guest_count || 0} guest{Number(booking.guest_count || 0) === 1 ? "" : "s"}
                            </p>
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">{formatMoney(booking.total_amount)}</TableCell>
                          <TableCell>
                            <p className="font-semibold text-primary">{formatMoney(getSubmittedPaymentAmount(booking))}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{paymentTypeLabels[booking.payment_type] || "Downpayment"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[booking.status] || statusColors.pending}>
                              {(booking.status || "pending").replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={paymentColors[booking.payment_status] || paymentColors.unpaid}>
                              {(booking.payment_status || "unpaid").replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="View reservation" onClick={() => setSelectedBooking(booking)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {booking.status === "confirmed" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  title="Mark as completed"
                                  onClick={() => updateStatus(booking.id, "completed")}
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                                title="Archive booking"
                                onClick={() => archiveBooking(booking.id)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="py-16 text-center">
                          <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                          <p className="mt-3 font-medium text-foreground">No reservations found</p>
                          <p className="mt-1 text-sm text-muted-foreground">Try a different status filter or search keyword.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </section>

        <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto sm:max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Reservation Details</DialogTitle>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-primary">{selectedBooking.booking_reference}</p>
                      <h3 className="mt-1 text-xl font-bold text-foreground">{selectedBooking.package_name || "Selected package"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tourLabels[selectedBooking.tour_type] || selectedBooking.tour_type || "Selected tour"} on {formatDate(selectedBooking.booking_date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={statusColors[selectedBooking.status] || statusColors.pending}>
                        {(selectedBooking.status || "pending").replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className={paymentColors[selectedBooking.payment_status] || paymentColors.unpaid}>
                        {(selectedBooking.payment_status || "unpaid").replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Customer">{selectedBooking.customer_name || "Guest"}</DetailItem>
                  <DetailItem label="Email">
                    <span className="break-all">{selectedBooking.customer_email || "-"}</span>
                  </DetailItem>
                  <DetailItem label="Phone">{selectedBooking.customer_phone || "-"}</DetailItem>
                  <DetailItem label="Guests">{selectedBooking.guest_count || 0}</DetailItem>
                  <DetailItem label="Total Amount">{formatMoney(selectedBooking.total_amount)}</DetailItem>
                  <DetailItem label="Payment Type">{paymentTypeLabels[selectedBooking.payment_type] || "Downpayment"}</DetailItem>
                  <DetailItem label="Amount Submitted">{formatMoney(getSubmittedPaymentAmount(selectedBooking))}</DetailItem>
                  <DetailItem label="Reservation Fee">{formatMoney(selectedBooking.reservation_fee_amount)}</DetailItem>
                  <DetailItem label="Mode of Payment">{getPaymentChannel(selectedBooking)}</DetailItem>
                  <DetailItem label="Booked Date">{formatDate(selectedBooking.created_date)}</DetailItem>
                  <DetailItem label="Stay Date">{formatDate(selectedBooking.booking_date)}</DetailItem>
                </div>

                {selectedBooking.receipt_url && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Payment Proof</span>
                    <a href={selectedBooking.receipt_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-white">
                      <img src={selectedBooking.receipt_url} alt="Payment proof" className="max-h-[42vh] w-full object-contain sm:max-h-72" />
                    </a>
                    <a href={selectedBooking.receipt_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full break-words text-sm text-primary underline-offset-4 hover:underline">
                      Open uploaded payment proof
                    </a>
                  </div>
                )}

                {selectedBooking.special_requests && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <span className="text-sm font-medium text-muted-foreground">Special Requests</span>
                    <p className="mt-2 text-sm text-foreground">{selectedBooking.special_requests}</p>
                  </div>
                )}

                {selectedBooking.status === "pending" && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <Button className="w-full gap-2" onClick={() => updateStatus(selectedBooking.id, "confirmed")}>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Reservation
                    </Button>
                    <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Owner and staff cannot cancel bookings. Guests may only cancel their own pending bookings before they are marked paid or approved.
                    </p>
                  </div>
                )}
                {selectedBooking.status === "confirmed" && (
                  <div className="border-t border-border pt-4">
                    <Button className="w-full gap-2" onClick={() => updateStatus(selectedBooking.id, "completed")}>
                      <CheckCheck className="h-4 w-4" />
                      Mark as Completed
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
