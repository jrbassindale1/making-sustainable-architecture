import { useEffect, useMemo } from "react";
import { RepeatWrapping, SRGBColorSpace } from "three";
import { CLADDING_TILE_WIDTH_M, CLADDING_TILE_HEIGHT_M } from "../../constants/architecture";

export function FacadeCladdingMesh({
  position,
  size,
  uAxis = "x",
  baseColorTexture,
  baseBumpTexture,
  materialProps,
}) {
  const [px, py, pz] = position;
  const [sx, sy, sz] = size;

  const { mapTex, bumpTex } = useMemo(() => {
    const widthU = uAxis === "x" ? sx : sz;
    const startU = uAxis === "x" ? px - sx / 2 : pz - sz / 2;
    const startV = py - sy / 2;
    const repeatX = Math.max(0.01, widthU / CLADDING_TILE_WIDTH_M);
    const repeatY = Math.max(0.01, sy / CLADDING_TILE_HEIGHT_M);
    const offsetX = startU / CLADDING_TILE_WIDTH_M;
    const offsetY = startV / CLADDING_TILE_HEIGHT_M;

    const colorTex = baseColorTexture ? baseColorTexture.clone() : null;
    if (colorTex) {
      colorTex.wrapS = RepeatWrapping;
      colorTex.wrapT = RepeatWrapping;
      colorTex.repeat.set(repeatX, repeatY);
      colorTex.offset.set(offsetX, offsetY);
      colorTex.anisotropy = 8;
      colorTex.colorSpace = SRGBColorSpace;
      colorTex.needsUpdate = true;
    }

    const nextBumpTex = baseBumpTexture ? baseBumpTexture.clone() : null;
    if (nextBumpTex) {
      nextBumpTex.wrapS = RepeatWrapping;
      nextBumpTex.wrapT = RepeatWrapping;
      nextBumpTex.repeat.set(repeatX, repeatY);
      nextBumpTex.offset.set(offsetX, offsetY);
      nextBumpTex.anisotropy = 8;
      nextBumpTex.needsUpdate = true;
    }

    return { mapTex: colorTex, bumpTex: nextBumpTex };
  }, [baseColorTexture, baseBumpTexture, uAxis, px, py, pz, sx, sy, sz]);

  useEffect(() => {
    return () => {
      mapTex?.dispose();
      bumpTex?.dispose();
    };
  }, [mapTex, bumpTex]);

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        {...materialProps}
        map={mapTex ?? undefined}
        bumpMap={bumpTex ?? undefined}
      />
    </mesh>
  );
}
