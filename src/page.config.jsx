import { lazy } from 'react';
import __Layout from './Layout.jsx';

export const PAGES = {
    "AdminActivityLogs": lazy(() => import('./pages/AdminActivityLogs.jsx')),
    "Amenities": lazy(() => import('./pages/Amenities.jsx')),
    "About": lazy(() => import('./pages/About.jsx')),
    "AdminBookings": lazy(() => import('./pages/AdminBooking.jsx')),
    "AdminCalendar": lazy(() => import('./pages/AdminCalendar.jsx')),
    "Contact": lazy(() => import('./pages/Contact.jsx')),
    "AdminDashboard": lazy(() => import('./pages/AdminDashboard.jsx')),
    "AdminInquiries": lazy(() => import('./pages/AdminInquiries.jsx')),
    "AdminPackages": lazy(() => import('./pages/AdminPackage.jsx')),
    "AdminPackageArchive": lazy(() => import('./pages/AdminPackageArchive.jsx')),
    "AdminPaymentQRCodes": lazy(() => import('./pages/AdminPaymentQRCodes.jsx')),
    "AdminPaymentMonitoring": lazy(() => import('./pages/AdminPaymentMonitoring.jsx')),
    "AdminProfileSettings": lazy(() => import('./pages/AdminProfileSettings.jsx')),
    "AdminSecuritySettings": lazy(() => import('./pages/AdminSecuritySettings.jsx')),
    "AdminSystemSettings": lazy(() => import('./pages/AdminSystemSettings.jsx')),
    "AdminUserPermissions": lazy(() => import('./pages/AdminUserPermissions.jsx')),
    "BookingForm": lazy(() => import('./pages/BookingForm.jsx')),
    "ForgotPassword": lazy(() => import('./pages/ForgotPassword.jsx')),
    "VerifyRegistrationOtp": lazy(() => import('./pages/VerifyRegistrationOtp.jsx')),
    "Home": lazy(() => import('./pages/Home.jsx')),
    "Login": lazy(() => import('./pages/Login.jsx')),
    "MyBookings": lazy(() => import('./pages/MyBooking.jsx')),
    "Packages": lazy(() => import('./pages/Packages.jsx')),
    "ProfileSettings": lazy(() => import('./pages/ProfileSettings.jsx')),
    "ResetPassword": lazy(() => import('./pages/ResetPassword.jsx')),
    "AdminReport": lazy(() => import('./pages/AdminReport.jsx')),
};

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
