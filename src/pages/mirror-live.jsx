// src/pages/mirror-live.jsx

import dynamic from 'next/dynamic';

// This dynamically imports our main component with Server-Side Rendering (SSR) disabled.
// This is the key to fixing the Vercel deployment error.
const LipstickMirrorComponent = dynamic(
  () => import('@/components/LipstickMirrorLive_Clone'), 
  { ssr: false }
);

export default function MirrorLivePage() {
  return <LipstickMirrorComponent />;
}