import { AlertTriangle } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { CenteredPage } from '@/components/layout/centered-page';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ErrorComponentProps } from '@tanstack/react-router';

// Fallback for uncaught route errors, registered as the root route's errorComponent.
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <CenteredPage role="alert">
      <Card>
        <CardHeader>
          <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            {import.meta.env.DEV ? error.message : 'Please try again, or come back later.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link to="/" className={buttonVariants({ variant: 'ghost' })}>
            Go to homepage
          </Link>
        </CardContent>
      </Card>
    </CenteredPage>
  );
}
