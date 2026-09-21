import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import { Loader2, TrendingUp, CalendarCheck2, Wallet, Clock3 } from "lucide-react";
import { baseClient } from "@/api/baseClient";
import ActivityLogSummaryCards from "@/components/admin/ActivityLogSummaryCards";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/lib/adminAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RevenueCards from "@/components/admin/RevenueCards";
import RevenueChart from "@/components/admin/RevenueChart";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const statusColors = {
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const safeNumber = (value) => Number(value || 0);

export default function AdminDashboard() {
  const { user } = useAuth();
  const canViewLogAnalytics = isSuperAdmin(user);

  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => baseClient.entities.Booking.list("-created_date", 1000),
  });

  const { data: packages = [], isLoading: isLoadingPackages } = useQuery({
    queryKey: ["admin-reports-packages"],
    queryFn: () => baseClient.entities.Package.list("name", 300),
  });

  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: () => baseClient.entities.ActivityLog.list("-created_date", 400),
  });

  const isLoading = isLoadingBookings || isLoadingPackages || isLoadingLogs;

  const report = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status !== "cancelled");
    const paidBookings = bookings.filter((b) => b.payment_status === "paid");
    const confirmedOrCompleted = bookings.filter((b) => ["confirmed", "completed"].includes(b.status));

    const totalRevenue = confirmedOrCompleted.reduce((sum, b) => sum + safeNumber(b.total_amount), 0);
    const totalPaidRevenue = paidBookings.reduce((sum, b) => sum + safeNumber(b.total_amount), 0);

    const byStatus = {
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };

    const packageStats = packages
      .map((pkg) => {
        const pkgBookings = bookings.filter((b) => b.package_name === pkg.name);
        const pkgRevenue = pkgBookings
          .filter((b) => ["confirmed", "completed"].includes(b.status))
          .reduce((sum, b) => sum + safeNumber(b.total_amount), 0);
        return { id: pkg.id, name: pkg.name, bookingCount: pkgBookings.length, revenue: pkgRevenue };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    const monthlySeries = Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(new Date(), 5 - i);
      const key = format(monthDate, "yyyy-MM");
      const label = format(monthDate, "MMM yyyy");
      const monthBookings = bookings.filter(
        (b) => b.booking_date && format(parseISO(b.booking_date), "yyyy-MM") === key
      );
      const monthRevenue = monthBookings
        .filter((b) => ["confirmed", "completed"].includes(b.status))
        .reduce((sum, b) => sum + safeNumber(b.total_amount), 0);
      return { key, label, bookings: monthBookings.length, revenue: monthRevenue };
    });

    const maxBookingsPerMonth = Math.max(...monthlySeries.map((m) => m.bookings), 1);
    const pendingCount = byStatus.pending || 0;
    const paidCount = paidBookings.length;
    const totalBookingCount = bookings.length;
    const totalRevenueBase = Math.max(totalRevenue, 0);

    const revenueCircle = {
      collectionRatePct: totalRevenueBase > 0 ? (totalPaidRevenue / totalRevenueBase) * 100 : 0,
      paidBookingsPct: totalBookingCount > 0 ? (paidCount / totalBookingCount) * 100 : 0,
      pendingBookingsPct: totalBookingCount > 0 ? (pendingCount / totalBookingCount) * 100 : 0,
      paidCount,
      pendingCount,
      totalBookingCount,
    };

    return {
      totalBookings: bookings.length,
      activeBookings: activeBookings.length,
      totalRevenue,
      totalPaidRevenue,
      byStatus,
      packageStats,
      monthlySeries,
      maxBookingsPerMonth,
      revenueCircle,
    };
  }, [bookings, packages]);


  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of resort bookings, revenue, and activity.</p>
        </div>
      </div>

      <RevenueCards bookings={bookings} />
      {canViewLogAnalytics ? <ActivityLogSummaryCards logs={logs} /> : null}
      <RevenueChart bookings={bookings} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-3xl font-bold">{report.totalBookings}</p>
              </div>
              <CalendarCheck2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Reservations</p>
                <p className="text-3xl font-bold">{report.activeBookings}</p>
              </div>
              <Clock3 className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue (Confirmed/Completed)</p>
                <p className="text-2xl font-bold">{currency.format(report.totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid Revenue</p>
                <p className="text-2xl font-bold">{currency.format(report.totalPaidRevenue)}</p>
              </div>
              <Wallet className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Bookings By Month (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.monthlySeries.map((month) => {
              const width = `${Math.max((month.bookings / report.maxBookingsPerMonth) * 100, 6)}%`;
              return (
                <div key={month.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{month.label}</span>
                    <span className="text-muted-foreground">
                      {month.bookings} bookings · {currency.format(month.revenue)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted">
                    <div className="h-2.5 rounded-full bg-primary" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Booking Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <Badge variant="outline" className={statusColors[status]}>{status}</Badge>
                <span className="text-sm font-medium text-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Top Packages By Booking Count</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.packageStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No package data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.packageStats.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">{pkg.name}</TableCell>
                      <TableCell className="text-right">{pkg.bookingCount}</TableCell>
                      <TableCell className="text-right">{currency.format(pkg.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
