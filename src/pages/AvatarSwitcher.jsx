import React, { useEffect, useRef, useState } from 'react';

const AvatarSwitcher = () => {
  const videoRef = useRef(null);
  const [pose, setPose] = useState('front');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    let camera;

    const loadScripts = async () => {
      const loadScript = (src) =>
        new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });

      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    };

    const init = async () => {
      try {
        await loadScripts();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const faceMesh = new window.FaceMesh({
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

        camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            await faceMesh.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });

        camera.start();
        setIsCameraReady(true);
      } catch (err) {
        console.error("Camera error:", err);
        setCameraError(err.message);
        alert("Unable to access the camera: " + err.message);
      }
    };

    init();

    return () => {
      if (camera) camera.stop();
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: 'green' }}>✅ Webcam + Pose Test (Stable Version)</h2>
      <p>
        Pose: <strong>{pose}</strong>
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width="320"
        height="240"
        style={{ border: '2px solid #ccc', background: '#000' }}
      />

      {isCameraReady && (
        <>
          <h3>Live Avatar:</h3>
          {pose === 'front' && <img src="/avatars/avatar_front.jpg" alt="Avatar Front" width="120" />}
          {pose === 'left' && <img src="/avatars/avatar_left.jpg" alt="Avatar Left" width="120" />}
          {pose === 'right' && <img src="/avatars/avatar_right.jpg" alt="Avatar Right" width="120" />}
        </>
      )}

      {cameraError && <p style={{ color: 'red' }}>❌ Error: {cameraError}</p>}
    </div>
  );
};

export default AvatarSwitcher;
