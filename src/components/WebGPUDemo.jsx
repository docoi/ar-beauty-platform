useEffect(() => {
  const canvas = canvasRef.current;
  const video = videoRef.current;

  if (!navigator.gpu) {
    console.error("WebGPU not supported.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: true }).then(async (stream) => {
    video.srcObject = stream;
    await video.play();
    console.log("✅ Video started");

    const { device, context, format } = await initWebGPU(canvas);
    console.log("✅ WebGPU initialized");

    const pipeline = await createPipeline(device, format);
    console.log("✅ Pipeline created");

    const render = () => {
      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        }],
      });

      passEncoder.setPipeline(pipeline);
      passEncoder.draw(6, 1, 0, 0); // Draw full screen
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);

      requestAnimationFrame(render);
    };

    render();
  }).catch((err) => {
    console.error("❌ Camera error", err);
  });
}, []);
