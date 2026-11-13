import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Create"
      description="Publish a video, image or text post."
      todo={[
        'Enable creator mode (FR5)',
        'Pick media and upload to Cloudinary (FR8)',
        'Edit and delete own posts (FR9)',
      ]}
    />
  );
}
