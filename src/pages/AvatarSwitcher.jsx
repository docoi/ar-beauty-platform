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
    <div style={{ padding: '50px' }}>
      <h1 style={{ color: 'green' }}>✅ It works! Vercel build is rendering this page.</h1>
    </div>
  );
};

export default AvatarSwitcher;
