// src/pages/AvatarSwitcher.jsx

import React, { useRef, useEffect, useState } from 'react';
import * as cam from '@mediapipe/camera_utils';
import { FaceMesh } from '@mediapipe/face_mesh';

const AvatarSwitcher = () => {
  const videoRef = useRef(null);
  const [pose, setPose] = useState('front');

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
      const landmarks = results.multiFaceLandmarks[0];

      const nose = landmarks[1];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];

      const noseToLeft = nose.x - leftCheek.x;
      const noseToRight = rightCheek.x - nose.x;

      if (noseToLeft > noseToRight * 1.4) {
        setPose('right');
      } else if (noseToRight > noseToLeft * 1.4) {
        setPose('left');
      } else {
        setPose('front');
      }
    });

    if (videoRef.current) {
      const camera = new cam.Camera(videoRef.current, {
        onFrame: async () => {
          await faceMesh.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, []);

  return (
    <div style={{ padding: '30px' }}>
      <h2 style={{ color: 'green' }}>✅ Webcam + Pose Test (Stage 2.1)</h2>
      <p><strong>Pose:</strong> <span style={{ fontWeight: 'bold' }}>{pose}</span></p>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: 640, border: '2px solid #000' }} />
    </div>
  );
};

export default AvatarSwitcher;
