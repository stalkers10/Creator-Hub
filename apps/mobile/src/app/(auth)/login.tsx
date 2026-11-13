import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Log in"
      description="Sign in with email and password."
      todo={[
        'Login form calling POST /auth/login (FR2)',
        'Store the access token with secureStorage',
      ]}
    />
  );
}
