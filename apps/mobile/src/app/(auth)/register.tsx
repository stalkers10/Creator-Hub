import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Create account"
      description="Register a new account."
      todo={['Registration form calling POST /auth/register (FR1)']}
    />
  );
}
