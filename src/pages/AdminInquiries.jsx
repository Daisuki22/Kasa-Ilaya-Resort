import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Archive, Loader2, MessageSquareMore, Send } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const filterOptions = [
  { value: "all", label: "All Inquiries" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const statusClasses = {
  open: "bg-accent/20 text-accent-foreground border-accent/30",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-muted text-muted-foreground border-border",
  archived: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

const statusChartColors = {
  open: "hsl(var(--secondary))",
  in_progress: "hsl(var(--primary))",
  resolved: "hsl(var(--chart-3))",
  closed: "hsl(var(--muted-foreground))",
  archived: "hsl(var(--chart-2))",
};

const InquiryTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-medium capitalize text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{item.value} {item.value === 1 ? "inquiry" : "inquiries"}</p>
    </div>
  );
};

export default function AdminInquiries() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [statusValue, setStatusValue] = useState("open");
  const [archiveId, setArchiveId] = useState(null);
  const [isReplying, setIsReplying] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [user, setUser] = useState(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["admin-inquiries", statusFilter],
    queryFn: () => baseClient.inquiries.list(statusFilter === "all" ? undefined : statusFilter),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: selectedThread, isLoading: isLoadingThread } = useQuery({
    queryKey: ["admin-inquiry-thread", selectedInquiryId],
    queryFn: () => baseClient.inquiries.thread(selectedInquiryId),
    enabled: Boolean(selectedInquiryId),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [selectedInquiryId, selectedThread?.messages?.length, selectedThread?.messages?.at(-1)?.id]);

  useEffect(() => {
    if (!inquiries.length) {
      setSelectedInquiryId(null);
      return;
    }

    if (!inquiries.some((entry) => entry.id === selectedInquiryId)) {
      setSelectedInquiryId(inquiries[0].id);
    }
  }, [inquiries, selectedInquiryId]);

  useEffect(() => {
    setStatusValue(selectedThread?.inquiry?.status || "open");
  }, [selectedThread?.inquiry?.status]);

  const counters = useMemo(() => ({
    total: inquiries.length,
    open: inquiries.filter((entry) => entry.status === "open").length,
    in_progress: inquiries.filter((entry) => entry.status === "in_progress").length,
    resolved: inquiries.filter((entry) => entry.status === "resolved").length,
  }), [inquiries]);

  const statusChartData = useMemo(() => (
    statusOptions
      .map((option) => ({
        name: option.label,
        status: option.value,
        value: inquiries.filter((entry) => entry.status === option.value).length,
      }))
      .filter((item) => item.value > 0)
  ), [inquiries]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-inquiry-thread"] }),
      queryClient.invalidateQueries({ queryKey: ["contact-inquiries"] }),
      queryClient.invalidateQueries({ queryKey: ["contact-inquiry-thread"] }),
    ]);
  };

  const handleSendReply = async (event) => {
    event.preventDefault();

    if (!selectedInquiryId || !replyMessage.trim()) {
      toast.error("Please enter a reply message.");
      return;
    }

    try {
      setIsReplying(true);
      await baseClient.inquiries.reply(selectedInquiryId, { message: replyMessage.trim() });
      setReplyMessage("");
      await refreshQueries();
      toast.success("Reply sent to the inquiry thread.");
    } catch (error) {
      toast.error(error?.message || "Unable to send the reply.");
    } finally {
      setIsReplying(false);
    }
  };

  const handleReplyKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (isReplying || isSelectedInquiryClosed || !replyMessage.trim()) {
      return;
    }

    void handleSendReply(event);
  };

  const handleStatusUpdate = async () => {
    if (!selectedInquiryId) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await baseClient.inquiries.updateStatus(selectedInquiryId, statusValue);
      await refreshQueries();
      toast.success("Inquiry status updated.");
    } catch (error) {
      toast.error(error?.message || "Unable to update the inquiry status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveId) {
      return;
    }

    try {
      setIsArchiving(true);
      await baseClient.inquiries.archive(archiveId);
      if (selectedInquiryId === archiveId) {
        setSelectedInquiryId(null);
      }
      await refreshQueries();
      toast.success("Inquiry archived.");
    } catch (error) {
      toast.error(error?.message || "Unable to archive inquiry.");
    } finally {
      setIsArchiving(false);
      setArchiveId(null);
    }
  };

  const archiveInquiry = inquiries.find((inquiry) => inquiry.id === archiveId);
  const selectedInquiryStatus = selectedThread?.inquiry?.status || "open";
  const isSelectedInquiryClosed = selectedInquiryStatus === "closed" || selectedInquiryStatus === "archived";

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Inquiry Inbox</h1>
          <p className="mt-1 text-muted-foreground">Review guest questions, reply from staff, and track resolution progress.</p>
        </div>
        <div className="w-full md:w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 text-foreground">
        {[
          { label: "Total", value: counters.total },
          { label: "Open", value: counters.open },
          { label: "In Progress", value: counters.in_progress },
          { label: "Resolved", value: counters.resolved },
        ].map((item) => (
          <Card key={item.label} className="border-border/80 shadow-sm">
            <CardContent className="p-5 sm:p-6 sm:pt-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6 border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">Inquiry Status</CardTitle>
          <p className="text-sm text-muted-foreground">Quickly compare open, active, resolved, and closed conversations.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-center">
            <div className="h-64">
              {statusChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
                      {statusChartData.map((item) => (
                        <Cell key={item.status} fill={statusChartColors[item.status] || "hsl(var(--muted-foreground))"} />
                      ))}
                    </Pie>
                    <Tooltip content={<InquiryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No inquiries to chart.</div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {statusOptions.map((option) => {
                const value = inquiries.filter((entry) => entry.status === option.value).length;
                const percent = counters.total ? Math.round((value / counters.total) * 100) : 0;

                return (
                  <div key={option.value} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusChartColors[option.value] }} />
                        {option.label}
                      </p>
                      <span className="text-sm font-semibold">{value}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: statusChartColors[option.value] }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{percent}% of current filter</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.95fr)]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Inquiry List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : inquiries.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-muted-foreground">No inquiries found for this filter.</div>
            ) : (
              <Table className="min-w-0 table-fixed" containerClassName="overflow-x-hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[24%]">Guest</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36">Updated</TableHead>
                    <TableHead className="w-16 text-right">Archive</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiries.map((inquiry) => (
                    <TableRow
                      key={inquiry.id}
                      className={`cursor-pointer ${selectedInquiryId === inquiry.id ? "bg-muted/50" : ""}`}
                      onClick={() => setSelectedInquiryId(inquiry.id)}
                    >
                      <TableCell className="overflow-hidden">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm text-foreground">{inquiry.guest_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{inquiry.guest_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm text-foreground">{inquiry.subject}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge className={statusClasses[inquiry.status] || statusClasses.open}>
                          {(inquiry.status || "open").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {inquiry.last_message_at
                          ? formatDistanceToNow(new Date(inquiry.last_message_at), { addSuffix: true })
                          : "just now"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                          title="Archive inquiry"
                          disabled={inquiry.status === "archived"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setArchiveId(inquiry.id);
                          }}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Conversation Detail</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedInquiryId ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-5 py-14 text-center text-sm text-muted-foreground">
                Select an inquiry to review and reply.
              </div>
            ) : isLoadingThread ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{selectedThread?.inquiry?.subject}</p>
                      <p className="text-sm text-muted-foreground">{selectedThread?.inquiry?.guest_name} • {selectedThread?.inquiry?.guest_email}</p>
                      <p className="text-sm text-muted-foreground">{selectedThread?.inquiry?.guest_phone || "No phone number provided"}</p>
                    </div>
                    <Badge className={statusClasses[selectedThread?.inquiry?.status] || statusClasses.open}>
                      {(selectedThread?.inquiry?.status || "open").replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <Label htmlFor="inquiry-status">Inquiry Status</Label>
                      <Select value={statusValue} onValueChange={setStatusValue}>
                        <SelectTrigger id="inquiry-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleStatusUpdate} disabled={isUpdatingStatus} className="gap-2">
                      {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Update Status
                    </Button>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    Assigned to: {selectedThread?.inquiry?.assigned_admin_name || user?.full_name || "Not assigned yet"}
                  </div>
                </div>

                <div ref={messagesContainerRef} className="h-[460px] space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-muted/10 p-4">
                  {(selectedThread?.messages || []).map((message) => {
                    const isOwnMessage =
                      (message.sender_user_id && user?.id && message.sender_user_id === user.id) ||
                      (message.sender_email && user?.email && message.sender_email.toLowerCase() === user.email.toLowerCase()) ||
                      (!message.sender_user_id && !message.sender_email && message.sender_type === "admin");

                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isOwnMessage
                              ? "bg-primary text-primary-foreground"
                              : "border border-border/70 bg-background text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs opacity-80">
                            <MessageSquareMore className="h-3.5 w-3.5" />
                            <span>{message.sender_name}</span>
                            <span>
                              {message.created_date
                                ? formatDistanceToNow(new Date(message.created_date), { addSuffix: true })
                                : "just now"}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-6">{message.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form className="space-y-3" onSubmit={handleSendReply}>
                  {isSelectedInquiryClosed ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      This inquiry is {selectedInquiryStatus}. Messaging is disabled because the conversation is already done.
                    </div>
                  ) : null}

                  <div>
                    <Label htmlFor="admin-inquiry-reply">Reply to Guest</Label>
                    <Textarea
                      id="admin-inquiry-reply"
                      rows={5}
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      onKeyDown={handleReplyKeyDown}
                      placeholder="Type your reply to the guest here."
                      disabled={isSelectedInquiryClosed || isReplying}
                    />
                  </div>
                  <Button type="submit" className="gap-2" disabled={isSelectedInquiryClosed || isReplying}>
                    {isReplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSelectedInquiryClosed ? "Inquiry Closed" : "Send Reply"}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!archiveId} onOpenChange={(open) => !open && !isArchiving && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Inquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move "{archiveInquiry?.subject || "this inquiry"}" out of the active inquiry list. You can still view it from the Archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-amber-600 text-white hover:bg-amber-700" disabled={isArchiving}>
              {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
