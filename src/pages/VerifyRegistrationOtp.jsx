import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';

export default function VerifyRegistrationOtp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter the 6-digit code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await baseClient.auth.verifyRegistrationOtp({ email, otp });
      toast.success('Email verified. You can now sign in.');
      navigate(createPageUrl('Login'));
    } catch (error) {
      toast.error(error.message || 'Unable to verify code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    if (resendSeconds > 0) {
      return;
    }

    setIsResending(true);
    try {
      const response = await baseClient.auth.sendRegistrationOtp({ email });
      if (response?.mail_sent === false) {
        toast.error('Verification code was created, but email delivery failed. Please check the email service settings.');
        return;
      }

      toast.success('Verification code sent.');
      setResendSeconds(60);
    } catch (error) {
      if (error?.retry_after_seconds) {
        setResendSeconds(Number(error.retry_after_seconds));
      }
      toast.error(error.message || 'Unable to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 px-4 py-10 sm:px-6">
      <Card className="mx-auto max-w-lg shadow-lg shadow-black/5">
        <CardHeader>
          <CardTitle>Verify your account</CardTitle>
          <CardDescription>Enter the email code for {email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleVerify}>
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
              />
              <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to your email address.</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button className="flex-1" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Verifying...' : 'Verify email'}
              </Button>
              <Button variant="ghost" disabled={isResending || resendSeconds > 0 || !email} onClick={resend}>
                {isResending ? 'Sending...' : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
