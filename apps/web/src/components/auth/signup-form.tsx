import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/features/auth/auth.hooks';
import { ApiError, getFieldErrors } from '@/lib/api-error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

import type { SubmitEvent } from 'react';

export function SignupForm({
  redirect,
  onSuccess,
  ...props
}: React.ComponentProps<typeof Card> & { redirect?: string; onSuccess?: () => void }) {
  const register = useRegister();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordsMatch = password === confirmPassword;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordsMatch) return;
    register.mutate(
      { username, email, password },
      {
        onSuccess,
        onError: (error) => {
          if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') {
            toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
          }
        },
      },
    );
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Enter your information below to create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                placeholder="John Doe"
                autoComplete="username"
                required
                minLength={2}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <FieldError errors={getFieldErrors(register.error, 'username')} />
            </Field>
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
              <FieldError errors={getFieldErrors(register.error, 'email')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <FieldError errors={getFieldErrors(register.error, 'password')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
              />
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={register.isPending || !passwordsMatch}>
                  {register.isPending ? 'Creating account...' : 'Create Account'}
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account?{' '}
                  <Link to="/login" search={{ redirect }}>
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
