import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

export function CompassFloorLabel({ label, color, position, size = 0.82 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 176px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
    context.shadowColor = "rgba(2, 6, 23, 0.45)";
    context.shadowBlur = 18;
    context.fillStyle = color;
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
    const nextTexture = new CanvasTexture(canvas);
    nextTexture.colorSpace = SRGBColorSpace;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [label, color]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;

  return (
    <mesh position={position} rotation={[0, Math.PI, 0]} renderOrder={3}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.08}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
