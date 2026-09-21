import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { baseClient } from '@/api/baseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CaptchaGate({ purpose, onVerified, verifyAction }) {
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const loadChallenge = async () => {
    setIsLoading(true);
    setAnswer('');

    try {
      const response = await baseClient.auth.getCaptchaChallenge(purpose);
      setChallenge(response);
    } catch (error) {
      toast.error(error.message || 'Unable to load captcha.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChallenge();
  }, [purpose]);

  const verify = async (event) => {
    event.preventDefault();

    if (!answer.trim()) {
      toast.error('Please answer the captcha.');
      return;
    }

    setIsVerifying(true);

    try {
      const response = verifyAction
        ? await verifyAction({ purpose, answer })
        : await baseClient.auth.verifyCaptcha({ purpose, answer });
      toast.success('Captcha verified.');
      onVerified?.(response);
    } catch (error) {
      toast.error(error.message || 'Captcha answer is incorrect.');
      loadChallenge();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <form className="space-y-4 rounded-lg border bg-background p-4" onSubmit={verify}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">Security check</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Answer the question to continue.</p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center text-2xl font-semibold">
        {isLoading ? 'Loading...' : `${challenge?.question || ''} = ?`}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`captcha-${purpose}`}>Answer</Label>
        <Input
          id={`captcha-${purpose}`}
          inputMode="numeric"
          value={answer}
          onChange={(event) => setAnswer(event.target.value.replace(/[^\d-]/g, '').slice(0, 4))}
          placeholder="Type the answer"
          required
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button disabled={isLoading || isVerifying} type="submit">
          {isVerifying ? 'Checking...' : 'Continue'}
        </Button>
        <Button disabled={isLoading || isVerifying} type="button" variant="outline" onClick={loadChallenge}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
