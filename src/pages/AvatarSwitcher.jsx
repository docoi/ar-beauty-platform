import React, { useRef, useEffect, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';

const AvatarSwitcher = () => {
  const videoRef = useRef(null);
  const [pose, setPose] = useState('front');

  useEffect(() => {
    console.log("👀 useEffect triggered");

    if (!videoRef.current) {
      console.warn("🚨 videoRef is null");
      return;
    }

    console.log("✅ videoRef available");

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        console.log("📸 Webcam frame being captured");
      },
      width: 640,
      height: 480,
    });

    camera.start().then(() => {
      console.log("🎥 Camera started");
    }).catch((err) => {
      console.error("❌ Camera failed to start:", err);
    });
  }, []);

  return (
    <div style={{ padding: '20px', color: 'black' }}>
      <h1>✅ AvatarSwitcher is rendering!</h1>
      <p>Pose state: {pose}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: '320px', border: '2px solid black' }}
      />

      <h2>Test Image Visibility:</h2>
      <img src="/avatars/avatar_front.jpeg" alt="Front" width="100" />
      <img src="/avatars/avatar_left.jpeg" alt="Left" width="100" />
      <img src="/avatars/avatar_right.jpeg" alt="Right" width="100" />
    </div>
  );
};

export default AvatarSwitcher;
