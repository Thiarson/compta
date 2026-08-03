import { useNavigate, useSearch } from '@tanstack/react-router';
import { LoginForm } from '@/components/auth/login-form';

export function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: '/login' });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm onSuccess={() => navigate({ to: redirect ?? '/' })} />
      </div>
    </div>
  );
}
