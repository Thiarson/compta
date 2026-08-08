import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError, getFieldErrors } from '@/lib/api-error';
import { useForgotPassword } from '@/features/auth/auth.hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

import type { SubmitEvent } from 'react';

export function ForgotPasswordForm({ className, ...props }: React.ComponentProps<'div'>) {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    forgotPassword.mutate(
      { email },
      {
        onError: (error) => {
          if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') {
            toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
          }
        },
      },
    );
  }

  if (forgotPassword.isSuccess) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              we&apos;ve sent a link to reset your password. It expires in 30 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldDescription className="text-center">
              Didn&apos;t get it? Check your spam folder, or{' '}
              <Link
                to="/forgot-password"
                onClick={() => forgotPassword.reset()}
                className="underline-offset-4 hover:underline"
              >
                try another email
              </Link>
              .
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
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email below and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <FieldError errors={getFieldErrors(forgotPassword.error, 'email')} />
              </Field>
              <Field>
                <Button type="submit" disabled={forgotPassword.isPending}>
                  {forgotPassword.isPending ? 'Sending...' : 'Send reset link'}
                </Button>
                <FieldDescription className="text-center">
                  Remembered your password? <Link to="/login">Back to login</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
