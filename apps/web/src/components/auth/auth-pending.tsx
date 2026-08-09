import { Loader2 } from 'lucide-react';

import { CenteredPage } from '@/components/layout/centered-page';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

// Shared full-page loading state for route pendingComponents (e.g. verifying an
// email/reset token), so every such state gets the same layout, spinner, and a11y.
export function AuthPending({ title, ...props }: React.ComponentProps<'div'> & { title: string }) {
  return (
    <CenteredPage role="status" aria-live="polite" {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {title}
          </CardTitle>
        </CardHeader>
      </Card>
    </CenteredPage>
  );
}
