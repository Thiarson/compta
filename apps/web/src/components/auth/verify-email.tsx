import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup } from '@/components/ui/field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useLogout,
  useResendVerification,
  useSession,
  useVerifyEmail,
} from '@/features/auth/auth.hooks';

// Prevents spamming the resend button.
const RESEND_COOLDOWN_SECONDS = 30;

export function VerifyEmail({ className, ...props }: React.ComponentProps<'div'>) {
  const { token, redirect } = useSearch({ from: '/verify-email' });

  if (token) {
    return <VerifyEmailToken token={token} redirect={redirect} className={className} {...props} />;
  }

  return <ResendVerification className={className} {...props} />;
}

function VerifyEmailToken({
  token,
  redirect,
  className,
  ...props
}: React.ComponentProps<'div'> & { token: string; redirect?: string }) {
  const navigate = useNavigate();
  const hasVerified = useRef(false);
  const verifyEmail = useVerifyEmail();
  const { data: sessionUser } = useSession();

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;
    verifyEmail.mutate({ verificationToken: token });
  }, [token, verifyEmail]);

  if (verifyEmail.isSuccess) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Email verified</CardTitle>
            <CardDescription>Your account is now active.</CardDescription>
          </CardHeader>
          <CardContent>
            {verifyEmail.data ? (
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

  if (verifyEmail.isError) {
    const message =
      verifyEmail.error instanceof ApiError
        ? verifyEmail.error.message
        : 'This link is invalid or has expired.';

    if (sessionUser) {
      return <ResendVerification notice={message} className={className} {...props} />;
    }

    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Verification failed</CardTitle>
            <CardDescription>{message}</CardDescription>
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

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Verifying your email…</CardTitle>
        </CardHeader>
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
      onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS),
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
            {resendVerification.isSuccess && (
              <FieldDescription>Verification email sent.</FieldDescription>
            )}
            {resendVerification.isError && (
              <FieldError>
                {resendVerification.error instanceof ApiError
                  ? resendVerification.error.message
                  : 'Something went wrong'}
              </FieldError>
            )}
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
