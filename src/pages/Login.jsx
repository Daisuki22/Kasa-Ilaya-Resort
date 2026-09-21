import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarCheck, Loader2, LockKeyhole, TreePalm } from 'lucide-react';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const normalizeEmail = (value) => value.trim().toLowerCase();

const isValidEmail = (value) => /^(?:[^\s@]+)@(?:[^\s@]+)\.[^\s@]+$/.test(value);

const isValidPhoneNumber = (value) => {
  const normalized = value.replace(/\D/g, '');
  return normalized.length >= 10 && normalized.length <= 13;
};

const MIN_SIGNUP_AGE = 18;

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateAge = (birthDateValue, today = new Date()) => {
  const [year, month, day] = birthDateValue.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const birthDate = new Date(year, month - 1, day);

  if (
    birthDate.getFullYear() !== year
    || birthDate.getMonth() !== month - 1
    || birthDate.getDate() !== day
  ) {
    return null;
  }

  let age = today.getFullYear() - year;
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age;
};

const resolveNextPath = (nextValue) => {
  if (!nextValue) {
    return createPageUrl('Home');
  }

  try {
    const nextUrl = new URL(nextValue, window.location.origin);
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return nextValue;
  }
};

const loadGoogleScript = () => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('Google sign-in is only available in the browser.'));
    return;
  }

  if (window.google?.accounts?.id) {
    resolve(window.google);
    return;
  }

  const existingScript = document.querySelector('script[data-google-identity="true"]');
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(window.google), { once: true });
    existingScript.addEventListener('error', () => reject(new Error('Unable to load Google sign-in.')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.dataset.googleIdentity = 'true';
  script.onload = () => resolve(window.google);
  script.onerror = () => reject(new Error('Unable to load Google sign-in.'));
  document.head.appendChild(script);
});

const GoogleMark = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.6-4.8 9.6-7.3 0-.5 0-.9-.1-1.3H12z" />
    <path fill="#34A853" d="M3.3 7.4l3.2 2.3C7.3 8 9.5 6 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2c-3.8 0-7.1 2.2-8.7 5.2z" />
    <path fill="#FBBC05" d="M12 21.8c2.6 0 4.8-.9 6.5-2.5l-3-2.4c-.8.6-1.9 1.1-3.5 1.1-3.9 0-5.2-2.6-5.5-3.8l-3.2 2.5c1.6 3.1 4.9 5.1 8.7 5.1z" />
    <path fill="#4285F4" d="M21.6 14.5c.1-.4.2-.9.2-1.4 0-.5 0-.9-.1-1.3H12v3.9h5.5c-.3 1.3-1.1 2.3-2.1 3l3 2.4c1.8-1.7 3.2-4.2 3.2-6.6z" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get('next')), [searchParams]);
  const [activeTab, setActiveTab] = useState('signin');
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({ first_name: '', middle_name: '', last_name: '', birth_date: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleConfig, setGoogleConfig] = useState({ enabled: false, client_id: '' });
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isCheckingGoogle, setIsCheckingGoogle] = useState(true);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState('');
  const [googleBirthday, setGoogleBirthday] = useState('');
  const [isGoogleBirthdayOpen, setIsGoogleBirthdayOpen] = useState(false);
  const [isCompletingGoogleBirthday, setIsCompletingGoogleBirthday] = useState(false);
  const googleButtonRef = useRef(null);
  const signUpFormRef = useRef(signUpForm);
  const pageTitle = activeTab === 'signin' ? 'Login' : 'Register';
  const todayInputValue = useMemo(() => toDateInputValue(new Date()), []);

  useEffect(() => {
    signUpFormRef.current = signUpForm;
  }, [signUpForm]);

  const completeGoogleLogin = useCallback(async (credential, overrides = {}) => {
    const currentSignUpForm = signUpFormRef.current;
    const firstName = currentSignUpForm.first_name.trim();
    const middleName = currentSignUpForm.middle_name.trim();
    const lastName = currentSignUpForm.last_name.trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

    const payload = await baseClient.auth.googleLogin({
      credential,
      next_url: nextPath,
      birth_date: overrides.birth_date ?? currentSignUpForm.birth_date.trim(),
      full_name: overrides.full_name ?? fullName,
      phone: overrides.phone ?? currentSignUpForm.phone.trim(),
    });

    toast.success('Signed in with Google successfully.');
    const destination = ['admin', 'super_admin'].includes(payload?.user?.role)
      ? createPageUrl('AdminDashboard')
      : nextPath;
    navigate(destination);
  }, [navigate, nextPath]);

  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      toast.error('Google sign-in was cancelled.');
      return;
    }

    setIsSubmitting(true);

    try {
      await completeGoogleLogin(response.credential);
    } catch (error) {
      if (error?.code === 'birthday_required') {
        setPendingGoogleCredential(response.credential);
        setGoogleBirthday(signUpFormRef.current.birth_date || '');
        setIsGoogleBirthdayOpen(true);
        return;
      }

      toast.error(error.message || 'Unable to sign in with Google.');
    } finally {
      setIsSubmitting(false);
    }
  }, [completeGoogleLogin]);

  useEffect(() => {
    let isMounted = true;

    baseClient.auth.getGoogleConfig()
      .then((config) => {
        if (!isMounted) {
          return;
        }

        setGoogleConfig({
          enabled: Boolean(config?.enabled && config?.client_id),
          client_id: config?.client_id || '',
        });
        setIsCheckingGoogle(false);
      })
      .catch(() => {
        if (isMounted) {
          setGoogleConfig({ enabled: false, client_id: '' });
          setIsCheckingGoogle(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!googleConfig.enabled || !googleConfig.client_id || !googleButtonRef.current) {
      return undefined;
    }

    loadGoogleScript()
      .then((google) => {
        if (!isMounted || !google?.accounts?.id || !googleButtonRef.current) {
          return;
        }

        google.accounts.id.initialize({
          client_id: googleConfig.client_id,
          callback: handleGoogleCredential,
        });

        googleButtonRef.current.innerHTML = '';
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: '360',
          text: 'continue_with',
          shape: 'pill',
        });
        setIsGoogleReady(true);
      })
      .catch(() => {
        if (isMounted) {
          setIsGoogleReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [googleConfig.client_id, googleConfig.enabled, handleGoogleCredential]);

  const handleGoogleBirthdaySubmit = async (event) => {
    event.preventDefault();

    const age = calculateAge(googleBirthday);

    if (age === null) {
      toast.error('Please enter a valid birthday.');
      return;
    }

    if (age < 0) {
      toast.error('Birthday cannot be in the future.');
      return;
    }

    if (age < MIN_SIGNUP_AGE) {
      toast.error('Guests must be at least 18 years old to create an account.');
      return;
    }

    if (!pendingGoogleCredential) {
      toast.error('Please click Continue with Google again.');
      setIsGoogleBirthdayOpen(false);
      return;
    }

    setIsCompletingGoogleBirthday(true);

    try {
      await completeGoogleLogin(pendingGoogleCredential, { birth_date: googleBirthday });
      setPendingGoogleCredential('');
      setIsGoogleBirthdayOpen(false);
    } catch (error) {
      toast.error(error.message || 'Unable to complete Google sign-in.');
    } finally {
      setIsCompletingGoogleBirthday(false);
    }
  };

  const handleGoogleUnavailable = () => {
    toast.error('Google sign-in is not configured yet. Add KASA_GOOGLE_CLIENT_ID on the server first.');
  };

  const notifyOtpMailStatus = (response, successMessage) => {
    if (response?.mail_sent === false) {
      toast.error('Verification code was created, but email delivery failed. Please check the email service settings.');
      return;
    }

    toast.success(successMessage);
  };

  const sendVerificationAndRedirect = async (email) => {
    const normalizedEmail = normalizeEmail(email);
    const params = new URLSearchParams({ email: normalizedEmail });

    try {
      const response = await baseClient.auth.sendRegistrationOtp({
        email: normalizedEmail,
      });
      notifyOtpMailStatus(response, 'Verification code sent by email. Please verify your account first.');
    } catch (otpError) {
      toast.error(otpError.message || 'Unable to send verification code.');
    } finally {
      navigate(`${createPageUrl('VerifyRegistrationOtp')}?${params.toString()}`);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    const email = normalizeEmail(signInForm.email);
    const password = signInForm.password;

    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (!password) {
      toast.error('Password is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await baseClient.auth.login({
        email,
        password,
        next_url: nextPath,
      });

      toast.success('Signed in successfully.');
      const destination = ['admin', 'super_admin'].includes(payload?.user?.role)
        ? createPageUrl('AdminDashboard')
        : nextPath;
      navigate(destination);
    } catch (error) {
      if ((error.message || '').toLowerCase().includes('verify your email')) {
        await sendVerificationAndRedirect(email);
        return;
      }

      toast.error(error.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (event) => {
    event.preventDefault();

    const firstName = signUpForm.first_name.trim();
    const middleName = signUpForm.middle_name.trim();
    const lastName = signUpForm.last_name.trim();
    const birthDate = signUpForm.birth_date.trim();
    const phone = signUpForm.phone.trim();
    const email = normalizeEmail(signUpForm.email);
    const password = signUpForm.password;

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

    if (firstName.length < 2) {
      toast.error('Please enter your first name.');
      return;
    }

    if (lastName.length < 2) {
      toast.error('Please enter your last name.');
      return;
    }

    const age = calculateAge(birthDate);

    if (age === null) {
      toast.error('Please enter a valid birthday.');
      return;
    }

    if (age < 0) {
      toast.error('Birthday cannot be in the future.');
      return;
    }

    if (age < MIN_SIGNUP_AGE) {
      toast.error('Guests must be at least 18 years old to create an account.');
      return;
    }

    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (phone && !isValidPhoneNumber(phone)) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await baseClient.auth.register({
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        full_name: fullName,
        birth_date: birthDate,
        phone,
        email,
        password,
        next_url: nextPath,
      });
      notifyOtpMailStatus(payload, 'Account created successfully. Verification code sent to your email.');
      const params = new URLSearchParams({ email });
      navigate(`${createPageUrl('VerifyRegistrationOtp')}?${params.toString()}`);
    } catch (error) {
      toast.error(error.message || 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6 text-foreground sm:px-6 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/35 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[640px] overflow-hidden bg-primary lg:block">
          <img
            src="/img/room_Resort%20View.jpg"
            alt="Kasa Ilaya Resort view"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div className="inline-flex w-fit items-center gap-3 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-md">
              <TreePalm className="h-4 w-4" />
              Kasa Ilaya Resort & Event Place
            </div>
            <div className="max-w-xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Guest Portal</p>
              <h1 className="font-display text-5xl font-bold leading-tight">Plan, book, and manage your resort stay.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/82">
                Access reservations, payment updates, and guest details with a secure Kasa Ilaya account.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/20 bg-white/12 p-4 backdrop-blur-md">
                  <CalendarCheck className="mb-3 h-5 w-5 text-white" />
                  <p className="text-sm font-semibold">Booking access</p>
                  <p className="mt-1 text-xs leading-5 text-white/72">Review reservations and confirmations.</p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/12 p-4 backdrop-blur-md">
                  <LockKeyhole className="mb-3 h-5 w-5 text-white" />
                  <p className="text-sm font-semibold">Protected account</p>
                  <p className="mt-1 text-xs leading-5 text-white/72">Email verification and secure sessions.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex max-h-none items-start justify-center overflow-y-auto px-5 py-8 sm:px-8 lg:max-h-[calc(100vh-8rem)] lg:px-12">
          <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pb-5">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TreePalm className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kasa Ilaya</p>
                  <p className="text-sm text-muted-foreground">Resort & Event Place</p>
                </div>
              </div>
              <CardTitle className="font-display text-3xl font-bold">{pageTitle}</CardTitle>
              <CardDescription className="pt-2 text-sm leading-6">
                {activeTab === 'signin'
                  ? 'Welcome back. Sign in to continue to your guest dashboard.'
                  : 'Create a guest account with Google or email.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <>
                  <div className="mb-6 space-y-3">
                    {googleConfig.enabled ? (
                      <div className="flex min-h-11 justify-center">
                        <div ref={googleButtonRef} className="min-h-11" />
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full gap-2 rounded-lg border-border bg-background"
                        onClick={handleGoogleUnavailable}
                        disabled={isCheckingGoogle}
                      >
                        {isCheckingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                        Continue with Google
                      </Button>
                    )}

                    {googleConfig.enabled && !isGoogleReady ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading Google sign-in...
                      </div>
                    ) : null}

                    {!googleConfig.enabled && !isCheckingGoogle ? (
                      <p className="text-center text-xs leading-5 text-muted-foreground">
                        Google sign-in is waiting for the server client ID.
                      </p>
                    ) : null}

                    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      <div className="h-px flex-1 bg-border" />
                      <span>Email</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg bg-muted p-1">
                  <TabsTrigger className="rounded-md" value="signin">Sign In</TabsTrigger>
                  <TabsTrigger className="rounded-md" value="signup">Create Account</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="pt-5">
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        className="h-11 rounded-lg"
                        type="email"
                        value={signInForm.email}
                        onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        className="h-11 rounded-lg"
                        type="password"
                        value={signInForm.password}
                        onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <Link className="font-medium text-primary hover:underline" to={`${createPageUrl('ForgotPassword')}?email=${encodeURIComponent(signInForm.email)}`}>
                        Forgot password?
                      </Link>
                      <button className="text-muted-foreground hover:text-foreground" type="button" onClick={() => setActiveTab('signup')}>
                        Need an account?
                      </button>
                    </div>
                    <Button className="h-11 w-full rounded-lg" disabled={isSubmitting} type="submit">
                      {isSubmitting ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="pt-5">
                  <form className="space-y-4" onSubmit={handleSignUp}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="signup-first-name">First name</Label>
                        <Input
                          id="signup-first-name"
                          className="h-11 rounded-lg"
                          value={signUpForm.first_name}
                          onChange={(event) => setSignUpForm((current) => ({ ...current, first_name: event.target.value }))}
                          placeholder="Juan"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-last-name">Last name</Label>
                        <Input
                          id="signup-last-name"
                          className="h-11 rounded-lg"
                          value={signUpForm.last_name}
                          onChange={(event) => setSignUpForm((current) => ({ ...current, last_name: event.target.value }))}
                          placeholder="Dela Cruz"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-middle-name">Middle name (optional)</Label>
                      <Input
                        id="signup-middle-name"
                        className="h-11 rounded-lg"
                        value={signUpForm.middle_name}
                        onChange={(event) => setSignUpForm((current) => ({ ...current, middle_name: event.target.value }))}
                        placeholder="Santos"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone">Phone number</Label>
                        <Input
                          id="signup-phone"
                          className="h-11 rounded-lg"
                          value={signUpForm.phone}
                          onChange={(event) => setSignUpForm((current) => ({ ...current, phone: event.target.value }))}
                          placeholder="09xxxxxxxxx"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-birthday">Birthday</Label>
                        <Input
                          id="signup-birthday"
                          className="h-11 rounded-lg"
                          type="date"
                          value={signUpForm.birth_date}
                          max={todayInputValue}
                          onChange={(event) => setSignUpForm((current) => ({ ...current, birth_date: event.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        className="h-11 rounded-lg"
                        type="email"
                        value={signUpForm.email}
                        onChange={(event) => setSignUpForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          className="h-11 rounded-lg"
                          type="password"
                          value={signUpForm.password}
                          onChange={(event) => setSignUpForm((current) => ({ ...current, password: event.target.value }))}
                          placeholder="Minimum 8 characters"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">Confirm password</Label>
                        <Input
                          id="signup-confirm"
                          className="h-11 rounded-lg"
                          type="password"
                          value={signUpForm.confirmPassword}
                          onChange={(event) => setSignUpForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                          placeholder="Repeat password"
                          required
                        />
                      </div>
                    </div>
                    <Button className="h-11 w-full rounded-lg" disabled={isSubmitting} type="submit">
                      {isSubmitting ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
                  </Tabs>
                </>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={isGoogleBirthdayOpen} onOpenChange={setIsGoogleBirthdayOpen}>
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm your birthday</DialogTitle>
            <DialogDescription>
              Google does not share birthday data with Kasa Ilaya. Enter your birthday to finish account setup.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleGoogleBirthdaySubmit}>
            <div className="space-y-2">
              <Label htmlFor="google-signup-birthday">Birthday</Label>
              <Input
                id="google-signup-birthday"
                className="h-11 rounded-lg"
                type="date"
                value={googleBirthday}
                max={todayInputValue}
                onChange={(event) => setGoogleBirthday(event.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGoogleBirthdayOpen(false)} disabled={isCompletingGoogleBirthday}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCompletingGoogleBirthday}>
                {isCompletingGoogleBirthday ? 'Continuing...' : 'Continue'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
