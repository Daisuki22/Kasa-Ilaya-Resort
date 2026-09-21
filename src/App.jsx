import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './page.config'
import { Component, Suspense, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { canAccessAdminPage } from '@/lib/adminAccess';
import WelcomeIntro from '@/components/common/WelcomeIntro';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const WELCOME_INTRO_SESSION_KEY = 'ki-welcome-intro-shown';

const PageLoadingFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
  </div>
);

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "The website could not finish loading.",
    };
  }

  componentDidCatch(error, info) {
    console.error("Kasa Ilaya app error", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-lg">
          <h1 className="font-display text-2xl font-bold">Website loading issue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please refresh the page. If this keeps happening, clear the browser cache and open the site again.
          </p>
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {this.state.message}
          </p>
          <button
            type="button"
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload website
          </button>
        </div>
      </div>
    );
  }
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AdminOnlyRoute = ({ user, pageName, children }) => {
  if (!canAccessAdminPage(user, pageName)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const protectedUserPages = new Set(["Packages", "Amenities", "BookingForm", "MyBookings", "ProfileSettings"]);
const guestOrRegularUserPages = new Set(["About", "Contact"]);

const UserOnlyRoute = ({ isAuthenticated, children }) => {
  const location = useLocation();

  if (!isAuthenticated) {
    const nextUrl = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/Login?next=${encodeURIComponent(nextUrl)}`} replace />;
  }

  return children;
};

const GuestOrRegularUserRoute = ({ user, children }) => {
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return <Navigate to="/AdminDashboard" replace />;
  }

  return children;
};

const WelcomeIntroGate = () => {
  const location = useLocation();
  const [shouldShowIntro] = useState(() => {
    if (location.pathname !== '/') {
      return false;
    }

    try {
      if (window.sessionStorage.getItem(WELCOME_INTRO_SESSION_KEY) === 'true') {
        return false;
      }

      window.sessionStorage.setItem(WELCOME_INTRO_SESSION_KEY, 'true');
      return true;
    } catch {
      return true;
    }
  });

  return shouldShowIntro ? <WelcomeIntro /> : null;
};

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              path.startsWith('Admin') ? (
                <AdminOnlyRoute user={user} pageName={path}>
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                </AdminOnlyRoute>
              ) : guestOrRegularUserPages.has(path) ? (
                <GuestOrRegularUserRoute user={user}>
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                </GuestOrRegularUserRoute>
              ) : protectedUserPages.has(path) ? (
                <UserOnlyRoute isAuthenticated={Boolean(user)}>
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                </UserOnlyRoute>
              ) : (
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              )
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <WelcomeIntroGate />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App
