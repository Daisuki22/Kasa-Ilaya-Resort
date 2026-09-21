const normalize = (value) => String(value || "").toLowerCase();

export const getActivityLogSeverity = (log) => {
  const content = [log?.action, log?.details].map(normalize).join(" ");

  if (content.includes("deleted") || content.includes("cancelled") || content.includes("failed") || content.includes("error")) {
    return "high";
  }

  if (content.includes("updated") || content.includes("archived") || content.includes("restored") || content.includes("changed")) {
    return "medium";
  }

  return "low";
};

export const activityLogSeverityStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-accent/20 text-accent-foreground border-accent/30 text-foreground",
  low: "bg-primary/10 text-primary border-primary/20",
};

export const buildActivityLogStats = (logs = []) => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const lastHourCount = logs.filter((log) => {
    if (!log?.created_date) {
      return false;
    }

    const value = new Date(log.created_date).getTime();
    return Number.isFinite(value) && value >= oneHourAgo;
  }).length;

  const highSeverityCount = logs.filter((log) => getActivityLogSeverity(log) === "high").length;
  const uniqueUsers = new Set(logs.map((log) => log.user_email || log.user_name).filter(Boolean)).size;

  return {
    total: logs.length,
    lastHourCount,
    highSeverityCount,
    uniqueUsers,
  };
};

export const matchesActivityLogSearch = (log, query) => {
  const normalizedQuery = normalize(query);

  return [
    log?.user_name,
    log?.user_email,
    log?.action,
    log?.entity_type,
    log?.details,
  ].some((value) => normalize(value).includes(normalizedQuery));
};