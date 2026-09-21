import React, { useState, useRef, useEffect } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Loader2, TreePalm } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RESORT_CONTACT } from "@/lib/resortContact";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const QUICK_QUESTIONS = [
  "How do I reserve?",
  "What do I need to book?",
  "How do I pay for a reservation?",
  "Can I book for a group?",
  "How do I check availability?",
  "How do I contact the resort?",
];

const groupPackagesByName = (packages) => {
  const grouped = new Map();

  packages.forEach((pkg) => {
    if (!grouped.has(pkg.name)) {
      grouped.set(pkg.name, []);
    }

    grouped.get(pkg.name).push(pkg);
  });

  return [...grouped.entries()].map(([name, packageOptions]) => ({
    name,
    options: packageOptions.sort((left, right) => {
      const order = { day_tour: 0, night_tour: 1, "22_hours": 2 };
      return (order[left.tour_type] ?? 99) - (order[right.tour_type] ?? 99);
    }),
  }));
};

const buildLocalResponse = (message, packages, siteSettings) => {
  const prompt = message.toLowerCase();
  const groupedPackages = groupPackagesByName(packages || []);
  const siteName = siteSettings?.site_name?.trim() || "Kasa Ilaya";
  const termsSummary = siteSettings?.terms_summary?.trim() || "Bookings are subject to availability and admin confirmation.";

  if (prompt.includes("what is") || prompt.includes("about") || prompt.includes("who are") || prompt.includes("website")) {
    return `${siteName} Resort & Event Place is a booking website for resort stays, private gatherings, and event planning. The public site includes Home, About, Contact, Packages, Amenities, upcoming schedules, reviews, and resort rules. Guests can also send inquiries through the Contact page and continue the conversation there.`;
  }

  if (prompt.includes("amenity") || prompt.includes("amenities")) {
    const amenities = Array.isArray(siteSettings?.amenities) ? siteSettings.amenities : [];

    if (amenities.length === 0) {
      return "You can open the Amenities page to view resort facilities and available amenities.";
    }

    const lines = amenities.slice(0, 6).map((item) => `- ${item.title || "Amenity"}${item.desc ? `: ${item.desc}` : ""}`);
    return `Here are some resort amenities:\n${lines.join("\n")}\n\nYou can open the Amenities page to see more details.`;
  }

  if (prompt.includes("package") || prompt.includes("price") || prompt.includes("tour")) {
    if (groupedPackages.length === 0) {
      return "No packages are available right now. Please check the Packages page again later.";
    }

    const lines = groupedPackages.map(({ name, options }) => {
      const variants = options
        .map((pkg) => {
          const label = pkg.tour_type === "day_tour" ? "Day Tour" : pkg.tour_type === "night_tour" ? "Night Tour" : "22 Hours";
          return `${label}: PHP ${Number(pkg.price || 0).toLocaleString()} for up to ${pkg.max_guests} guests`;
        })
        .join(" | ");

      return `- ${name}: ${variants}`;
    });

    return `Here are the available resort packages:\n${lines.join("\n")}\n\nYou can open the Packages page to compare them and proceed to booking.`;
  }

  if (prompt.includes("new") || prompt.includes("first time") || prompt.includes("beginner") || prompt.includes("help me")) {
    return "If you are a new guest, the reservation process is simple: sign in, choose a package, select your preferred date and tour type, enter your details, pay the reservation fee, and upload the proof of payment. After that, the admin will review and confirm your booking.";
  }

  if (prompt.includes("how do i reserve") || prompt.includes("how to reserve") || prompt.includes("how to book") || prompt.includes("how do i book") || prompt.includes("reservation process")) {
    return "To reserve a slot, follow these steps:\n1. Sign in to your account.\n2. Open the Packages page and choose your preferred package.\n3. Select the date and tour type.\n4. Fill in the guest details and any special requests.\n5. Complete the payment and upload your receipt.\n6. Wait for admin review and confirmation.\n\nOnly one active reservation is allowed for the same package, date, and tour type.";
  }

  if (prompt.includes("need") || prompt.includes("requirements")) {
    if (prompt.includes("book") || prompt.includes("reservation") || prompt.includes("reserve")) {
      return "To make a reservation, you usually need an account, a selected package, your preferred date, the number of guests, and proof of payment. For special group requests, it is best to contact the resort directly.";
    }
  }

  if (prompt.includes("book") || prompt.includes("reservation") || prompt.includes("reserve")) {
    return `To book the resort, sign in first, open the Packages page, choose your preferred package, select the date and tour type, fill in the guest details, and upload your reservation payment receipt. Because this is a private resort, only one active reservation is allowed for a package date and tour type.`;
  }

  if (prompt.includes("payment") || prompt.includes("receipt") || prompt.includes("gcash") || prompt.includes("maya") || prompt.includes("pay")) {
    return `The booking flow includes a payment step where you upload your receipt for verification. Admin reviews the reservation payment before the booking is confirmed, and the payment status changes after verification. Follow the payment instructions shown during booking and upload your proof of payment.`;
  }

  if (prompt.includes("available") || prompt.includes("availability") || prompt.includes("date")) {
    return "The calendar uses live reservation availability. Reserved dates cannot be booked, and the package cards also show whether a package is available or reserved today.";
  }

  if (prompt.includes("group") || prompt.includes("guests") || prompt.includes("event") || prompt.includes("large")) {
    return "For larger groups or special event requests, please contact the resort through the Contact page so the team can help you with availability and booking details.";
  }

  if (prompt.includes("rebook") || prompt.includes("reschedule")) {
    return "You can request rebooking from My Booking when the reservation is pending or confirmed. Policy: one approved rebooking per reservation, request at least 7 days before the reservation date, and choose an available date for the same package and tour type. The original date stays active until admin approval.";
  }

  if (prompt.includes("cancel") || prompt.includes("change")) {
    return "For cancellations, open My Booking to see available actions. Rebooking requests can also be submitted there when the booking is eligible.";
  }

  if (prompt.includes("inquiry") || prompt.includes("message") || prompt.includes("chat with admin") || prompt.includes("contact form")) {
    return "You can send an inquiry on the Contact page by filling out your name, email, subject, and message. The site now saves your inquiry in the database, and you can continue the conversation on the same Contact page. Admin and super admin can read and reply to inquiries from their inbox.";
  }

  if (prompt.includes("contact") || prompt.includes("location") || prompt.includes("where") || prompt.includes("map") || prompt.includes("phone") || prompt.includes("email")) {
    return `You can contact the resort through the Contact page or directly using these details:\n- Phone: ${RESORT_CONTACT.phoneDisplay}\n- Email: ${RESORT_CONTACT.email}\n- Address: ${RESORT_CONTACT.address}\n- Hours: ${RESORT_CONTACT.hours}\nThe Contact page also includes a Google Map and inquiry messaging.`;
  }

  if (prompt.includes("schedule") || prompt.includes("calendar") || prompt.includes("event")) {
    return "The website shows upcoming schedules and reserved dates so guests can see planned events and current availability. Admin can also manage schedules from the calendar tools in the admin area.";
  }

  if (prompt.includes("review") || prompt.includes("testimonial") || prompt.includes("feedback")) {
    return "The home page shows verified guest reviews so visitors can read real feedback from previous stays and resort experiences.";
  }

  if (prompt.includes("rule") || prompt.includes("terms") || prompt.includes("policy")) {
    return `The website includes resort rules and booking terms. Summary: ${termsSummary}`;
  }

  if (prompt.includes("admin") || prompt.includes("super admin") || prompt.includes("staff")) {
    return "Admin tools are separate from the public site. Staff can manage bookings, schedules, and inquiries, while super admin has broader access such as user permissions, system settings, security settings, and activity logs.";
  }

  if (prompt.includes("lost") || prompt.includes("found")) {
    return "This website does not currently include a Lost and Found section. I can still help with packages, booking, contact inquiries, schedules, reviews, and resort information.";
  }

  return null;
};

export default function Chatbot() {
  const { settings: siteSettings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Welcome to Kasa Ilaya Resort. Please choose a quick message below."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["chatbot-packages"],
    queryFn: () => baseClient.entities.Package.filter({ is_active: true }, "name"),
    staleTime: 60000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setShowHint(false);
      return;
    }

    setShowHint(true);

    let showTimeout;
    let hideTimeout;

    const runHintCycle = () => {
      setShowHint(true);

      hideTimeout = window.setTimeout(() => {
        setShowHint(false);
      }, 5000);

      showTimeout = window.setTimeout(runHintCycle, 10000);
    };

    runHintCycle();

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [open]);

  const processMessage = async (rawMessage) => {
    if (!rawMessage.trim() || loading) return;
    const userMsg = { role: "user", content: rawMessage.trim() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const localResponse = buildLocalResponse(rawMessage, packages, siteSettings);
      if (localResponse) {
        setMessages(prev => [...prev, { role: "assistant", content: localResponse }]);
        return;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Please choose one of the quick messages below."
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Please choose one of the quick messages below."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 sm:bottom-6 sm:right-6">
        <div
          className={`pointer-events-none hidden max-w-[14rem] rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-all duration-500 sm:block ${
            showHint ? "translate-x-0 scale-100 opacity-100" : "translate-x-3 scale-95 opacity-0"
          }`}
          aria-hidden={!showHint}
        >
          Kasa Ilaya Will
          Assist You
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:h-14 sm:w-14"
          aria-label={open ? "Close chatbot" : "Open chatbot"}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
      </div>

      {/* Chat window */}
      {open && (
        <div className="fixed inset-x-3 bottom-20 z-50 flex h-[min(70vh,520px)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[480px] sm:w-[360px] sm:max-w-[calc(100vw-48px)]">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
            <TreePalm className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Kasa Ilaya Assistant</p>
              <p className="text-xs opacity-80">Quick messages only</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg rounded-bl-md bg-muted px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {!loading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => processMessage(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

        </div>
      )}
    </>
  );
}
