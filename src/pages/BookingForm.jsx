import React, { useMemo, useState, useEffect } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarCheck, User, Mail, Phone, Loader2,
  ArrowLeft, CheckCircle2, Clock, Upload, QrCode, ShieldCheck, Sparkles
} from "lucide-react";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useResortRules } from "@/hooks/useResortRules";

const MAX_BOOKINGS_PER_SLOT = 1;

const tourTypeLabels = {
  day_tour: { label: "Day Tour", time: "8 AM - 6 PM" },
  night_tour: { label: "Night Tour", time: "6 PM - 6 AM" },
  "22_hours": { label: "22 Hours", time: "6 PM – 4 PM (Next Day)" },
};

const getPackagePriceByTourType = (pkg, tourType) => {
  if (!pkg || !tourType) {
    return Number(pkg?.price || 0);
  }

  if (tourType === 'day_tour') {
    return Number(pkg.day_tour_price ?? pkg.price ?? 0);
  }

  if (tourType === 'night_tour') {
    return Number(pkg.night_tour_price ?? pkg.price ?? 0);
  }

  if (tourType === '22_hours') {
    return Number(pkg.twenty_two_hour_price ?? pkg.price ?? 0);
  }

  return Number(pkg.price || 0);
};

const FALLBACK_PACKAGE_IMAGE = "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&q=80";
const defaultTour = { label: "Choose a tour type", time: "Select inside the booking modal" };
const PAYMENT_POLICY_NOTICE = "Reservation fees are non-refundable. Guests may cancel while the booking is still pending, but cancellation is no longer allowed once the booking is marked paid or approved by the resort. Approved rebooking keeps the same payment on the new reservation date.";
const RECEIPT_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
const RECEIPT_MIN_BYTES = 12 * 1024;
const ADDITIONAL_GUEST_RATE = 250;
const PAYMENT_TYPE_LABELS = {
  downpayment: "Downpayment",
  full_payment: "Full Payment",
};

const analyzeReceiptImage = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    try {
      const { naturalWidth: width, naturalHeight: height } = image;
      URL.revokeObjectURL(url);

      if (width < 360 || height < 360) {
        resolve({ valid: false, reason: "The receipt image is too small to review clearly." });
        return;
      }

      if (width > 8000 || height > 8000) {
        resolve({ valid: false, reason: "The receipt image is too large. Please upload a clearer compressed screenshot." });
        return;
      }

      const ratio = width / height;
      if (ratio > 0.98) {
        resolve({ valid: false, reason: "Upload a portrait payment receipt screenshot. Landscape images are automatically declined." });
        return;
      }

      if (ratio < 0.28) {
        resolve({ valid: false, reason: "The image shape does not look like a readable payment receipt screenshot." });
        return;
      }

      const sampleWidth = 120;
      const sampleHeight = 120;
      const canvas = document.createElement("canvas");
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        resolve({ valid: true });
        return;
      }

      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
      const grays = [];
      let total = 0;

      for (let index = 0; index < data.length; index += 4) {
        const gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
        grays.push(gray);
        total += gray;
      }

      const mean = total / grays.length;
      const variance = grays.reduce((sum, gray) => sum + ((gray - mean) ** 2), 0) / grays.length;
      const contrast = Math.sqrt(variance);
      let edgePixels = 0;

      for (let y = 1; y < sampleHeight; y += 1) {
        for (let x = 1; x < sampleWidth; x += 1) {
          const current = grays[(y * sampleWidth) + x];
          const left = grays[(y * sampleWidth) + x - 1];
          const above = grays[((y - 1) * sampleWidth) + x];
          if (Math.abs(current - left) + Math.abs(current - above) > 32) {
            edgePixels += 1;
          }
        }
      }

      const edgeDensity = edgePixels / ((sampleWidth - 1) * (sampleHeight - 1));

      if (mean < 18 || mean > 246 || contrast < 10 || edgeDensity < 0.025) {
        resolve({ valid: false, reason: "The image does not contain enough readable receipt detail." });
        return;
      }

      resolve({ valid: true });
    } catch {
      URL.revokeObjectURL(url);
      resolve({ valid: false, reason: "The receipt image could not be inspected." });
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    resolve({ valid: false, reason: "The uploaded file is not a readable receipt image." });
  };

  image.src = url;
});

const validateReceiptFile = async (file) => {
  if (!RECEIPT_ALLOWED_TYPES.has(file.type)) {
    return { valid: false, reason: "Upload a JPG, PNG, or WebP receipt image only. PDF and document files are not accepted." };
  }

  if (file.size < RECEIPT_MIN_BYTES) {
    return { valid: false, reason: "The file is too small to be a readable payment receipt." };
  }

  if (file.size > RECEIPT_MAX_BYTES) {
    return { valid: false, reason: "The file is larger than 8 MB. Please upload a compressed receipt image." };
  }

  return analyzeReceiptImage(file);
};

export default function BookingForm() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const packageId = urlParams.get("packageId");

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTour, setSelectedTour] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    guest_count: 1,
    special_requests: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(null);
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [paymentType, setPaymentType] = useState("downpayment");
  const [selectedQrCodeId, setSelectedQrCodeId] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptValidation, setReceiptValidation] = useState(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [selectedPackageImage, setSelectedPackageImage] = useState("");
  const { rules } = useResortRules();
  const { settings: siteSettings } = useSiteSettings();
  const termsTitle = siteSettings?.terms_title?.trim() || "Terms and Conditions";
  const termsSummary = siteSettings?.terms_summary?.trim() || "Review the full booking terms before you continue.";
  const termsSections = useMemo(() => {
    const content = siteSettings?.terms_content?.trim() || "";

    return content
      .split(/\n\s*\n/)
      .map((section) => section.trim())
      .filter(Boolean);
  }, [siteSettings?.terms_content]);

  useEffect(() => {
    baseClient.auth.me().then(u => {
      setUser(u);
      setForm(prev => ({
        ...prev,
        customer_name: u.full_name || "",
        customer_email: u.email || "",
        customer_phone: u.phone || prev.customer_phone,
      }));
    }).catch(() => {
      baseClient.auth.redirectToLogin(window.location.href);
    }).finally(() => {
      setIsCheckingAuth(false);
    });
  }, []);

  const { data: pkg } = useQuery({
    queryKey: ["package", packageId],
    queryFn: async () => {
      const pkgs = await baseClient.entities.Package.filter({ id: packageId });
      return pkgs[0];
    },
    enabled: !!packageId,
  });

  useEffect(() => {
    if (!pkg?.max_guests) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      guest_count: Math.min(Math.max(prev.guest_count || 1, 1), pkg.max_guests),
    }));
  }, [pkg?.max_guests]);

  const { data: existingBookings = [], isLoading: isLoadingAvailability } = useQuery({
    queryKey: ["booking-availability"],
    queryFn: () => baseClient.entities.Booking.filter({
      status: ["pending", "confirmed", "completed"],
    }),
    refetchInterval: 15000,
  });

  const { data: manualSchedules = [] } = useQuery({
    queryKey: ["upcoming-schedules"],
    queryFn: () => baseClient.entities.UpcomingSchedule.list("schedule_date", 500),
    refetchInterval: 30000,
  });

  const { data: qrCodeRecords = [], isLoading: isLoadingQrCodes } = useQuery({
    queryKey: ["booking-payment-qr-codes"],
    queryFn: () => baseClient.entities.PaymentQrCode.list("display_order", 10),
  });

  const activeQrCodes = qrCodeRecords
    .filter((entry) => entry.is_active !== false && entry.is_active !== 0 && entry.is_active !== "0")
    .sort((left, right) => (left.display_order ?? 99) - (right.display_order ?? 99));

  useEffect(() => {
    if (!activeQrCodes.length) {
      setSelectedQrCodeId("");
      return;
    }

    if (!selectedQrCodeId || !activeQrCodes.some((entry) => entry.id === selectedQrCodeId)) {
      setSelectedQrCodeId(activeQrCodes[0].id);
    }
  }, [activeQrCodes, selectedQrCodeId]);

  const packageGalleryImages = useMemo(() => {
    const images = [];

    if (pkg?.image_url) {
      images.push(pkg.image_url);
    }

    if (Array.isArray(pkg?.gallery_images)) {
      for (const imageUrl of pkg.gallery_images) {
        if (typeof imageUrl === "string" && imageUrl.trim()) {
          images.push(imageUrl.trim());
        }
      }
    }

    const uniqueImages = Array.from(new Set(images));
    return uniqueImages.length ? uniqueImages : [FALLBACK_PACKAGE_IMAGE];
  }, [pkg?.gallery_images, pkg?.image_url]);

  useEffect(() => {
    if (!packageGalleryImages.length) {
      setSelectedPackageImage(FALLBACK_PACKAGE_IMAGE);
      return;
    }

    if (!selectedPackageImage || !packageGalleryImages.includes(selectedPackageImage)) {
      setSelectedPackageImage(packageGalleryImages[0]);
    }
  }, [packageGalleryImages, selectedPackageImage]);

  // All booking start dates across resort packages (all tour types)
  const allBookingDatesSet = useMemo(
    () => new Set(existingBookings.map(b => b.booking_date).filter(Boolean)),
    [existingBookings]
  );

  // 22-hour bookings block their start date AND the following calendar day
  const twentyTwoHourBlockedDates = useMemo(() => {
    const blocked = new Set();
    existingBookings
      .filter(b => b.tour_type === '22_hours')
      .forEach(b => {
        if (!b.booking_date) return;
        blocked.add(b.booking_date);
        blocked.add(format(addDays(new Date(`${b.booking_date}T00:00:00`), 1), 'yyyy-MM-dd'));
      });
    return blocked;
  }, [existingBookings]);

  const manualScheduleDatesSet = useMemo(
    () => new Set(manualSchedules.map((schedule) => schedule.schedule_date).filter(Boolean)),
    [manualSchedules]
  );

  // Calendar visual markers: all occupied dates plus manual schedules managed by admins.
  const reservedDates = useMemo(() => {
    const combined = new Set([...allBookingDatesSet, ...twentyTwoHourBlockedDates, ...manualScheduleDatesSet]);
    return Array.from(combined).map(d => new Date(`${d}T00:00:00`));
  }, [allBookingDatesSet, twentyTwoHourBlockedDates, manualScheduleDatesSet]);

  // Checkout date for 22-hour stays (automatically the next calendar day)
  const checkoutDate = selectedTour === '22_hours' && selectedDate
    ? addDays(selectedDate, 1)
    : null;

  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    const dateStr = format(date, 'yyyy-MM-dd');

    if (manualScheduleDatesSet.has(dateStr)) return true;
    if (!selectedTour) return false;

    if (selectedTour === '22_hours') {
      // 22-hour stay needs BOTH the check-in day AND the next day to be free
      const nextDayStr = format(addDays(date, 1), 'yyyy-MM-dd');
      const startOccupied = allBookingDatesSet.has(dateStr) || twentyTwoHourBlockedDates.has(dateStr) || manualScheduleDatesSet.has(dateStr);
      const nextOccupied = allBookingDatesSet.has(nextDayStr) || twentyTwoHourBlockedDates.has(nextDayStr) || manualScheduleDatesSet.has(nextDayStr);
      return startOccupied || nextOccupied;
    }

    // Day tour / night tour: blocked if a 22-hour stay covers this date, or if any package already reserved the date
    if (twentyTwoHourBlockedDates.has(dateStr)) return true;
    const count = existingBookings.filter(
      b => b.booking_date === dateStr
    ).length;
    return count >= MAX_BOOKINGS_PER_SLOT;
  };

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const isSelectedDateManuallyBlocked = Boolean(selectedDateKey && manualScheduleDatesSet.has(selectedDateKey));
  const isSelectedDateFull = selectedDate ? isDateDisabled(selectedDate) : false;
  const isCustomerInfoComplete = Boolean(form.customer_name && form.customer_email && form.customer_phone);
  const displayStep = isBookingModalOpen ? modalStep + 1 : 1;
  const modalStepDetails = {
    1: {
      title: "Booking Details",
      description: "Confirm the reservation date and fill in your customer details before continuing.",
    },
    2: {
      title: "Review Booking",
      description: "Double-check your reservation summary before choosing your payment.",
    },
    3: {
      title: "Payment",
      description: "Choose downpayment or full payment, select your payment method, and upload proof.",
    },
    4: {
      title: "Terms and Conditions",
      description: "Review and accept the terms before final booking submission.",
    },
  };

  const handleBookingModalChange = (open) => {
    if (!open && submitting) {
      return;
    }

    setIsBookingModalOpen(open);

    if (!open) {
      setModalStep(1);
    }
  };

  const clearReceiptUpload = () => {
    setReceiptUrl("");
    setReceiptValidation(null);
    setAgreedToRules(false);
  };

  const handleSubmit = async () => {
    if (!user) {
      baseClient.auth.redirectToLogin(window.location.href);
      return;
    }

    if (!selectedTour) {
      toast.error("Please select a tour type.");
      return;
    }

    if (!selectedDate || isSelectedDateFull) {
      toast.error("Selected date is no longer available. Please choose another date.");
      return;
    }

    if (!activeQrCodes.length) {
      toast.error("No payment QR code is available right now. Please contact the resort first.");
      return;
    }

    if (!selectedQrCodeId) {
      toast.error("Please select a payment QR code.");
      return;
    }

    if (!receiptUrl) {
      toast.error("Please upload your payment proof before submitting.");
      return;
    }

    if (receiptValidation?.status !== "accepted") {
      toast.error("Please upload a valid receipt image before submitting.");
      return;
    }

    if (!agreedToRules) {
      toast.error("Please agree to the resort rules and terms before submitting your booking.");
      return;
    }

    setSubmitting(true);

    try {
      const ref = "KI-" + Date.now().toString(36).toUpperCase();
      const tourType = selectedTour;
      const basePrice = getPackagePriceByTourType(pkg, tourType);
      const additionalGuestCount = Math.max(Number(form.guest_count || 1) - 1, 0);
      const additionalGuestAmount = additionalGuestCount * ADDITIONAL_GUEST_RATE;
      const selectedPrice = basePrice + additionalGuestAmount;
      const reservationFee = Number((selectedPrice * 0.15).toFixed(2));
      const paymentAmountDue = paymentType === "full_payment" ? selectedPrice : reservationFee;
      const selectedQrCode = activeQrCodes.find((entry) => entry.id === selectedQrCodeId);

      const booking = await baseClient.entities.Booking.create({
        booking_reference: ref,
        package_id: packageId,
        package_name: pkg?.name,
        tour_type: tourType,
        booking_date: format(selectedDate, "yyyy-MM-dd"),
        guest_count: form.guest_count,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        special_requests: form.special_requests,
        total_amount: selectedPrice,
        status: "pending",
        payment_status: "pending_verification",
        payment_type: paymentType,
        payment_amount_due: paymentAmountDue,
        payment_mode: selectedQrCode?.label,
        reservation_fee_amount: reservationFee,
        payment_qr_code_id: selectedQrCode?.id,
        payment_qr_code_label: selectedQrCode?.label,
        receipt_url: receiptUrl,
      });

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email || form.customer_email,
        user_name: user?.full_name || form.customer_name,
        action: "Created Booking",
        entity_type: "Booking",
        entity_id: booking.id,
        details: `Booked ${pkg?.name} for ${format(selectedDate, "MMM d, yyyy")}`,
      });

      let emailResult = { sent: true, error: "" };

      if (typeof window !== "undefined" && window.__KASA_ENABLE_CLIENT_BOOKING_EMAIL__ === true) {
      try {
        emailResult = await baseClient.integrations.Core.SendEmail({
          to: form.customer_email,
          subject: `Booking Request Received - ${ref} | Kasa Ilaya Resort`,
          body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Georgia',serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2d7a4f,#1e5c39);padding:40px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:1px;">🌴 Kasa Ilaya</div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Resort & Event Place</div>
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:16px 24px;margin-top:24px;display:inline-block;">
        <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Booking Reference</div>
        <div style="color:#ffffff;font-size:28px;font-weight:bold;font-family:monospace;letter-spacing:3px;">${ref}</div>
      </div>
    </div>

    <!-- Status Banner -->
    <div style="background:#fff8e6;border-left:4px solid #f59e0b;padding:14px 32px;font-size:13px;color:#92400e;">
      ⏳ <strong>Pending Verification</strong> — Our team will verify your ${PAYMENT_TYPE_LABELS[paymentType].toLowerCase()} payment within 24 hours and send you a confirmation.
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 24px;font-size:16px;color:#374151;">Dear <strong>${form.customer_name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
        Thank you for choosing Kasa Ilaya Resort & Event Place. We've received your booking request. Here are your booking details:
      </p>

      <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#9a3412;line-height:1.7;">
        <strong>Payment Policy:</strong> {PAYMENT_POLICY_NOTICE}
      </div>

      <!-- Details Table -->
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;width:40%;">Package</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${pkg?.name}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Tour Type</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${tourTypeLabels[tourType]?.label} (${tourTypeLabels[tourType]?.time})</td>
        </tr>
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;">Check-in</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${format(selectedDate, "EEEE, MMMM d, yyyy")}</td>
        </tr>
        ${tourType === '22_hours' ? `<tr>
          <td style="padding:12px 16px;color:#6b7280;">Check-out</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${format(addDays(selectedDate, 1), "EEEE, MMMM d, yyyy")}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Total Guests</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${form.guest_count} guest(s)</td>
        </tr>
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;">Additional Guests</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${additionalGuestCount} guest(s) x ₱${ADDITIONAL_GUEST_RATE.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Guest Name</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${form.customer_name}</td>
        </tr>
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;">Phone</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${form.customer_phone}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Booking Status</td>
          <td style="padding:12px 16px;"><span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Pending Confirmation</span></td>
        </tr>
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;">Additional Guest Fee</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">₱${additionalGuestAmount.toLocaleString()} (₱${ADDITIONAL_GUEST_RATE.toLocaleString()} per person)</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Reservation Fee</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">₱${reservationFee.toLocaleString()} (15%)</td>
        </tr>
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;">Payment Type</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${PAYMENT_TYPE_LABELS[paymentType]}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Amount for Verification</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">PHP ${paymentAmountDue.toLocaleString()}</td>
        </tr>
        <tr style="background:#f9f7f4;">
          <td style="padding:12px 16px;color:#6b7280;">Payment Channel</td>
          <td style="padding:12px 16px;font-weight:600;color:#111827;">${selectedQrCode?.label || "QR Payment"}</td>
        </tr>
        <tr style="border-top:2px solid #2d7a4f;">
          <td style="padding:16px;font-weight:bold;font-size:16px;color:#111827;">Total Amount</td>
          <td style="padding:16px;font-weight:bold;font-size:20px;color:#c47a1e;">₱${selectedPrice.toLocaleString()}</td>
        </tr>
      </table>

      ${form.special_requests ? `<div style="background:#f0fdf4;border-radius:8px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#374151;"><strong>Special Requests:</strong> ${form.special_requests}</div>` : ""}

      <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
        <div style="font-size:13px;color:#374151;line-height:1.7;">
          📍 Kasa Ilaya Resort & Event Place<br>
          Keep this email for your booking reference.<br>
          Present your reference code <strong style="color:#2d7a4f;">${ref}</strong> upon arrival.
        </div>
      </div>

      <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0;">Questions? Reply to this email or contact us directly.</p>
    </div>

    <!-- Footer -->
    <div style="background:#f9f7f4;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <div style="font-size:12px;color:#9ca3af;">© 2024 Kasa Ilaya Resort & Event Place. All rights reserved.</div>
      <div style="font-size:20px;margin-top:8px;">🌴</div>
    </div>
  </div>
</body>
</html>
          `,
        });
      } catch (emailError) {
        emailResult = {
          sent: false,
          error: emailError?.message || "The booking was saved, but the email notification failed.",
        };
      }
      }

      setBookingComplete({
        ...booking,
        email_sent: Boolean(emailResult?.sent),
        email_error: emailResult?.error || "",
        reservation_fee_amount: reservationFee,
        payment_type: paymentType,
        payment_amount_due: paymentAmountDue,
        payment_mode: selectedQrCode?.label || "",
        payment_qr_code_label: selectedQrCode?.label || "",
      });

      if (emailResult?.sent) {
        toast.success("Booking submitted. Email notification will be processed by the resort system.");
      } else {
        toast.warning(emailResult?.error || "Booking submitted, but the email notification was not delivered.");
      }
    } catch (error) {
      toast.error(error?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isCheckingAuth || !user) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tour = selectedTour ? tourTypeLabels[selectedTour] : defaultTour;
  const baseDisplayedPrice = selectedTour
    ? getPackagePriceByTourType(pkg, selectedTour)
    : Number(pkg?.price ?? pkg?.day_tour_price ?? 0);
  const additionalGuestCount = Math.max(Number(form.guest_count || 1) - 1, 0);
  const additionalGuestAmount = additionalGuestCount * ADDITIONAL_GUEST_RATE;
  const displayedPrice = baseDisplayedPrice + additionalGuestAmount;
  const reservationFee = Number((displayedPrice * 0.15).toFixed(2));
  const paymentAmountDue = paymentType === "full_payment" ? displayedPrice : reservationFee;
  const selectedPaymentQrCode = activeQrCodes.find((entry) => entry.id === selectedQrCodeId);

  const handleReceiptUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingReceipt(true);
    setReceiptUrl("");
    setReceiptValidation({ status: "checking", message: "Checking if the file looks like a valid receipt..." });
    setAgreedToRules(false);

    try {
      const validation = await validateReceiptFile(file);
      if (!validation.valid) {
        setReceiptValidation({ status: "rejected", message: validation.reason });
        toast.error(`Payment proof rejected: ${validation.reason}`);
        return;
      }

      const { file_url } = await baseClient.integrations.Core.UploadFile({ file, purpose: "payment_receipt" });
      setReceiptUrl(file_url);
      setReceiptValidation({ status: "accepted", message: "Receipt image passed the automatic file check." });
      toast.success("Payment receipt uploaded and accepted.");
    } catch (error) {
      setReceiptValidation({ status: "rejected", message: error?.message || "Unable to upload payment proof." });
      toast.error(error?.message || "Unable to upload payment proof.");
    } finally {
      setIsUploadingReceipt(false);
      event.target.value = "";
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setAgreedToRules(false);

    if (!date || isDateDisabled(date)) {
      return;
    }

    setModalStep(1);
    setIsBookingModalOpen(true);
  };

  const handleAcceptPolicy = () => {
    setAgreedToRules(true);
    setIsPolicyDialogOpen(false);
  };

  const handleDeclinePolicy = () => {
    setAgreedToRules(false);
    setIsPolicyDialogOpen(false);
  };

  if (bookingComplete) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Booking Submitted</h2>
              <p className="text-muted-foreground mb-6">Your reservation has been submitted successfully</p>
              <div className="mb-6 space-y-2 rounded-lg bg-muted p-4 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-bold text-primary">{bookingComplete.booking_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-medium">{pkg.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span className="font-medium">{format(selectedDate, "MMM d, yyyy")}</span>
                </div>
                {checkoutDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out</span>
                    <span className="font-medium">{format(checkoutDate, "MMM d, yyyy")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-secondary">₱{displayedPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reservation Fee</span>
                  <span className="font-bold text-primary">₱{Number(bookingComplete.reservation_fee_amount || reservationFee).toLocaleString()} (15%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Type</span>
                  <span className="font-medium">{PAYMENT_TYPE_LABELS[bookingComplete.payment_type] || "Downpayment"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Submitted</span>
                  <span className="font-bold text-primary">₱{Number(bookingComplete.payment_amount_due || reservationFee).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode of Payment</span>
                  <span className="font-medium">{bookingComplete.payment_mode || bookingComplete.payment_qr_code_label || "QR Payment"}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {bookingComplete.email_sent
                  ? <>A booking confirmation email has been sent to <strong>{form.customer_email}</strong>.</>
                  : <>Your booking was saved, but the email notification could not be delivered right now.</>}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Your payment proof was submitted and is now waiting for admin verification.
              </p>
              {!bookingComplete.email_sent && bookingComplete.email_error ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {bookingComplete.email_error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => navigate(createPageUrl("MyBookings"))}>
                  My Bookings
                </Button>
                <Button className="flex-1" onClick={() => navigate(createPageUrl("Home"))}>
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Steps */}
      <div className="mb-8 flex items-center justify-center gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5].map(s => (
          <React.Fragment key={s}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9 sm:text-sm ${displayStep >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s}
            </div>
            {s < 5 && <div className={`h-0.5 w-8 sm:w-12 ${displayStep > s ? "bg-primary" : "bg-muted"}`} />}
          </React.Fragment>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)] xl:items-start">
          <Card className="overflow-hidden xl:sticky xl:top-24">
            <div className="flex flex-col sm:flex-row xl:flex-col">
              <div className="h-64 sm:h-72 xl:h-96">
                <img
                  src={selectedPackageImage || packageGalleryImages[0] || FALLBACK_PACKAGE_IMAGE}
                  alt={pkg.name}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="flex-1 p-4 sm:p-5">
                {packageGalleryImages.length > 1 ? (
                  <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                    {packageGalleryImages.map((imageUrl, index) => (
                      <button
                        key={`gallery-${imageUrl}-${index}`}
                        type="button"
                        onClick={() => setSelectedPackageImage(imageUrl)}
                        className={`overflow-hidden rounded-md border transition ${selectedPackageImage === imageUrl ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                        title={`View photo ${index + 1}`}
                      >
                        <img
                          src={imageUrl}
                          alt={`${pkg.name} thumbnail ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-20 object-cover sm:h-16 sm:w-24"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                <h2 className="font-display text-2xl font-bold">{pkg.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="bg-primary/10 text-primary">{tour.label}</Badge>
                  <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{tour.time}</Badge>
                  <Badge className="bg-secondary text-secondary-foreground text-base font-bold">₱{displayedPrice.toLocaleString()}</Badge>
                </div>
              </CardContent>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Select Reservation Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={isDateDisabled}
                  modifiers={{
                    reserved: reservedDates,
                  }}
                  modifiersClassNames={{
                    reserved: "bg-destructive/15 text-destructive font-semibold ring-1 ring-destructive/40 line-through",
                  }}
                  classNames={{
                    months: "flex flex-col sm:flex-row justify-center gap-4",
                    month: "space-y-5",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-lg font-semibold",
                    nav_button: "h-10 w-10 bg-transparent p-0 opacity-60 hover:opacity-100",
                    head_cell: "text-muted-foreground rounded-md w-10 sm:w-14 font-normal text-sm",
                    row: "flex w-full mt-2 sm:mt-3",
                    cell: "h-10 w-10 sm:h-14 sm:w-14 text-center text-sm sm:text-base p-0 relative [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 focus-within:relative focus-within:z-20",
                    day: "h-9 w-9 sm:h-12 sm:w-12 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-lg",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                    day_outside: "day-outside text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-60",
                  }}
                  className="w-full max-w-[32rem] rounded-lg border p-3 sm:p-6"
                />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-destructive/20 ring-1 ring-destructive/40" />
                  <span>Reserved or blocked by manual event</span>
                </div>
              </div>
              {selectedDate && (
                <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-center">
                  <p className="text-sm text-primary font-medium">
                    Selected: {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedTour
                      ? isLoadingAvailability
                        ? "Checking live availability..."
                        : isSelectedDateManuallyBlocked
                          ? "Blocked by a manual resort event or admin schedule — please choose another date"
                          : isSelectedDateFull
                            ? "This date is already reserved for another package or tour type — please choose another date"
                          : checkoutDate
                            ? "2-day 1-night stay · 6 PM check-in, 4 PM checkout · available"
                            : "Available for reservation"
                      : isSelectedDateManuallyBlocked
                        ? "Blocked by a manual resort event or admin schedule — please choose another date"
                        : "Choose a tour type inside the booking modal to confirm availability."}
                  </p>
                </div>
              )}
              <div className="relative overflow-hidden rounded-lg border border-primary/15 bg-gradient-to-r from-primary/10 via-background to-secondary/10 px-5 py-5 shadow-sm">
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
                <div className="absolute -bottom-10 left-6 h-20 w-20 rounded-full bg-secondary/15 blur-2xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Reservation Guide
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-foreground sm:text-xl">
                    Finish your reservation inside the booking modal.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    After choosing a date, select your tour type, review the resort rules, add guest details, and continue to payment review.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-background/85 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CalendarCheck className="h-4 w-4 text-primary" />
                        Date first
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Click an available calendar date to open the guided booking flow instantly.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/85 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Important note
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        22-hour reservations also block the following day, so availability updates after you choose the tour type.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </motion.div>

      <Dialog open={isBookingModalOpen} onOpenChange={handleBookingModalChange}>
        <DialogContent className="flex w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 max-h-[92vh] sm:w-full">
          <DialogHeader className="border-b border-border px-4 py-4 text-left sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-10 sm:items-center sm:pr-8">
              <div>
                <DialogTitle className="font-display text-xl text-foreground sm:text-2xl">
                  {modalStepDetails[modalStep]?.title || "Booking Details"}
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {modalStepDetails[modalStep]?.description}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {[1, 2, 3, 4].map((stepNumber) => {

                  return (
                    <React.Fragment key={stepNumber}>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9 sm:text-sm ${modalStep >= stepNumber ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {stepNumber}
                      </div>
                      {stepNumber < 4 ? <div className={`h-0.5 w-8 sm:w-10 ${modalStep > stepNumber ? "bg-primary" : "bg-muted"}`} /> : null}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <AnimatePresence mode="wait">
              {modalStep === 1 && (
                <motion.div key="modal-step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="space-y-5">
                      <div className="rounded-lg border border-border bg-muted/30 p-5">
                        <h3 className="font-display text-lg font-semibold text-foreground">Reservation Details</h3>
                        <div className="mt-4 space-y-4">
                          <div>
                            <Label>Tour Type *</Label>
                            <Select value={selectedTour} onValueChange={(value) => {
                              setSelectedTour(value);
                              setAgreedToRules(false);
                            }}>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select tour type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="day_tour">☀️ Day Tour (8 AM - 6 PM)</SelectItem>
                                <SelectItem value="night_tour">🌙 Night Tour (6 PM - 6 AM)</SelectItem>
                                <SelectItem value="22_hours">⏰ 22 Hours (6 PM – 4 PM Next Day)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Selected date</span>
                              <span className="text-right font-medium text-foreground">{selectedDate && format(selectedDate, "MMM d, yyyy")}</span>
                            </div>
                            {selectedTour && checkoutDate ? (
                              <div className="mt-2 flex justify-between gap-4">
                                <span className="text-muted-foreground">Check-out</span>
                                <span className="text-right font-medium text-foreground">{format(checkoutDate, "MMM d, yyyy")}</span>
                              </div>
                            ) : null}
                            <p className="mt-3 text-muted-foreground">
                              {!selectedTour
                                ? "Select a tour type to confirm live availability for this date."
                                : isLoadingAvailability
                                  ? "Checking live availability..."
                                  : isSelectedDateFull
                                    ? "This date is already booked for another package or tour type. Please close the modal and choose another date."
                                    : checkoutDate
                                      ? "Available for a 22-hour stay with next-day checkout."
                                      : "Available for booking."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/30 p-5">
                        <h3 className="font-display text-lg font-semibold text-foreground">Customer Information</h3>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="name">Full Name *</Label>
                            <div className="relative mt-1">
                              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input id="name" className="pl-9" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder="Juan Dela Cruz" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="email">Email *</Label>
                            <div className="relative mt-1">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input id="email" type="email" className="pl-9" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} placeholder="email@example.com" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone Number *</Label>
                            <div className="relative mt-1">
                              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input id="phone" className="pl-9" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="09XX XXX XXXX" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="guests">Additional Number of Guests</Label>
                            <Select
                              value={String(additionalGuestCount)}
                              onValueChange={(value) => setForm({ ...form, guest_count: Number(value) + 1 })}
                            >
                              <SelectTrigger id="guests" className="mt-1">
                                <SelectValue placeholder="Select additional guests" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: Math.max(Number(pkg.max_guests || 1) - 1, 0) + 1 }, (_, index) => index).map((count) => (
                                  <SelectItem key={count} value={String(count)}>
                                    {count === 0 ? "No additional guests" : `${count} additional ${count === 1 ? "guest" : "guests"}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Additional guests are ₱{ADDITIONAL_GUEST_RATE.toLocaleString()} per person. Total guests allowed for this package: {pkg.max_guests || 1}.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor="requests">Special Requests (Optional)</Label>
                          <Textarea id="requests" className="mt-1" value={form.special_requests} onChange={e => setForm({ ...form, special_requests: e.target.value })} placeholder="Any special requests or notes..." rows={3} />
                        </div>
                      </div>

                    </div>

                    <div className="space-y-5">
                      <div className="rounded-lg border border-border bg-muted p-5">
                        <h3 className="font-display text-lg font-semibold text-foreground">Selected Reservation</h3>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Package</span>
                            <span className="text-right font-medium text-foreground">{pkg.name}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Tour Type</span>
                            <span className="text-right font-medium text-foreground">{selectedTour ? tour.label : "Not selected yet"}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Schedule</span>
                            <span className="text-right font-medium text-foreground">{selectedTour ? tour.time : "Choose a tour type first"}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Check-in</span>
                            <span className="text-right font-medium text-foreground">{selectedDate && format(selectedDate, "MMM d, yyyy")}</span>
                          </div>
                          {checkoutDate ? (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Check-out</span>
                              <span className="text-right font-medium text-foreground">{format(checkoutDate, "MMM d, yyyy")}</span>
                            </div>
                          ) : null}
                          <div className="border-t border-border pt-3 space-y-2">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Base Package Price</span>
                              <span className="text-right font-medium text-foreground">₱{baseDisplayedPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Additional Guests</span>
                              <span className="text-right font-medium text-foreground">{additionalGuestCount} x ₱{ADDITIONAL_GUEST_RATE.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Total Guests</span>
                              <span className="text-right font-medium text-foreground">{form.guest_count}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Additional Guest Fee</span>
                              <span className="text-right font-medium text-foreground">₱{additionalGuestAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-base font-semibold text-foreground">
                              <span>Total Amount</span>
                              <span className="text-secondary">₱{displayedPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-primary/15 bg-primary/5 p-5 text-sm text-muted-foreground">
                        The next step will show your booking review before payment.
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 mt-6 border-t border-border bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => handleBookingModalChange(false)}>
                        Back
                      </Button>
                      <Button className="flex-1" disabled={!selectedTour || isSelectedDateFull || !isCustomerInfoComplete} onClick={() => setModalStep(2)}>
                        Next: Review
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {modalStep === 2 && (
                <motion.div key="modal-step-review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-6">
                    <div className="rounded-lg bg-muted p-8 text-center">
                      <CalendarCheck className="h-20 w-20 mx-auto text-primary mb-4" />
                      <h3 className="font-display text-xl font-bold mb-2">Review Your Reservation</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        Confirm the details below before choosing your payment option.
                      </p>
                      <p className="text-3xl font-bold text-secondary">₱{displayedPrice.toLocaleString()}</p>
                    </div>

                    <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
                      <h4 className="font-semibold text-foreground">Booking Summary</h4>
                      <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span>{pkg.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tour</span><span>{tour.label}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span>{selectedDate && format(selectedDate, "MMM d, yyyy")}</span></div>
                      {checkoutDate && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span>{format(checkoutDate, "MMM d, yyyy")}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Guests</span><span>{form.guest_count}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Additional Guests</span><span>{additionalGuestCount}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{form.customer_name}</span></div>
                      <div className="border-t border-border my-2" />
                      <div className="flex justify-between"><span>Base Package Price</span><span>₱{baseDisplayedPrice.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Additional Guest Fee</span><span>₱{additionalGuestAmount.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Reservation Fee</span><span className="text-primary font-semibold">₱{reservationFee.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-secondary">₱{displayedPrice.toLocaleString()}</span></div>
                    </div>

                    <div className="sticky bottom-0 mt-6 border-t border-border bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="outline" onClick={() => setModalStep(1)}>
                          Back
                        </Button>
                        <Button className="flex-1" onClick={() => setModalStep(3)}>
                          Next: Payment
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {modalStep === 3 && (
                <motion.div key="modal-step-payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-6">
                    <div className="rounded-lg bg-muted p-8 text-center">
                      <QrCode className="h-20 w-20 mx-auto text-primary mb-4" />
                      <h3 className="font-display text-xl font-bold mb-2">Choose Your Payment</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        Select downpayment or full payment, choose a payment method, and upload your receipt.
                      </p>
                      <p className="text-3xl font-bold text-secondary">₱{displayedPrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Amount to pay now: ₱{paymentAmountDue.toLocaleString()} ({PAYMENT_TYPE_LABELS[paymentType]}).
                      </p>
                    </div>

                    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                      <div>
                        <h4 className="font-semibold text-foreground">Reservation Payment</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Choose whether to pay the downpayment or full amount, then select your payment mode and upload proof.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => {
                          const isSelected = paymentType === value;
                          const amount = value === "full_payment" ? displayedPrice : reservationFee;

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setPaymentType(value);
                                clearReceiptUpload();
                              }}
                              className={`rounded-lg border px-4 py-3 text-left transition-all ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border hover:border-primary/40"}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-foreground">{label}</span>
                                {isSelected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Pay ₱{amount.toLocaleString()}{value === "downpayment" ? " now, 15% of total amount." : " now, the full booking amount."}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {isLoadingQrCodes ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : activeQrCodes.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          No active payment QR code is available right now. Please contact the resort before submitting your reservation.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="payment-mode">Mode of Payment</Label>
                            <Select
                              value={selectedQrCodeId}
                              onValueChange={(value) => {
                                setSelectedQrCodeId(value);
                                clearReceiptUpload();
                              }}
                            >
                              <SelectTrigger id="payment-mode" className="mt-1">
                                <SelectValue placeholder="Select payment mode" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeQrCodes.map((code) => (
                                  <SelectItem key={code.id} value={code.id}>
                                    {code.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedPaymentQrCode ? (
                            <div className="overflow-hidden rounded-lg border border-primary/30 bg-card">
                              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
                                <div className="bg-white p-4">
                                  <img
                                    src={selectedPaymentQrCode.image_url}
                                    alt={selectedPaymentQrCode.label}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-40 w-full object-contain"
                                  />
                                </div>
                                <div className="space-y-1 border-t border-border bg-muted/30 p-4 text-sm sm:border-l sm:border-t-0">
                                  <p className="font-semibold text-foreground">{selectedPaymentQrCode.label}</p>
                                  <p className="text-muted-foreground">{selectedPaymentQrCode.account_name || "Account name not set"}</p>
                                  <p className="text-muted-foreground">{selectedPaymentQrCode.account_number || "Account number not set"}</p>
                                  {selectedPaymentQrCode.instructions ? <p className="pt-1 text-xs text-muted-foreground">{selectedPaymentQrCode.instructions}</p> : null}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Amount to pay now</span>
                          <span className="font-bold text-primary">₱{paymentAmountDue.toLocaleString()}</span>
                        </div>
                      </div>

                      <div>
                        <Label>Payment Proof *</Label>
                        <div className="mt-2 space-y-3">
                          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                            {isUploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            <span>{isUploadingReceipt ? "Checking receipt..." : "Upload portrait receipt image"}</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleReceiptUpload} disabled={isUploadingReceipt} />
                          </label>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG, or WebP portrait receipt screenshots only. Non-receipt files are rejected automatically.
                          </p>
                          {receiptValidation?.status === "checking" ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> {receiptValidation.message}
                            </div>
                          ) : null}
                          {receiptValidation?.status === "rejected" ? (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              Automatically declined: {receiptValidation.message}
                            </div>
                          ) : null}
                          {receiptUrl ? (
                            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                              <div className="flex items-center gap-2 text-primary">
                                <CheckCircle2 className="h-4 w-4" /> Receipt accepted for admin verification.
                              </div>
                              {receiptValidation?.message ? (
                                <p className="mt-1 text-xs text-muted-foreground">{receiptValidation.message}</p>
                              ) : null}
                              <a href={receiptUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
                                <QrCode className="h-4 w-4" /> View uploaded proof
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-0 border-t border-border bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">

                      <div className="mb-4 rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>
                            {receiptValidation?.status === "accepted"
                              ? "Payment receipt accepted. Continue to terms and conditions."
                              : "Upload an accepted payment receipt before continuing."}
                          </span>
                          <span className="flex items-center gap-2">
                            {receiptValidation?.status === "accepted" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setModalStep(2)}>
                          Back
                        </Button>
                        <Button className="flex-1" onClick={() => setModalStep(4)} disabled={isUploadingReceipt || !activeQrCodes.length || !selectedQrCodeId || !receiptUrl || receiptValidation?.status !== "accepted"}>
                          Next: Terms
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {modalStep === 4 && (
                <motion.div key="modal-step-terms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-5">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900">
                      <p className="font-semibold">Payment Policy</p>
                      <p className="mt-1">{PAYMENT_POLICY_NOTICE}</p>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-display text-lg font-semibold text-foreground">{termsTitle}</h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{termsSummary}</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsPolicyDialogOpen(true)}>
                          Read Full Terms
                        </Button>
                      </div>

                      <div className="mt-5 max-h-[36vh] space-y-5 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4 text-sm leading-7 text-muted-foreground">
                        {termsSections.length ? (
                          termsSections.map((section, index) => {
                            const [heading, ...bodyLines] = section.split("\n");
                            const hasBody = bodyLines.some((line) => line.trim());

                            return (
                              <div key={`${heading}-${index}`} className="space-y-2">
                                <p className="font-semibold uppercase tracking-[0.08em] text-foreground">
                                  {heading}
                                </p>
                                {hasBody ? (
                                  <div className="space-y-2">
                                    {bodyLines.filter((line) => line.trim()).map((line, lineIndex) => (
                                      <p key={`${heading}-${lineIndex}`}>{line}</p>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <p>No terms and conditions are configured yet.</p>
                        )}

                        <div className="border-t border-border pt-5">
                          <p className="font-semibold uppercase tracking-[0.08em] text-foreground">Resort Rules</p>
                          <div className="mt-3 space-y-4">
                            {rules.map((rule, index) => (
                              <div key={rule.title}>
                                <p className="font-medium text-foreground">{index + 1}. {rule.title}</p>
                                <p className="mt-1">{rule.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-0 mt-6 border-t border-border bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                      <div className="mb-4 rounded-lg border border-border bg-muted/20 p-4">
                        <label className="flex items-start gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={agreedToRules}
                            onChange={(event) => setAgreedToRules(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span>
                            I have read and agree to the terms and conditions, payment policy, and resort rules.
                          </span>
                        </label>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="outline" onClick={() => setModalStep(3)} disabled={submitting}>
                          Back
                        </Button>
                        <Button className="flex-1" onClick={handleSubmit} disabled={submitting || isUploadingReceipt || !activeQrCodes.length || !selectedQrCodeId || !receiptUrl || receiptValidation?.status !== "accepted" || !agreedToRules}>
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          {submitting ? "Processing Booking..." : "Submit Booking"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
        <DialogContent className="flex w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 max-h-[85vh] sm:w-full">
          <DialogHeader className="border-b border-border px-6 py-5 text-left">
            <DialogTitle className="font-display text-2xl text-foreground">{termsTitle}</DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {termsSummary}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5 text-sm leading-7 text-muted-foreground">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900">
                {PAYMENT_POLICY_NOTICE}
              </div>

              {termsSections.map((section, index) => {
                const [heading, ...bodyLines] = section.split("\n");
                const hasBody = bodyLines.some((line) => line.trim());

                return (
                  <div key={`${heading}-${index}`} className="space-y-2">
                    <p className="font-semibold uppercase tracking-[0.08em] text-foreground">
                      {heading}
                    </p>
                    {hasBody ? (
                      <div className="space-y-2">
                        {bodyLines.filter((line) => line.trim()).map((line, lineIndex) => (
                          <p key={`${heading}-${lineIndex}`}>{line}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="border-t border-border pt-5">
                <p className="font-semibold uppercase tracking-[0.08em] text-foreground">Resort Rules</p>
                <div className="mt-3 space-y-4">
                  {rules.map((rule, index) => (
                    <div key={rule.title}>
                      <p className="font-medium text-foreground">{index + 1}. {rule.title}</p>
                      <p className="mt-1">{rule.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background px-6 py-4 sm:flex-row">
            <Button className="flex-1" onClick={handleAcceptPolicy}>
              I Agree
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDeclinePolicy}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
