import { cn } from '@/lib/utils';

// Full-viewport centering shell shared by standalone states
// (auth pending, not-found, error) that render outside any app layout.
export function CenteredPage({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className={cn('flex w-full max-w-sm flex-col gap-6', className)} {...props} />
    </div>
  );
}
