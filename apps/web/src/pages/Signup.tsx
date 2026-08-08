import { useNavigate, useSearch } from '@tanstack/react-router';
import { SignupForm } from '@/components/auth/signup-form';

export function SignupPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: '/signup' });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm
          redirect={redirect}
          onSuccess={() => navigate({ to: '/verify-email', search: { redirect } })}
        />
      </div>
    </div>
  );
}
