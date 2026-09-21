import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CaptchaGate from '@/components/auth/CaptchaGate';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const initialEmail = searchParams.get('email') || '';
  const isTokenReset = token !== '';
  const [status, setStatus] = useState({ loading: isTokenReset, valid: !isTokenReset, email: initialEmail });
  const [form, setForm] = useState({ email: initialEmail, code: '', password: '', confirmPassword: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(isTokenReset);
  const [resetToken, setResetToken] = useState(token);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [captchaVerified, setCaptchaVerified] = useState(isTokenReset);

  useEffect(() => {
    if (resendSeconds <= 0 || isTokenReset) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [isTokenReset, resendSeconds]);

  useEffect(() => {
    if (!token) {
      setStatus({ loading: false, valid: true, email: initialEmail });
      return;
    }

    baseClient.auth.validateResetToken(token)
      .then((response) => {
        setStatus({ loading: false, valid: true, email: response.email || '' });
        setIsCodeVerified(true);
      })
      .catch(() => setStatus({ loading: false, valid: false, email: '' }));
  }, [token, initialEmail]);

  const handleCodeChange = (event) => {
    const nextCode = event.target.value.replace(/\D/g, '').slice(0, 6);
    setForm((current) => ({ ...current, code: nextCode, password: '', confirmPassword: '' }));
    setIsCodeVerified(false);
    setResetToken('');
  };

  const handleEmailChange = (event) => {
    setForm((current) => ({ ...current, email: event.target.value, password: '', confirmPassword: '' }));
    setIsCodeVerified(false);
    setResetToken('');
  };

  const resetIdentifierPayload = () => ({
    reset_method: 'email',
    email: form.email,
  });

  const handleVerifyCode = async () => {
    if (!form.email || !form.code) {
      toast.error('Email and reset code are required.');
      return;
    }

    if (form.code.length !== 6) {
      toast.error('Reset code must be 6 digits.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const response = await baseClient.auth.validateResetCode({ ...resetIdentifierPayload(), code: form.code });
      setResetToken(response?.reset_token || '');
      setIsCodeVerified(true);
      toast.success('Reset code verified. You can now create a new password.');
    } catch (error) {
      setIsCodeVerified(false);
      setResetToken('');
      toast.error(error.message || 'Unable to verify reset code.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (!form.email) {
      toast.error('Email is required.');
      return;
    }

    if (resendSeconds > 0) {
      return;
    }

    setIsResending(true);
    try {
      const response = await baseClient.auth.resendResetOtp(resetIdentifierPayload());

      if (response.mail_sent === false) {
        toast.error('Reset code was created, but email delivery failed. Please check the email service settings.');
      } else {
        toast.success('If the account exists, a new reset code has been sent.');
      }

      setForm((current) => ({ ...current, code: '', password: '', confirmPassword: '' }));
      setIsCodeVerified(false);
      setResetToken('');
      setResendSeconds(60);
    } catch (error) {
      if (error?.retry_after_seconds) {
        setResendSeconds(Number(error.retry_after_seconds));
      }
      toast.error(error.message || 'Unable to resend reset code.');
      if (error?.code === 'captcha_required') {
        setCaptchaVerified(false);
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isTokenReset && !isCodeVerified) {
      toast.error('Please verify your reset code first.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (!isTokenReset && !resetToken) {
      toast.error('Please verify your reset code first.');
      return;
    }

    setIsSubmitting(true);
    try {
      await baseClient.auth.resetPassword(
        isTokenReset
          ? { token, new_password: form.password }
          : { reset_token: resetToken, new_password: form.password }
      );
      toast.success('Password updated. You can now sign in.');
      navigate(createPageUrl('Login'));
    } catch (error) {
      toast.error(error.message || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 px-4 py-10 sm:px-6">
      <Card className="mx-auto max-w-lg shadow-lg shadow-black/5">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Create a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {status.loading ? <p className="text-sm text-muted-foreground">Validating reset link...</p> : null}

          {!status.loading && !status.valid ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">This reset request is invalid or expired.</p>
              <Link className="text-sm text-primary hover:underline" to={createPageUrl('ForgotPassword')}>Request a new reset code</Link>
            </div>
          ) : null}

          {!status.loading && status.valid && !captchaVerified ? (
            <CaptchaGate purpose="reset" onVerified={() => setCaptchaVerified(true)} />
          ) : null}

          {!status.loading && status.valid && captchaVerified ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {isTokenReset ? (
                <p className="text-sm text-muted-foreground">Resetting password for <span className="font-medium text-foreground">{status.email}</span>.</p>
              ) : null}
              {!isTokenReset ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={form.email}
                      onChange={handleEmailChange}
                      disabled={isCodeVerified}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-code">Reset code</Label>
                    <Input
                      id="reset-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.code}
                      onChange={handleCodeChange}
                      placeholder="6-digit code"
                      disabled={isCodeVerified}
                      required
                    />
                  </div>
                  {!isCodeVerified ? (
                    <Button className="w-full" disabled={isVerifyingCode} type="button" onClick={handleVerifyCode}>
                      {isVerifyingCode ? 'Verifying code...' : 'Verify code'}
                    </Button>
                  ) : (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Reset code verified. Create your new password below.
                    </p>
                  )}
                </>
              ) : null}
              {isCodeVerified ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-password">New password</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                    <Input
                      id="reset-confirm-password"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      required
                    />
                  </div>
                  <Button className="w-full" disabled={isSubmitting} type="submit">
                    {isSubmitting ? 'Updating password...' : 'Update password'}
                  </Button>
                </>
              ) : null}
              {!isTokenReset ? (
                <Button
                  className="w-full"
                  disabled={isResending || resendSeconds > 0 || isCodeVerified}
                  type="button"
                  variant="ghost"
                  onClick={handleResendCode}
                >
                  {isResending ? 'Sending...' : resendSeconds > 0 ? `Send a new code in ${resendSeconds}s` : 'Send a new code'}
                </Button>
              ) : null}
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
