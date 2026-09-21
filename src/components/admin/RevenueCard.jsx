import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, CalendarCheck, Users } from "lucide-react";

export default function RevenueCards({ bookings }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const paidBookings = bookings.filter((booking) => booking.payment_status === "paid");
  const totalRevenue = paidBookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);

  const monthlyBookings = paidBookings.filter((booking) => {
    const d = new Date(booking.created_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthlyRevenue = monthlyBookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);

  const pendingBookings = bookings.filter(b => b.status === "pending");

  const cards = [
    {
      title: "Total Revenue",
      value: `₱${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-primary",
      desc: `${paidBookings.length} paid bookings`,
    },
    {
      title: "Monthly Revenue",
      value: `₱${monthlyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: "bg-secondary",
      desc: `${monthlyBookings.length} bookings this month`,
    },
    {
      title: "Total Bookings",
      value: bookings.length,
      icon: CalendarCheck,
      color: "bg-chart-3",
      desc: `${pendingBookings.length} pending`,
    },
    {
      title: "Pending Bookings",
      value: pendingBookings.length,
      icon: Users,
      color: "bg-chart-4",
      desc: "Awaiting confirmation",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <Card key={i} className="relative overflow-hidden">
          <CardContent className="p-5 sm:p-6 sm:pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
              </div>
              <div className={`${card.color} bg-opacity-10 p-2.5 rounded-xl`}>
                <card.icon className={`h-5 w-5 text-foreground`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
