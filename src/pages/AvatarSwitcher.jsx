// Filename: AvatarSwitcher.js

import React, { useRef, useEffect, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';
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

    const camera = new cam.Camera(videoRef.current, {
      onFrame: async () => {
        await faceMesh.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });
    camera.start();
  }, []);

  return (
    <div>
      <h1 style={{ color: 'black' }}>Avatar Switcher is working</h1>
      <p>Current Pose: {pose}</p>
      <video ref={videoRef} autoPlay playsInline style={{ width: '320px', display: 'block' }} />
  
      {pose === 'front' && <img src="/avatars/avatar_front.jpg" alt="Avatar Front" />}
      {pose === 'left' && <img src="/avatars/avatar_left.jpg" alt="Avatar Left" />}
      {pose === 'right' && <img src="/avatars/avatar_right.jpg" alt="Avatar Right" />}
    </div>
  );
  
};
export default AvatarSwitcher;
