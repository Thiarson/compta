import { useEffect, useState } from 'react';
import { Link, getRouteApi, useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { AuthPending } from '@/components/auth/auth-pending';
import { Field, FieldDescription, FieldError, FieldGroup } from '@/components/ui/field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogout, useResendVerification, useSession } from '@/features/auth/auth.hooks';

import type { VerifyEmailResult } from '@/routes/verify-email';

// Prevents spamming the resend button.
const RESEND_COOLDOWN_SECONDS = 30;

const routeApi = getRouteApi('/verify-email');

export function VerifyEmail({ className, ...props }: React.ComponentProps<'div'>) {
  const { redirect } = useSearch({ from: '/verify-email' });
  const result = routeApi.useLoaderData();

  if (result) {
    return (
      <VerifyEmailOutcome result={result} redirect={redirect} className={className} {...props} />
    );
  }

  return <ResendVerification className={className} {...props} />;
}

// Shown as the route's pendingComponent while the loader verifies the token.
export function VerifyingEmail(props: React.ComponentProps<'div'>) {
  return <AuthPending title="Verifying your email…" {...props} />;
}

function VerifyEmailOutcome({
  result,
  redirect,
  className,
  ...props
}: React.ComponentProps<'div'> & { result: VerifyEmailResult; redirect?: string }) {
  const navigate = useNavigate();

  if (result.status === 'success') {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Email verified</CardTitle>
            <CardDescription>Your account is now active.</CardDescription>
          </CardHeader>
          <CardContent>
            {result.sessionUser ? (
              <Button onClick={() => navigate({ to: redirect ?? '/' })}>
                Continue to dashboard
              </Button>
            ) : (
              <Button onClick={() => navigate({ to: '/login', search: { redirect } })}>
                Continue to login
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.sessionUser) {
    return <ResendVerification notice={result.message} className={className} {...props} />;
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldDescription>
            <Link to="/login">Log in</Link> to request a new verification link.
          </FieldDescription>
        </CardContent>
      </Card>
    </div>
  );
}

function ResendVerification({
  notice,
  className,
  ...props
}: React.ComponentProps<'div'> & { notice?: string }) {
  const logout = useLogout();
  const { data: user } = useSession();
  const [cooldown, setCooldown] = useState(0);
  const resendVerification = useResendVerification();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timeout = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timeout);
  }, [cooldown]);

  function handleResend() {
    resendVerification.mutate(undefined, {
      onSuccess: () => {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success('Verification email sent.');
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
      },
    });
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            We sent a verification link to{' '}
            <span className="font-medium text-foreground">{user?.email}</span>. Click the link to
            activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {notice && <FieldError>{notice}</FieldError>}
            <Field>
              <Button
                type="button"
                disabled={resendVerification.isPending || cooldown > 0}
                onClick={handleResend}
              >
                {resendVerification.isPending
                  ? 'Sending...'
                  : cooldown > 0
                    ? `Resend email (${cooldown}s)`
                    : 'Resend email'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                Sign out
              </Button>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
