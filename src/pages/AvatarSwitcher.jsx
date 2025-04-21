import React, { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import * as cam from '@mediapipe/camera_utils';

const AvatarSwitcher = () => {
  const videoRef = useRef(null);
  const [pose, setPose] = useState('front');
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    const initCamera = () => {
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

      try {
        const camera = new cam.Camera(videoRef.current, {
          onFrame: async () => {
            await faceMesh.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });
        camera.start();
        setIsCameraReady(true);
      } catch (err) {
        alert('Unable to access the camera.');
        console.error('Camera start error:', err);
      }
    };

    // Check camera permissions first
    navigator.permissions
      .query({ name: 'camera' })
      .then((res) => {
        if (res.state === 'granted' || res.state === 'prompt') {
          // Slight delay to allow permission prompts to complete
          setTimeout(() => {
            initCamera();
          }, 500);
        } else {
          alert('Camera permission denied.');
        }
      })
      .catch((err) => {
        console.warn('Permissions API not supported or failed:', err);
        // Still attempt to start camera
        setTimeout(() => {
          initCamera();
        }, 500);
      });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: 'green' }}>✅ Webcam + Pose Test (Stage 2.1)</h1>
      <p>
        Pose: <strong>{pose}</strong>
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: '500px', background: 'black' }}
      />
    </div>
  );
};

export default AvatarSwitcher;
