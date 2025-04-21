// Filename: AvatarSwitcher.jsx
import React, { useRef, useState, useEffect } from 'react';

const AvatarSwitcher = () => {
  const videoRef = useRef(null);
  const [pose, setPose] = useState('front');

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        alert('Failed to acquire camera feed: ' + err.message);
      }
    };

    initCamera();
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ color: 'green' }}>✅ Webcam + Pose Test (Stage 1)</h1>
      <p>Pose: {pose}</p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width="320"
        height="240"
        style={{ border: '2px solid #ccc' }}
      />
    </div>
  );
};

export default AvatarSwitcher;
