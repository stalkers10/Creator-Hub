import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Profile"
      description="Account, creator profile, subscription status and payment history."
      todo={[
        'Profile management (FR3)',
        'Subscription status and history (FR24, FR29)',
        'Payment history (FR33)',
        'Log out (FR2)',
      ]}
    />
  );
}
