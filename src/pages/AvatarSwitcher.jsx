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
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  
  return (
    <div style={{ 
      padding: '10px', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ color: 'green', margin: '0 0 10px 0' }}>✅ Webcam + Pose Test (Stable Version)</h2>
      <p style={{ margin: '0 0 10px 0' }}>
        Pose: <strong>{pose}</strong>
      </p>
      
      {isCameraReady && (
        <div style={{ 
          position: 'relative',
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          marginBottom: '10px',
          ...(isFullScreen ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: '#000',
            margin: 0
          } : {})
        }}>
          {!isFullScreen && (
            <h3 style={{ 
              position: 'absolute', 
              top: '10px', 
              left: '10px', 
              margin: 0, 
              background: 'rgba(255,255,255,0.7)', 
              padding: '5px', 
              borderRadius: '5px',
              zIndex: 2
            }}>Live Avatar</h3>
          )}
          <div 
            style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%',
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={toggleFullScreen}
          >
            <img 
              src="/avatars/avatar_front.jpg" 
              alt="Avatar Front" 
              style={{
                position: 'absolute',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                opacity: pose === 'front' ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out'
              }}
            />
            <img 
              src="/avatars/avatar_left.jpg" 
              alt="Avatar Left" 
              style={{
                position: 'absolute',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                opacity: pose === 'left' ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out'
              }}
            />
            <img 
              src="/avatars/avatar_right.jpg" 
              alt="Avatar Right" 
              style={{
                position: 'absolute',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                opacity: pose === 'right' ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out'
              }}
            />
          </div>
        </div>
      )}
      
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        background: '#f5f5f5',
        borderRadius: '8px',
        marginTop: 'auto'
      }}>
        <h4 style={{ margin: '0 0 5px 0' }}>Camera Feed:</h4>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ 
            width: '160px', 
            height: 'auto',
            border: '2px solid #ccc', 
            background: '#000',
            borderRadius: '4px'
          }}
        />
      </div>
      
      {cameraError && <p style={{ color: 'red', margin: '10px 0 0 0' }}>❌ Error: {cameraError}</p>}
    </div>
  );
};
export default AvatarSwitcher;