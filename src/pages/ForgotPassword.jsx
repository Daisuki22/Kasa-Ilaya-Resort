import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CaptchaGate from '@/components/auth/CaptchaGate';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await baseClient.auth.forgotPassword({
        email,
      });

      if (response.mail_sent === false) {
        toast.error('Reset code was created, but email delivery failed. Please check the email service settings.');
      } else {
        toast.success('If the account exists, a reset code has been sent.');
        const params = new URLSearchParams({ method: 'email', email });
        navigate(`${createPageUrl('ResetPassword')}?${params.toString()}`);
      }
    } catch (error) {
      toast.error(error.message || 'Unable to send reset code.');
      setCaptchaVerified(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 px-4 py-10 sm:px-6">
      <Card className="mx-auto max-w-lg shadow-lg shadow-black/5">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Enter your email and we will send a password reset code.</CardDescription>
        </CardHeader>
        <CardContent>
          {!captchaVerified ? (
            <CaptchaGate purpose="reset" onVerified={() => setCaptchaVerified(true)} />
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending code...' : 'Send reset code'}
            </Button>
            </form>
          )}

          <div className="mt-6 text-sm text-muted-foreground">
            <Link className="text-primary hover:underline" to={createPageUrl('Login')}>Back to sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
