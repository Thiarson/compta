import { useSession, useLogout } from '@/features/auth/auth.hooks';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const { data: user } = useSession();
  const logout = useLogout();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <p>Logged in as {user?.username}</p>
      <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
        Log out
      </Button>
    </div>
  );
}
