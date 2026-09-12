import { FileQuestion } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { CenteredPage } from '@/components/layout/centered-page';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Fallback for unmatched routes, registered as the root route's notFoundComponent.
export function NotFound() {
  return (
    <CenteredPage>
      <Card>
        <CardHeader>
          <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link to="/" className={buttonVariants()}>
            Go to homepage
          </Link>
          <Button type="button" variant="ghost" onClick={() => window.history.back()}>
            Go back
          </Button>
        </CardContent>
      </Card>
    </CenteredPage>
  );
}
