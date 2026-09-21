import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  MessageSquareMore,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { RESORT_CONTACT } from "@/lib/resortContact";
import { createPageUrl } from "@/utils";
import { baseClient } from "@/api/baseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getPageBannerImages } from "@/lib/pageBannerImages";
import RotatingBannerBackground from "@/components/common/RotatingBannerBackground";

const isValidEmail = (value) => /^(?:[^\s@]+)@(?:[^\s@]+)\.[^\s@]+$/.test(value);
const INQUIRY_STORAGE_KEY = "kasa-ilaya-inquiry-access";

const inquiryStatusClasses = {
  open: "bg-accent/20 text-accent-foreground border-accent/30",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-muted text-muted-foreground border-border",
};
const ACTIVE_INQUIRY_STATUSES = new Set(["open", "in_progress"]);

const loadStoredInquiryAccess = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(INQUIRY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry?.id === "string" && typeof entry?.token === "string")
      : [];
  } catch {
    return [];
  }
};

const storeInquiryAccess = (entries) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(entries));
};

const mergeInquiryAccess = (entries, nextEntry) => {
  const nextEntries = [nextEntry, ...entries.filter((entry) => entry.id !== nextEntry.id)];
  storeInquiryAccess(nextEntries);
  return nextEntries;
};

export default function Contact() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: user?.full_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    subject: "",
    message: "",
  });
  const [guestInquiryAccess, setGuestInquiryAccess] = useState(() => loadStoredInquiryAccess());
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const messagesContainerRef = useRef(null);

  const packagesUrl = createPageUrl("Packages");
  const aboutUrl = createPageUrl("About");
  const amenitiesUrl = createPageUrl("Amenities");
  const selectedInquiryToken = useMemo(
    () => guestInquiryAccess.find((entry) => entry.id === selectedInquiryId)?.token,
    [guestInquiryAccess, selectedInquiryId]
  );
  const heroImages = useMemo(() => getPageBannerImages(settings), [settings]);

  const { data: inquiries = [], isLoading: isLoadingInquiries } = useQuery({
    queryKey: ["contact-inquiries", user?.id, user?.email],
    queryFn: () => baseClient.inquiries.mine([]),
    enabled: Boolean(user),
    refetchInterval: 15000,
  });
  const activeInquiries = useMemo(
    () => inquiries.filter((inquiry) => ACTIVE_INQUIRY_STATUSES.has(inquiry.status || "open")),
    [inquiries]
  );
  const shouldShowInquiryMessages = Boolean(user) && activeInquiries.length > 0;

  const { data: inquiryThread, isLoading: isLoadingThread } = useQuery({
    queryKey: ["contact-inquiry-thread", selectedInquiryId, selectedInquiryToken, user?.id],
    queryFn: () => baseClient.inquiries.thread(selectedInquiryId, selectedInquiryToken),
    enabled: Boolean(user && selectedInquiryId),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [selectedInquiryId, inquiryThread?.messages?.length, inquiryThread?.messages?.at(-1)?.id]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: user?.full_name || prev.name,
      email: user?.email || prev.email,
      phone: user?.phone || prev.phone,
    }));
  }, [user?.email, user?.full_name, user?.phone]);

  useEffect(() => {
    if (!activeInquiries.length) {
      setSelectedInquiryId(null);
      return;
    }

    const exists = activeInquiries.some((entry) => entry.id === selectedInquiryId);
    if (!exists) {
      setSelectedInquiryId(activeInquiries[0].id);
    }
  }, [activeInquiries, selectedInquiryId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!form.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    if (!isValidEmail(form.email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!form.subject.trim()) {
      toast.error("Please enter an inquiry subject.");
      return;
    }

    if (!form.message.trim()) {
      toast.error("Please enter your message.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await baseClient.inquiries.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });

      if (response?.inquiry?.id && response?.guest_access_token) {
        setGuestInquiryAccess((prev) =>
          mergeInquiryAccess(prev, { id: response.inquiry.id, token: response.guest_access_token })
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["contact-inquiries"] });
      setSelectedInquiryId(user ? response?.inquiry?.id || null : null);
      setForm((prev) => ({ ...prev, subject: "", message: "" }));
      toast.success(user ? "Your inquiry has been sent. You can continue the conversation below." : "Your inquiry has been sent.");
    } catch (error) {
      toast.error(error?.message || "Unable to send your inquiry right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();

    if (!selectedInquiryId) {
      return;
    }

    if (!replyMessage.trim()) {
      toast.error("Please enter your reply.");
      return;
    }

    try {
      setIsReplying(true);
      await baseClient.inquiries.reply(selectedInquiryId, {
        message: replyMessage.trim(),
        token: selectedInquiryToken,
      });

      setReplyMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contact-inquiries"] }),
        queryClient.invalidateQueries({ queryKey: ["contact-inquiry-thread", selectedInquiryId] }),
      ]);
      toast.success("Your message has been sent.");
    } catch (error) {
      toast.error(error?.message || "Unable to send your reply right now.");
    } finally {
      setIsReplying(false);
    }
  };

  const handleReplyKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (isReplying || isInquiryClosed || !replyMessage.trim()) {
      return;
    }

    void handleReply(event);
  };

  const isInquiryClosed = (inquiryThread?.inquiry?.status || "open") === "closed";
  const isInquirySettled = ["resolved", "closed"].includes(inquiryThread?.inquiry?.status || "");

  useEffect(() => {
    if (!isInquirySettled) {
      return;
    }

    setSelectedInquiryId(null);
    queryClient.invalidateQueries({ queryKey: ["contact-inquiries"] });
  }, [isInquirySettled, queryClient]);

  return (
    <div className="bg-background">
      <section className="relative min-h-[34rem] overflow-hidden bg-foreground text-white lg:min-h-[38rem]">
        <RotatingBannerBackground images={heroImages} alt="Kasa Ilaya Resort contact banner" />

        <div className="relative flex min-h-[34rem] w-full max-w-none flex-col justify-end px-2 pb-10 pt-20 sm:px-3 lg:min-h-[38rem] lg:px-4 lg:pb-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              <MessageSquareMore className="h-4 w-4" />
              Contact Kasa Ilaya
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Reach out for bookings, events, and resort guest support
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              Ask about package availability, private celebrations, amenities, payment details, or anything you need
              before visiting the resort.
            </p>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/20 pt-5 sm:grid-cols-3">
            {[
              { icon: Phone, label: "Phone", value: RESORT_CONTACT.phoneDisplay },
              { icon: Mail, label: "Email", value: RESORT_CONTACT.email },
              { icon: Clock3, label: "Support hours", value: RESORT_CONTACT.hours },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-white/72">{label}</p>
                  <p className="mt-1 font-semibold leading-tight text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="grid w-full max-w-none gap-4 px-2 py-6 sm:px-3 md:grid-cols-2 lg:grid-cols-4 lg:px-4">
          {[
            { icon: Phone, label: "Phone", value: RESORT_CONTACT.phoneDisplay, href: `tel:${RESORT_CONTACT.phoneLink}` },
            { icon: Mail, label: "Email", value: RESORT_CONTACT.email, href: `mailto:${RESORT_CONTACT.email}` },
            { icon: MapPin, label: "Location", value: RESORT_CONTACT.address },
            { icon: Clock3, label: "Support Hours", value: RESORT_CONTACT.hours },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="mt-1 block break-words font-semibold text-foreground hover:text-primary">
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-1 break-words font-semibold text-foreground">{item.value}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid w-full max-w-none gap-8 px-2 py-8 sm:px-3 lg:grid-cols-[0.92fr_1.08fr] lg:px-4 lg:py-10">
        <div className="space-y-6">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Get in Touch</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              Send your inquiry directly to the resort team
            </h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              Share your preferred dates, guest count, event plans, or questions. We will keep the conversation in
              your inquiry thread so you can return to it later.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Helpful Links</p>
                <p className="text-sm text-muted-foreground">Explore before sending a message.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { label: "View Packages", url: packagesUrl },
                { label: "About the Resort", url: aboutUrl },
                { label: "Amenities", url: amenitiesUrl },
              ].map((item) => (
                <Button key={item.label} asChild variant="outline" className="justify-between gap-2">
                  <Link to={item.url}>
                    {item.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Send an Inquiry</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact-name">Full Name</Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="contact-email">Email Address</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact-phone">Phone Number</Label>
                  <Input
                    id="contact-phone"
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Optional contact number"
                  />
                </div>
                <div>
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    value={form.subject}
                    onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="Booking or event inquiry"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  rows={7}
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  placeholder="Tell us about your preferred dates, event plans, guest count, or questions."
                />
              </div>

              <Button type="submit" className="gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Inquiry
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-border bg-muted/35 py-12 sm:py-16">
        <div className="w-full max-w-none px-2 sm:px-3 lg:px-4">
          <div className="mb-6">
            <span className="text-sm font-semibold uppercase tracking-wider text-secondary">Location</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground">Find Us on the Map</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Visit Kasa Ilaya Resort & Events Place with directions directly from Google Maps.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1990.2607237347663!2d120.9992428775908!3d14.24133309901719!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33bd7dccae896b1d%3A0x1a027c4f0dfdc38!2sKasa%20Ilaya%20Resort%20%26%20Events%20Place!5e0!3m2!1sen!2sph!4v1775063071661!5m2!1sen!2sph"
              title="Kasa Ilaya Resort and Events Place location"
              className="h-[320px] w-full border-0 sm:h-[420px] lg:h-[460px]"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {shouldShowInquiryMessages ? (
      <section className="grid w-full max-w-none gap-8 px-2 py-8 sm:px-3 lg:grid-cols-[0.92fr_1.08fr] lg:px-4 lg:py-10">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="font-display text-2xl">Your Inquiry Messages</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Continue conversations with resort staff here.
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingInquiries ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {activeInquiries.map((inquiry) => {
                  const isSelected = inquiry.id === selectedInquiryId;

                  return (
                    <button
                      key={inquiry.id}
                      type="button"
                      onClick={() => setSelectedInquiryId(inquiry.id)}
                      className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{inquiry.subject}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{inquiry.last_message_preview || "No message yet."}</p>
                        </div>
                        <Badge className={inquiryStatusClasses[inquiry.status] || inquiryStatusClasses.open}>
                          {(inquiry.status || "open").replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{inquiry.message_count || 0} messages</span>
                        <span>
                          {inquiry.last_message_at
                            ? formatDistanceToNow(new Date(inquiry.last_message_at), { addSuffix: true })
                            : "just now"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="font-display text-2xl">Conversation</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Reply to your selected inquiry and wait for resort staff to respond.
            </p>
          </CardHeader>
          <CardContent>
            {!selectedInquiryId ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center text-sm leading-6 text-muted-foreground">
                Select an inquiry after sending your first message.
              </div>
            ) : isLoadingThread ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{inquiryThread?.inquiry?.subject}</p>
                    <p className="text-sm text-muted-foreground">{inquiryThread?.inquiry?.guest_email}</p>
                  </div>
                  <Badge className={inquiryStatusClasses[inquiryThread?.inquiry?.status] || inquiryStatusClasses.open}>
                    {(inquiryThread?.inquiry?.status || "open").replace(/_/g, " ")}
                  </Badge>
                </div>

                <div ref={messagesContainerRef} className="h-[480px] space-y-3 overflow-y-auto rounded-xl border border-border bg-muted/10 p-4">
                  {(inquiryThread?.messages || []).map((message) => {
                    const isOwnMessage =
                      (message.sender_user_id && user?.id && message.sender_user_id === user.id) ||
                      (message.sender_email && user?.email && message.sender_email.toLowerCase() === user.email.toLowerCase()) ||
                      message.sender_type === "guest";

                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[88%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                            isOwnMessage
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-background text-foreground"
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

                <form className="space-y-3" onSubmit={handleReply}>
                  {isInquiryClosed ? (
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      This inquiry is closed. Messaging is no longer available because the conversation is done.
                    </div>
                  ) : null}

                  <div>
                    <Label htmlFor="contact-reply">Reply</Label>
                    <Textarea
                      id="contact-reply"
                      rows={5}
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      onKeyDown={handleReplyKeyDown}
                      placeholder="Type your follow-up message here."
                      disabled={isInquiryClosed || isReplying}
                    />
                  </div>
                  <Button type="submit" className="gap-2" disabled={isInquiryClosed || isReplying}>
                    {isReplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isInquiryClosed ? "Inquiry Closed" : "Send Reply"}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      ) : null}
    </div>
  );
}
