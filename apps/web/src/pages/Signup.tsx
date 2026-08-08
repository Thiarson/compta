import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { SignupForm } from '@/components/auth/signup-form';

export function SignupPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: '/signup' });

  function handleSuccess() {
    toast.success('Account created — check your email to verify.');
    navigate({ to: '/verify-email', search: { redirect } });
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm redirect={redirect} onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
