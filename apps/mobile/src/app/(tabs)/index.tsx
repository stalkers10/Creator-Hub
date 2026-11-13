import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Feed"
      description="Feed of video, image and text posts. Free daily viewing time applies to non-subscribers."
      todo={[
        'Paged feed list (spec FR13)',
        'Usage updates every 10-15 s while open (FR15)',
        'Warning and paywall when time is used up (FR18, FR19)',
      ]}
    />
  );
}
