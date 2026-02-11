/**
 * Video Export Renderer
 * Handles the main export loop, compositing 3D scene with overlays.
 */

import { drawOverlays, calculateLayout } from "./OverlayRenderer.js";

/**
 * Wait for next animation frame
 */
function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Check browser support for video recording
 */
export function checkBrowserSupport() {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement === "undefined" ||
    !HTMLCanvasElement.prototype.captureStream
  ) {
    return {
      supported: false,
      error: "Video export is not supported in this browser. Try Chrome or Edge.",
    };
  }
  return { supported: true };
}

/**
 * Get the best supported video mime type
 */
export function getSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
}

/**
 * Export video from daySeries data
 *
 * @param {Object} options
 * @param {Array} options.daySeries - Array of simulation data points
 * @param {HTMLCanvasElement} options.threeCanvas - The Three.js canvas element
 * @param {Function} options.updateScene - Callback to update scene for each frame
 * @param {number} options.outputWidth - Output video width (default 1920)
 * @param {number} options.outputHeight - Output video height (default 1080)
 * @param {number} options.fps - Frames per second (default 30)
 * @param {number} options.durationSeconds - Video duration in seconds (default 20)
 * @param {Function} options.onProgress - Progress callback (0-1)
 * @returns {Promise<Blob>} - The video blob
 */
export async function exportVideo({
  daySeries,
  threeCanvas,
  updateScene,
  outputWidth = 1920,
  outputHeight = 1080,
  fps = 30,
  durationSeconds = 20,
  onProgress,
}) {
  // Check browser support
  const support = checkBrowserSupport();
  if (!support.supported) {
    throw new Error(support.error);
  }

  // Get mime type
  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new Error("Video recording not supported in this browser.");
  }

  // Create capture canvas
  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = outputWidth;
  captureCanvas.height = outputHeight;
  const ctx = captureCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }

  // Calculate layout
  const layout = calculateLayout(outputWidth, outputHeight);

  // Setup MediaRecorder
  const stream = captureCanvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];

  const recorderStopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start();

  // Calculate total frames
  const totalFrames = Math.ceil(fps * durationSeconds);
  const dataPointsCount = daySeries.length;

  // Background color
  const bgColor = "#f5f3ee";

  // Render frames
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    // Calculate which data point to use
    const progress = frameIndex / (totalFrames - 1);
    const dataIndex = Math.min(
      Math.floor(progress * dataPointsCount),
      dataPointsCount - 1
    );
    const frameData = daySeries[dataIndex];

    // Update the 3D scene
    if (updateScene) {
      await updateScene(frameData, dataIndex, progress);
    }

    // Wait for render to complete
    await waitForNextFrame();

    // Clear canvas and fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    // Draw 3D scene from Three.js canvas
    if (threeCanvas) {
      try {
        // Calculate how to fit the 3D scene in the layout
        const sceneAspect = threeCanvas.width / threeCanvas.height;
        const targetAspect = layout.sceneWidth / layout.sceneHeight;

        let drawWidth, drawHeight, drawX, drawY;

        if (sceneAspect > targetAspect) {
          // Scene is wider - fit to width
          drawWidth = layout.sceneWidth;
          drawHeight = layout.sceneWidth / sceneAspect;
          drawX = 0;
          drawY = (layout.sceneHeight - drawHeight) / 2;
        } else {
          // Scene is taller - fit to height
          drawHeight = layout.sceneHeight;
          drawWidth = layout.sceneHeight * sceneAspect;
          drawX = (layout.sceneWidth - drawWidth) / 2;
          drawY = 0;
        }

        ctx.drawImage(threeCanvas, drawX, drawY, drawWidth, drawHeight);
      } catch (error) {
        console.warn("[VideoExport] Unable to draw WebGL canvas:", error);
      }
    }

    // Draw overlays (metrics, chart)
    drawOverlays(ctx, frameData, daySeries, dataIndex, layout);

    // Report progress
    if (onProgress) {
      onProgress((frameIndex + 1) / totalFrames);
    }

    // Small delay to allow MediaRecorder to process the frame
    // and prevent the browser from becoming unresponsive
    if (frameIndex % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Stop recording
  recorder.stop();
  await recorderStopped;

  // Create video blob
  const videoBlob = new Blob(chunks, { type: mimeType });
  return videoBlob;
}

/**
 * Get file extension for the video format
 */
export function getVideoExtension() {
  return "webm";
}
