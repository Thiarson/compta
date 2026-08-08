import { useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError, getFieldErrors } from '@/lib/api-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useResetPassword } from '@/features/auth/auth.hooks';

import type { SubmitEvent } from 'react';

const routeApi = getRouteApi('/reset-password');

export function ResetPassword({ className, ...props }: React.ComponentProps<'div'>) {
  const result = routeApi.useLoaderData();

  if (result.status === 'invalid') {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldDescription>
              <Link to="/forgot-password">Request a new password reset link</Link>.
            </FieldDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ResetPasswordForm token={result.token} className={className} {...props} />;
}

// Shown as the route's pendingComponent while the loader verifies the token.
export function VerifyingResetToken({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Verifying link…</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}

function ResetPasswordForm({
  token,
  className,
  ...props
}: React.ComponentProps<'div'> & { token: string }) {
  const navigate = useNavigate();
  const resetPassword = useResetPassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordsMatch = newPassword === confirmPassword;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordsMatch) return;
    resetPassword.mutate(
      { passwordResetToken: token, newPassword },
      {
        onSuccess: () => {
          toast.success('Password reset. Please log in with your new password.');
          navigate({ to: '/login' });
        },
        onError: (error) => {
          if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') {
            toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
          }
        },
      },
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Enter a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <FieldError errors={getFieldErrors(resetPassword.error, 'newPassword')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <FieldError>Passwords don&apos;t match</FieldError>
                )}
              </Field>
              <Field>
                <Button type="submit" disabled={resetPassword.isPending || !passwordsMatch}>
                  {resetPassword.isPending ? 'Resetting...' : 'Reset password'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
