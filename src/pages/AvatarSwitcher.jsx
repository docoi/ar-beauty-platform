import React, { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const AvatarSwitcher = () => {
  const videoRef = useRef(null);
  const [pose, setPose] = useState('front');
  const [cameraError, setCameraError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let camera;

    const initialize = async () => {
      if (!videoRef.current) return;

      const faceMesh = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        if (
          !results.multiFaceLandmarks ||
          results.multiFaceLandmarks.length === 0
        )
          return;

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
        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await faceMesh.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        await camera.start();
        setIsInitialized(true);
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError(err.message);
      }
    };

    initialize();

    return () => {
      if (camera) {
        camera.stop();
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: 'green' }}>✅ Webcam + Pose Test (Stage 2.1)</h2>

      {cameraError ? (
        <p style={{ color: 'red' }}>❌ Error: {cameraError}</p>
      ) : (
        <>
          <p>Pose: <strong>{pose}</strong></p>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="320"
            height="240"
            style={{
              border: '1px solid #ccc',
              background: '#000',
            }}
          />
          {isInitialized && (
            <>
              <h3>Live Avatar:</h3>
              {pose === 'front' && (
                <img src="/avatars/avatar_front.jpg" alt="Avatar Front" width="120" />
              )}
              {pose === 'left' && (
                <img src="/avatars/avatar_left.jpg" alt="Avatar Left" width="120" />
              )}
              {pose === 'right' && (
                <img src="/avatars/avatar_right.jpg" alt="Avatar Right" width="120" />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AvatarSwitcher;
