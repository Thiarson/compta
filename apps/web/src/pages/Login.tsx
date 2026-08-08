import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { LoginForm } from '@/components/auth/login-form';

export function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: '/login' });

  function handleSuccess() {
    toast.success('Welcome back!');
    navigate({ to: redirect ?? '/' });
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirect={redirect} onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
