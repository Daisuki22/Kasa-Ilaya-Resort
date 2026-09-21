import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { buildActivityLogStats } from "@/lib/activityLogAnalytics";

export default function ActivityLogSummaryCards({ logs = [], className = "" }) {
  const stats = useMemo(() => buildActivityLogStats(logs), [logs]);

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`.trim()}>
      <Card>
        <CardContent className="p-5 sm:p-6 sm:pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Logs</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 sm:p-6 sm:pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 1 Hour</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.lastHourCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 sm:p-6 sm:pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">High Severity</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">{stats.highSeverityCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 sm:p-6 sm:pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Unique Actors</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.uniqueUsers}</p>
        </CardContent>
      </Card>
    </div>
  );
}
