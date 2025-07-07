// src/components/LipstickMirrorLive_Clone.jsx

import React, { useEffect, useRef, useState } from 'react';
import createPipelines from '@/utils/createPipelines';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';

// All the code outside of initializeAll remains the same.
// The only change is in the 'try...catch' block inside initializeAll.

export default function LipstickMirrorLive_Clone() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [debugMessage, setDebugMessage] = useState('Initializing...');

  useEffect(() => {
    const initializeAll = async () => {
        setDebugMessage("DEBUG: Loading 3D Lip Model...");
        try {
            // ======================================================================
            // THE ONLY CHANGE IS HERE.
            // We are loading the model and immediately printing the result to the console
            // to see its true structure. The application will then stop.
            // ======================================================================
            console.log("Attempting to load model...");
            const gltfData = await load('/models/lips_model.glb', GLTFLoader);
            
            console.log('----------- !!! IMPORTANT !!! -----------');
            console.log('THIS IS THE ACTUAL LOADED GLTF DATA STRUCTURE:');
            console.log(gltfData);
            console.log('----------- !!! PLEASE COPY THE OBJECT ABOVE AND PASTE IT IN THE CHAT !!! -----------');

            // We are intentionally throwing an error here to stop the program
            // so we can inspect the console log.
            throw new Error("DEBUG: Check the console for the gltfData object structure.");

        } catch (modelLoadError) {
            console.error("[LML_Clone] DEBUGGING:", modelLoadError);
            setError(`DEBUG: ${modelLoadError.message}`);
            setDebugMessage("DEBUG: Check Console");
            return;
        }
    };

    // We only run the initialization, nothing else.
    initializeAll();
  }, []);

  return ( 
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', margin: 0, padding: 0, background: 'darkslateblue' }}>
      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', fontSize: '12px', zIndex: 20, pointerEvents: 'none' }}>
        {error ? `Error: ${error}` : debugMessage}
      </div>
      <canvas ref={canvasRef} width={640} height={480} style={{ width: '100%', height: '100%', display: 'block', background: 'lightpink' }} />
       <video ref={videoRef} style={{ display: 'none' }} />
    </div>
  );
}