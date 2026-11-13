import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Free time used up"
      description="Shown when the daily free viewing time is over. Offers registration for visitors and the subscription plans for members."
      todo={[
        'List plans from GET /plans (FR22)',
        'Pay with MTN MoMo or Orange Money via Campay (FR30)',
        'Show when free access returns (FR19)',
      ]}
    />
  );
}
