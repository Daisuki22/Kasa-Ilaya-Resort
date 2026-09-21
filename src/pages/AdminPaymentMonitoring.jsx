import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { baseClient } from "@/api/baseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, ExternalLink, Eye, Loader2, Plus, ReceiptText, Search, Trash2 } from "lucide-react";

const paymentColors = {
  unpaid: "bg-destructive/10 text-destructive",
  pending_verification: "bg-accent/20 text-accent-foreground-black",
  paid: "bg-primary/10 text-primary",
};

const bookingStatusColors = {
  pending: "bg-accent/20 text-accent-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const paymentLabels = {
  unpaid: "Unpaid",
  pending_verification: "Pending verification",
  paid: "Paid",
};

const paymentTypeLabels = {
  downpayment: "Downpayment",
  full_payment: "Full payment",
};

const additionalFeeStatusColors = {
  pending: "bg-accent/20 text-accent-foreground",
  unpaid: "bg-destructive/10 text-destructive",
  paid: "bg-primary/10 text-primary",
};

const additionalFeeStatusLabels = {
  pending: "Pending",
  unpaid: "Unpaid",
  paid: "Paid",
};

const damageCategories = ["Furniture", "Linen", "Appliance", "Kitchenware", "Pool item", "Other"];
const damageServiceRate = 0.1;
const createDamageItem = () => ({ description: "", category: "Furniture", amount: "" });

const tourLabels = {
  day_tour: "Day Tour",
  night_tour: "Night Tour",
  "22_hours": "22 Hours",
};

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

const getSubmittedPaymentAmount = (booking) => Number(
  booking?.payment_amount_due || booking?.reservation_fee_amount || 0
);

const getPaymentChannel = (booking) => (
  booking?.payment_mode || booking?.payment_qr_code_label || "Not selected"
);

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

const normalizePaymentStatus = (status) => status || "unpaid";
const normalizeAdditionalFeeStatus = (status) => status || "unpaid";

const chartColors = {
  paid: "hsl(var(--primary))",
  pending_verification: "hsl(var(--secondary))",
  unpaid: "hsl(var(--destructive))",
  pending: "hsl(var(--secondary))",
};

const PaymentTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label || payload[0]?.name}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} className="text-muted-foreground">
          <span className="font-medium text-foreground">{entry.name}: </span>
          {entry.dataKey?.toLowerCase().includes("amount") || entry.name?.toLowerCase().includes("amount")
            ? formatMoney(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminPaymentMonitoring() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [feeDialogBooking, setFeeDialogBooking] = useState(null);
  const [feeForm, setFeeForm] = useState({ items: [createDamageItem()], notes: "", status: "unpaid" });
  const [verifyingId, setVerifyingId] = useState(null);
  const [savingFeeId, setSavingFeeId] = useState(null);

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-payment-monitoring"],
    queryFn: () => baseClient.entities.Booking.list("-created_date", 500),
  });

  const paymentBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "archived"),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return paymentBookings.filter((booking) => {
      const paymentStatus = normalizePaymentStatus(booking.payment_status);
      const matchesStatus = paymentFilter === "all" || paymentStatus === paymentFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        booking.booking_reference,
        booking.customer_name,
        booking.customer_email,
        booking.package_name,
        booking.payment_mode,
        booking.payment_qr_code_label,
        paymentTypeLabels[booking.payment_type],
        booking.additional_fee_reason,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [paymentBookings, paymentFilter, searchTerm]);

  const summary = useMemo(() => {
    return paymentBookings.reduce(
      (totals, booking) => {
        const paymentStatus = normalizePaymentStatus(booking.payment_status);
        const submittedAmount = getSubmittedPaymentAmount(booking);
        const additionalFee = Number(booking.additional_fee_amount || 0);

        if (paymentStatus === "paid") {
          totals.verifiedCount += 1;
          totals.verifiedPayments += submittedAmount;
        }

        if (paymentStatus === "pending_verification") {
          totals.pendingCount += 1;
          totals.pendingPayments += submittedAmount;
        }

        if (booking.receipt_url) {
          totals.receiptCount += 1;
        }

        if (additionalFee > 0) {
          totals.additionalFeeCount += 1;
          totals.additionalFees += additionalFee;
        }

        return totals;
      },
      { verifiedCount: 0, verifiedPayments: 0, pendingCount: 0, pendingPayments: 0, receiptCount: 0, additionalFeeCount: 0, additionalFees: 0 }
    );
  }, [paymentBookings]);

  const paymentStatusChart = useMemo(() => {
    return ["paid", "pending_verification", "unpaid"].map((status) => {
      const rows = paymentBookings.filter((booking) => normalizePaymentStatus(booking.payment_status) === status);

      return {
        status,
        label: paymentLabels[status],
        count: rows.length,
        amount: rows.reduce((sum, booking) => sum + getSubmittedPaymentAmount(booking), 0),
      };
    });
  }, [paymentBookings]);

  const additionalFeeChart = useMemo(() => {
    return ["paid", "pending", "unpaid"].map((status) => {
      const rows = paymentBookings.filter((booking) => (
        Number(booking.additional_fee_amount || 0) > 0 &&
        normalizeAdditionalFeeStatus(booking.additional_fee_status) === status
      ));

      return {
        status,
        label: additionalFeeStatusLabels[status],
        count: rows.length,
        amount: rows.reduce((sum, booking) => sum + Number(booking.additional_fee_amount || 0), 0),
      };
    }).filter((item) => item.count > 0 || item.amount > 0);
  }, [paymentBookings]);

  const paymentChannelChart = useMemo(() => {
    const byChannel = paymentBookings.reduce((acc, booking) => {
      const channel = getPaymentChannel(booking);
      if (!acc[channel]) {
        acc[channel] = { channel, count: 0, amount: 0 };
      }

      acc[channel].count += 1;
      acc[channel].amount += getSubmittedPaymentAmount(booking);
      return acc;
    }, {});

    return Object.values(byChannel)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 6);
  }, [paymentBookings]);

  const openAdditionalFeeDialog = (booking) => {
    setFeeDialogBooking(booking);
    setFeeForm({
      items: booking.additional_fee_amount
        ? [{
            description: booking.additional_fee_reason?.split("\n")[0]?.replace(/^Item:\s*/i, "") || "Damage charge",
            category: "Other",
            amount: String(Math.max(0, Number(booking.additional_fee_amount || 0) / (1 + damageServiceRate)).toFixed(2)),
          }]
        : [createDamageItem()],
      notes: booking.additional_fee_reason || "",
      status: normalizeAdditionalFeeStatus(booking.additional_fee_status),
    });
  };

  const damageSubtotal = useMemo(
    () => feeForm.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [feeForm.items]
  );
  const damageServiceFee = damageSubtotal * damageServiceRate;
  const damageTotal = damageSubtotal + damageServiceFee;

  const updateDamageItem = (index, updates) => {
    setFeeForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item),
    }));
  };

  const addDamageItem = () => {
    setFeeForm((current) => ({ ...current, items: [...current.items, createDamageItem()] }));
  };

  const removeDamageItem = (index) => {
    setFeeForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((_, itemIndex) => itemIndex !== index) : [createDamageItem()],
    }));
  };

  const saveAdditionalFee = async (statusOverride = feeForm.status) => {
    if (!feeDialogBooking) {
      return;
    }

    const filledItems = feeForm.items
      .map((item) => ({
        description: item.description.trim(),
        category: item.category,
        amount: Number(item.amount || 0),
      }))
      .filter((item) => item.description || item.amount > 0);
    const feeAmount = Number(damageTotal.toFixed(2));
    const notes = feeForm.notes.trim();

    if (filledItems.some((item) => !Number.isFinite(item.amount) || item.amount < 0)) {
      toast.error("Enter valid damage item amounts.");
      return;
    }

    if (feeAmount > 0 && filledItems.some((item) => !item.description)) {
      toast.error("Describe each damaged item before billing the guest.");
      return;
    }

    setSavingFeeId(feeDialogBooking.id);

    try {
      const reason = [
        ...filledItems.map((item) => `Item: ${item.description} | Category: ${item.category} | Amount: ${formatMoney(item.amount)}`),
        feeAmount > 0 ? `Service fee (${Math.round(damageServiceRate * 100)}%): ${formatMoney(damageServiceFee)}` : "",
        notes ? `Notes: ${notes}` : "",
      ].filter(Boolean).join("\n");

      const updates = {
        additional_fee_amount: feeAmount,
        additional_fee_reason: reason,
        additional_fee_status: feeAmount > 0 ? statusOverride : "unpaid",
      };

      const updatedBooking = await baseClient.entities.Booking.update(feeDialogBooking.id, updates);

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Additional fee updated",
        entity_type: "Booking",
        entity_id: feeDialogBooking.id,
        details: `Updated broken-property fee for booking ${feeDialogBooking.booking_reference || feeDialogBooking.id} to ${formatMoney(feeAmount)} (${updates.additional_fee_status}).`,
      });

      await queryClient.invalidateQueries({ queryKey: ["admin-payment-monitoring"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });

      toast.success(statusOverride === "unpaid" ? "Damage bill sent to guest." : "Damage billing draft saved.");
      setSelectedBooking((current) => current?.id === feeDialogBooking.id ? { ...current, ...updatedBooking } : current);
      setFeeDialogBooking(null);
    } catch (error) {
      toast.error(error?.message || "Unable to save additional fee.");
    } finally {
      setSavingFeeId(null);
    }
  };

  const verifyPayment = async (booking) => {
    setVerifyingId(booking.id);

    try {
      const nextStatus = booking.status === "pending" ? "confirmed" : booking.status;

      await baseClient.entities.Booking.update(booking.id, {
        payment_status: "paid",
        status: nextStatus,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Payment verified",
        entity_type: "Booking",
        entity_id: booking.id,
        details: `Verified payment for booking ${booking.booking_reference || booking.id}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["admin-payment-monitoring"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });

      toast.success("Payment marked as verified.");
      setSelectedBooking((current) => current?.id === booking.id ? { ...current, payment_status: "paid", status: nextStatus } : current);
    } catch (error) {
      toast.error(error?.message || "Unable to verify payment.");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Payment Monitoring</h1>
          <p className="mt-1 text-muted-foreground">Track submitted payments, broken-property charges, and payment verification.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, guest, or channel"
              className="pl-9"
            />
          </div>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="pending_verification">Pending verification</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <p className="text-sm text-muted-foreground">Verified payments</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{summary.verifiedCount}</p>
            <p className="text-sm font-medium text-primary">{formatMoney(summary.verifiedPayments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <p className="text-sm text-muted-foreground">Pending review</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{summary.pendingCount}</p>
            <p className="text-sm font-medium text-accent-foreground">{formatMoney(summary.pendingPayments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <p className="text-sm text-muted-foreground">Damage fees</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{summary.additionalFeeCount}</p>
            <p className="text-sm font-medium text-destructive">{formatMoney(summary.additionalFees)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <p className="text-sm text-muted-foreground">Reservations tracked</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{paymentBookings.length}</p>
            <p className="text-sm text-muted-foreground">Excludes archived bookings</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">Payment Status Overview</CardTitle>
            <p className="text-sm text-muted-foreground">Submitted payment counts and value by payment status.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentStatusChart} dataKey="count" nameKey="label" innerRadius={58} outerRadius={94} paddingAngle={3}>
                      {paymentStatusChart.map((entry) => (
                        <Cell key={entry.status} fill={chartColors[entry.status] || "hsl(var(--muted-foreground))"} />
                      ))}
                    </Pie>
                    <Tooltip content={<PaymentTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 self-center">
                {paymentStatusChart.map((item) => (
                  <div key={item.status} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[item.status] }} />
                        {item.label}
                      </span>
                      <span className="text-sm font-semibold">{item.count}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">Payment Channels</CardTitle>
            <p className="text-sm text-muted-foreground">Submitted payments grouped by selected payment channel.</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {paymentChannelChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentChannelChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="channel" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `P${Number(value) / 1000}k`} />
                    <Tooltip content={<PaymentTooltip />} />
                    <Bar dataKey="amount" name="Amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No channel data to chart.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-xl">Damage Fee Follow-up</CardTitle>
          <p className="text-sm text-muted-foreground">Additional charges grouped by payment follow-up status.</p>
        </CardHeader>
        <CardContent>
          {additionalFeeChart.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {additionalFeeChart.map((item) => (
                <div key={item.status} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <Badge className={additionalFeeStatusColors[item.status] || additionalFeeStatusColors.unpaid}>
                      {item.count} record{item.count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(8, Math.min(100, (item.amount / Math.max(summary.additionalFees, 1)) * 100))}%`,
                        backgroundColor: chartColors[item.status] || "hsl(var(--muted-foreground))",
                      }}
                    />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{formatMoney(item.amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No damage fees have been recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Booking Date</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Damage Fee</TableHead>
                  <TableHead>Fee Status</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                      No payment records match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => {
                    const paymentStatus = normalizePaymentStatus(booking.payment_status);
                    const additionalFeeStatus = normalizeAdditionalFeeStatus(booking.additional_fee_status);
                    const additionalFeeAmount = Number(booking.additional_fee_amount || 0);
                    const canVerify = paymentStatus === "pending_verification" && booking.status !== "cancelled";
                    const submittedAmount = getSubmittedPaymentAmount(booking);

                    return (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-sm">{booking.booking_reference || booking.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{booking.customer_name || "Guest"}</p>
                            <p className="text-xs text-muted-foreground">{booking.customer_email || "No email"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(booking.booking_date)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{booking.package_name || "Package"}</p>
                            <p className="text-xs text-muted-foreground">{tourLabels[booking.tour_type] || booking.tour_type || "Tour"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getPaymentChannel(booking)}</TableCell>
                        <TableCell className="font-medium text-primary">{formatMoney(submittedAmount)}</TableCell>
                        <TableCell>{paymentTypeLabels[booking.payment_type] || "Downpayment"}</TableCell>
                        <TableCell>
                          <Badge className={paymentColors[paymentStatus] || paymentColors.unpaid}>
                            {paymentLabels[paymentStatus] || paymentStatus.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className={additionalFeeAmount > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {additionalFeeAmount > 0 ? formatMoney(additionalFeeAmount) : "No fee"}
                        </TableCell>
                        <TableCell>
                          <Badge className={additionalFeeStatusColors[additionalFeeStatus] || additionalFeeStatusColors.unpaid}>
                            {additionalFeeStatusLabels[additionalFeeStatus] || additionalFeeStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={bookingStatusColors[booking.status] || "bg-muted text-muted-foreground"}>
                            {booking.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(booking)} title="View payment details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openAdditionalFeeDialog(booking)} title="Add additional fee for broken property">
                              <Plus className="h-4 w-4" />
                            </Button>
                            {canVerify ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary"
                                onClick={() => verifyPayment(booking)}
                                disabled={verifyingId === booking.id}
                                title="Verify payment"
                              >
                                {verifyingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display">Payment Details</DialogTitle>
          </DialogHeader>
          {selectedBooking ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="text-muted-foreground">Reference</span>
                  <p className="break-words font-mono font-bold">{selectedBooking.booking_reference || selectedBooking.id}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Guest</span>
                  <p className="break-words font-medium">{selectedBooking.customer_name || "Guest"}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Email</span>
                  <p className="break-all">{selectedBooking.customer_email || "No email"}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground">Payment Channel</span>
                  <p className="break-words">{getPaymentChannel(selectedBooking)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Type</span>
                  <p className="font-medium">{paymentTypeLabels[selectedBooking.payment_type] || "Downpayment"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount Submitted</span>
                  <p className="font-bold text-primary">{formatMoney(getSubmittedPaymentAmount(selectedBooking))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reservation Fee</span>
                  <p className="font-medium text-foreground">{formatMoney(selectedBooking.reservation_fee_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Amount</span>
                  <p className="font-bold text-foreground">{formatMoney(selectedBooking.total_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Damage Fee</span>
                  <p className={Number(selectedBooking.additional_fee_amount || 0) > 0 ? "font-bold text-destructive" : "font-medium text-muted-foreground"}>
                    {Number(selectedBooking.additional_fee_amount || 0) > 0 ? formatMoney(selectedBooking.additional_fee_amount) : "No fee"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Damage Fee Status</span>
                  <p>
                    <Badge className={additionalFeeStatusColors[normalizeAdditionalFeeStatus(selectedBooking.additional_fee_status)] || additionalFeeStatusColors.unpaid}>
                      {additionalFeeStatusLabels[normalizeAdditionalFeeStatus(selectedBooking.additional_fee_status)] || normalizeAdditionalFeeStatus(selectedBooking.additional_fee_status)}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Status</span>
                  <p>
                    <Badge className={paymentColors[normalizePaymentStatus(selectedBooking.payment_status)] || paymentColors.unpaid}>
                      {paymentLabels[normalizePaymentStatus(selectedBooking.payment_status)] || normalizePaymentStatus(selectedBooking.payment_status)}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Booking Status</span>
                  <p>
                    <Badge className={bookingStatusColors[selectedBooking.status] || "bg-muted text-muted-foreground"}>
                      {selectedBooking.status || "pending"}
                    </Badge>
                  </p>
                </div>
              </div>

              {selectedBooking.additional_fee_reason ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <span className="text-muted-foreground">Broken Property Note</span>
                  <p className="mt-1 whitespace-pre-wrap break-words">{selectedBooking.additional_fee_reason}</p>
                </div>
              ) : null}

              {selectedBooking.receipt_url ? (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Payment Proof</span>
                  <a href={selectedBooking.receipt_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-muted/20">
                    <img src={selectedBooking.receipt_url} alt="Payment proof" className="max-h-[50vh] w-full bg-white object-contain" />
                  </a>
                  <a href={selectedBooking.receipt_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full break-words text-sm text-primary underline-offset-4 hover:underline">
                    Open uploaded payment proof
                  </a>
                </div>
              ) : (
                <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                  <ReceiptText className="mr-2 h-4 w-4" /> No payment proof uploaded.
                </div>
              )}

              {normalizePaymentStatus(selectedBooking.payment_status) === "pending_verification" && selectedBooking.status !== "cancelled" ? (
                <Button className="w-full gap-2" onClick={() => verifyPayment(selectedBooking)} disabled={verifyingId === selectedBooking.id}>
                  {verifyingId === selectedBooking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify Payment
                </Button>
              ) : null}
              <Button variant="outline" className="w-full gap-2" onClick={() => openAdditionalFeeDialog(selectedBooking)}>
                <Plus className="h-4 w-4" />
                Add or Update Damage Fee
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!feeDialogBooking} onOpenChange={(open) => !open && setFeeDialogBooking(null)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[42rem] overflow-y-auto border-border bg-card p-0 text-foreground shadow-2xl shadow-black/20 dark:border-neutral-800 dark:bg-[#080808] dark:text-white dark:shadow-black/60 sm:max-h-[92vh]">
          {feeDialogBooking ? (
            <div className="p-6 sm:p-8">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="font-display text-xl font-bold text-foreground dark:text-white">Damage billing</DialogTitle>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-neutral-300">Add charges for property damage caused during the guest's stay.</p>
                  </div>
                  <Badge className={`rounded-full px-3 py-1 ${additionalFeeStatusColors[feeForm.status] || additionalFeeStatusColors.unpaid}`}>
                    {additionalFeeStatusLabels[feeForm.status] || "Unpaid"}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="mt-5 border-y border-border py-4 dark:border-neutral-800 sm:py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-950 text-sm font-bold text-blue-100 sm:h-12 sm:w-12">
                    {(feeDialogBooking.customer_name || "Guest").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground dark:text-white sm:text-base">{feeDialogBooking.customer_name || "Guest"}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground dark:text-neutral-300">
                      {feeDialogBooking.package_name || "Reservation"} · {feeDialogBooking.booking_reference || feeDialogBooking.id}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-foreground dark:text-neutral-100">
                    <p className="text-muted-foreground dark:text-neutral-300">Check-out</p>
                    <p>{formatDate(feeDialogBooking.booking_date)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Label className="text-sm font-bold text-foreground dark:text-neutral-200">Damaged items</Label>
                <div className="space-y-2.5">
                  {feeForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_6.5rem_2.5rem]">
                      <Input
                        value={item.description}
                        onChange={(event) => updateDamageItem(index, { description: event.target.value })}
                        placeholder="Broken bedside lamp"
                        className="h-11 border-input bg-background text-sm font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus-visible:ring-emerald-300"
                      />
                      <Select value={item.category} onValueChange={(category) => updateDamageItem(index, { category })}>
                        <SelectTrigger className="h-11 border-input bg-background text-sm font-bold text-foreground focus:ring-1 focus:ring-primary focus:ring-offset-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-emerald-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {damageCategories.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) => updateDamageItem(index, { amount: event.target.value })}
                        placeholder="0"
                        className="h-11 border-input bg-background text-right text-sm font-bold text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus-visible:ring-emerald-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-10 border-border bg-background text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-200"
                        onClick={() => removeDamageItem(index)}
                        aria-label="Remove damaged item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 border-border bg-background px-4 font-bold text-foreground hover:bg-muted dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                  onClick={addDamageItem}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </Button>
              </div>

              <div className="mt-5 space-y-2">
                <Label htmlFor="additional-fee-reason" className="text-sm font-bold text-foreground dark:text-neutral-200">Notes</Label>
                <Textarea
                  id="additional-fee-reason"
                  value={feeForm.notes}
                  onChange={(event) => setFeeForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Describe the damage or context for this charge"
                  className="min-h-24 border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus-visible:ring-emerald-300"
                />
              </div>

              <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm dark:border-neutral-800">
                <div className="flex items-center justify-between text-muted-foreground dark:text-neutral-200">
                  <span className="font-semibold">Subtotal</span>
                  <span>{formatMoney(damageSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground dark:text-neutral-200">
                  <span className="font-semibold">Service fee (10%)</span>
                  <span>{formatMoney(damageServiceFee)}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold text-foreground dark:text-white">
                  <span>Total damage charge</span>
                  <span>{formatMoney(damageTotal)}</span>
                </div>
              </div>

              <DialogFooter className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-11 border-border bg-card font-bold text-foreground hover:bg-muted dark:border-neutral-700 dark:bg-[#080808] dark:text-white dark:hover:bg-neutral-900"
                  onClick={() => saveAdditionalFee("pending")}
                  disabled={savingFeeId === feeDialogBooking.id}
                >
                  {savingFeeId === feeDialogBooking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save draft
                </Button>
                <Button
                  className="h-11 bg-primary font-bold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  onClick={() => saveAdditionalFee("unpaid")}
                  disabled={savingFeeId === feeDialogBooking.id}
                >
                  {savingFeeId === feeDialogBooking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Bill to guest
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
