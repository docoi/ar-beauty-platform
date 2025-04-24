// src/components/TryOnRenderer.jsx - ABSOLUTE MINIMUM TEST

import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
// NO THREE.JS IMPORT

console.log("Minimal Renderer: Component script loaded.");

const TryOnRenderer = forwardRef(({ videoWidth, videoHeight, className }, ref) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        // This effect just confirms the component mounted
        console.log("Minimal Renderer: Component Mounted. Canvas Ref:", canvasRef.current);
        if (canvasRef.current) {
            // Optionally try drawing simple 2D context as a basic check
            try {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'orange'; // Orange if 2D context works
                    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                     console.log("Minimal Renderer: Drew orange rectangle.");
                } else {
                     console.log("Minimal Renderer: Failed to get 2D context.");
                     canvasRef.current.style.backgroundColor = 'purple'; // Purple if 2D fails
                }
            } catch (e) {
                 console.error("Minimal Renderer: Error getting/using 2D context:", e);
                 canvasRef.current.style.backgroundColor = 'red'; // Red if error during 2D test
            }
        } else {
             console.error("Minimal Renderer: Canvas ref was null in useEffect!");
        }
    }, []); // Run only once on mount

    // Expose dummy methods
    useImperativeHandle(ref, () => ({
        renderResults: () => { console.log("Minimal Handle: renderResults NOOP"); },
        renderStaticImageResults: () => { console.log("Minimal Handle: renderStaticImageResults NOOP"); },
        clearCanvas: () => { console.log("Minimal Handle: clearCanvas NOOP"); }
    }));

    console.log("Minimal Renderer: Rendering JSX...");
    return (
        <canvas
            ref={canvasRef}
            className={`renderer-canvas ${className || ''}`}
            // Set explicit initial size attributes for 2D context test
            width={videoWidth || 320}
            height={videoHeight || 240}
            // Use inline style for immediate visual feedback
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
                backgroundColor: 'lime', // Lime green initial CSS background
                border: '2px solid red' // Add border for visibility
             }}
        />
    );
});

TryOnRenderer.displayName = 'TryOnRenderer';
export default TryOnRenderer;