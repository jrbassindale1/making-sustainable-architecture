import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";

export function RoofGrass({
  patchWidth,
  patchDepth,
  rooflightHole = null,
  position = [0, 0, 0],
}) {
  const groupRef = useRef(null);
  const grassRef = useRef(null);
  const bladeGeometryRef = useRef(null);
  const pointerLocalRef = useRef(new Vector3());
  const pointerActiveRef = useRef(false);
  const pointerTrailRef = useRef([]);
  const lastSampleRef = useRef({ x: Number.NaN, z: Number.NaN, t: -999 });
  const dummy = useMemo(() => new Object3D(), []);
  const holeMinX = rooflightHole?.minX ?? null;
  const holeMaxX = rooflightHole?.maxX ?? null;
  const holeMinZ = rooflightHole?.minZ ?? null;
  const holeMaxZ = rooflightHole?.maxZ ?? null;
  const patchSurfaces = useMemo(() => {
    const safeW = Math.max(0.2, patchWidth);
    const safeD = Math.max(0.2, patchDepth);
    const halfW = safeW / 2;
    const halfD = safeD / 2;
    const surfaces = [];
    const hasHole =
      holeMinX !== null &&
      holeMaxX !== null &&
      holeMinZ !== null &&
      holeMaxZ !== null;

    if (!hasHole) {
      return [{ width: safeW, depth: safeD, x: 0, z: 0 }];
    }

    const cutoutPadding = 0.03;
    const minX = Math.max(-halfW, holeMinX - cutoutPadding);
    const maxX = Math.min(halfW, holeMaxX + cutoutPadding);
    const minZ = Math.max(-halfD, holeMinZ - cutoutPadding);
    const maxZ = Math.min(halfD, holeMaxZ + cutoutPadding);
    const eps = 0.001;

    if (maxX <= minX + eps || maxZ <= minZ + eps) {
      return [{ width: safeW, depth: safeD, x: 0, z: 0 }];
    }

    const southDepth = minZ + halfD;
    if (southDepth > eps) {
      surfaces.push({
        width: safeW,
        depth: southDepth,
        x: 0,
        z: (-halfD + minZ) / 2,
      });
    }

    const northDepth = halfD - maxZ;
    if (northDepth > eps) {
      surfaces.push({
        width: safeW,
        depth: northDepth,
        x: 0,
        z: (maxZ + halfD) / 2,
      });
    }

    const midDepth = maxZ - minZ;
    if (midDepth > eps) {
      const westWidth = minX + halfW;
      if (westWidth > eps) {
        surfaces.push({
          width: westWidth,
          depth: midDepth,
          x: (-halfW + minX) / 2,
          z: (minZ + maxZ) / 2,
        });
      }

      const eastWidth = halfW - maxX;
      if (eastWidth > eps) {
        surfaces.push({
          width: eastWidth,
          depth: midDepth,
          x: (maxX + halfW) / 2,
          z: (minZ + maxZ) / 2,
        });
      }
    }

    if (surfaces.length === 0) {
      return [{ width: safeW, depth: safeD, x: 0, z: 0 }];
    }
    return surfaces;
  }, [patchWidth, patchDepth, holeMinX, holeMaxX, holeMinZ, holeMaxZ]);
  const roofMatTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#89ad54";
    ctx.fillRect(0, 0, size, size);

    const mossTones = ["#a6c86a", "#95b95c", "#86aa50", "#b7d77a", "#9ec463", "#7f9f49"];
    for (let i = 0; i < 5000; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 2 + 0.4;
      ctx.fillStyle = mossTones[Math.floor(Math.random() * mossTones.length)];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparse earthy flecks so it still reads as a planted system.
    for (let i = 0; i < 700; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.8 + 0.5;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(82,64,44,0.24)" : "rgba(110,84,52,0.18)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(12, 12);
    tex.anisotropy = 8;
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { bladeColorTexture, bladeAlphaTexture } = useMemo(() => {
    const w = 64;
    const h = 256;
    const colorCanvas = document.createElement("canvas");
    const alphaCanvas = document.createElement("canvas");
    colorCanvas.width = w;
    colorCanvas.height = h;
    alphaCanvas.width = w;
    alphaCanvas.height = h;
    const colorCtx = colorCanvas.getContext("2d");
    const alphaCtx = alphaCanvas.getContext("2d");
    if (!colorCtx || !alphaCtx) return { bladeColorTexture: null, bladeAlphaTexture: null };

    colorCtx.clearRect(0, 0, w, h);
    alphaCtx.clearRect(0, 0, w, h);

    const bladePath = new Path2D();
    bladePath.moveTo(w * 0.5, h * 0.02);
    bladePath.quadraticCurveTo(w * 0.16, h * 0.34, w * 0.24, h * 0.98);
    bladePath.quadraticCurveTo(w * 0.5, h * 0.90, w * 0.76, h * 0.98);
    bladePath.quadraticCurveTo(w * 0.84, h * 0.34, w * 0.5, h * 0.02);
    bladePath.closePath();

    // Blade color gradient with subtle mottling.
    colorCtx.save();
    colorCtx.clip(bladePath);
    const colorGrad = colorCtx.createLinearGradient(0, h, 0, 0);
    colorGrad.addColorStop(0, "#5f8a3a");
    colorGrad.addColorStop(0.55, "#89b34e");
    colorGrad.addColorStop(1, "#b9d879");
    colorCtx.fillStyle = colorGrad;
    colorCtx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 0.9 + 0.2;
      colorCtx.fillStyle = Math.random() > 0.5 ? "rgba(82,112,44,0.2)" : "rgba(214,240,150,0.22)";
      colorCtx.beginPath();
      colorCtx.arc(x, y, r, 0, Math.PI * 2);
      colorCtx.fill();
    }
    colorCtx.restore();

    // Blade alpha with softened top + sides to avoid card-like rectangles.
    alphaCtx.save();
    alphaCtx.clip(bladePath);
    const alphaGrad = alphaCtx.createLinearGradient(0, h, 0, 0);
    alphaGrad.addColorStop(0, "rgba(255,255,255,0.96)");
    alphaGrad.addColorStop(0.72, "rgba(255,255,255,0.92)");
    alphaGrad.addColorStop(1, "rgba(255,255,255,0)");
    alphaCtx.fillStyle = alphaGrad;
    alphaCtx.fillRect(0, 0, w, h);
    alphaCtx.restore();

    const colorTex = new CanvasTexture(colorCanvas);
    colorTex.needsUpdate = true;
    colorTex.colorSpace = SRGBColorSpace;

    const alphaTex = new CanvasTexture(alphaCanvas);
    alphaTex.needsUpdate = true;

    return { bladeColorTexture: colorTex, bladeAlphaTexture: alphaTex };
  }, []);

  const blades = useMemo(() => {
    const safeW = Math.max(0.2, patchWidth);
    const safeD = Math.max(0.2, patchDepth);
    const area = safeW * safeD;
    const bladeDensityMultiplier = 7;
    const bladesPerTuft = 3;
    const tuftCount = Math.min(
      7000 * bladeDensityMultiplier,
      Math.max(1400 * bladeDensityMultiplier, Math.floor(area * 220 * bladeDensityMultiplier)),
    );
    const holeMargin = 0.14;
    const items = [];
    let attempts = 0;
    const maxAttempts = tuftCount * 10;

    while (items.length < tuftCount * bladesPerTuft && attempts < maxAttempts) {
      attempts += 1;
      const x = (Math.random() - 0.5) * safeW;
      const z = (Math.random() - 0.5) * safeD;

      const insideRooflightHole =
        holeMinX !== null &&
        holeMaxX !== null &&
        holeMinZ !== null &&
        holeMaxZ !== null &&
        x > holeMinX - holeMargin &&
        x < holeMaxX + holeMargin &&
        z > holeMinZ - holeMargin &&
        z < holeMaxZ + holeMargin;
      if (insideRooflightHole) continue;

      const baseYaw = Math.random() * Math.PI * 2;
      const baseHeight = Math.random() * 0.07 + 0.13; // 130mm to 200mm
      const baseWidth = Math.random() * 0.024 + 0.018;
      const tuftJitter = 0.015;

      items.push({
        x: x + (Math.random() - 0.5) * tuftJitter,
        z: z + (Math.random() - 0.5) * tuftJitter,
        width: baseWidth,
        height: baseHeight,
        yaw: baseYaw,
        phase: Math.random() * Math.PI * 2,
        sway: Math.random() * 0.85 + 0.35,
      });
      items.push({
        x: x + (Math.random() - 0.5) * tuftJitter,
        z: z + (Math.random() - 0.5) * tuftJitter,
        width: baseWidth * (Math.random() * 0.25 + 0.88),
        height: Math.random() * 0.07 + 0.13, // 130mm to 200mm
        yaw: baseYaw + Math.PI / 2 + (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
        sway: Math.random() * 0.85 + 0.35,
      });
      items.push({
        x: x + (Math.random() - 0.5) * tuftJitter,
        z: z + (Math.random() - 0.5) * tuftJitter,
        width: baseWidth * (Math.random() * 0.22 + 0.78),
        height: Math.random() * 0.08 + 0.12, // 120mm to 200mm
        yaw: baseYaw + (Math.random() - 0.5) * 1.1,
        phase: Math.random() * Math.PI * 2,
        sway: Math.random() * 0.85 + 0.35,
      });
    }

    return items;
  }, [patchWidth, patchDepth, holeMinX, holeMaxX, holeMinZ, holeMaxZ]);

  useEffect(() => {
    const geometry = bladeGeometryRef.current;
    if (!geometry || geometry.userData?.anchored) return;
    geometry.translate(0, 0.5, 0);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      const taper = Math.max(0.08, 1 - y * 0.82);
      pos.setX(i, pos.getX(i) * taper);
      pos.setZ(i, pos.getZ(i) + y * y * 0.055);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.userData.anchored = true;
  }, []);

  const handlePointerMove = useCallback((event) => {
    event.stopPropagation();
    const group = groupRef.current;
    if (!group) return;
    const local = group.worldToLocal(event.point.clone());
    pointerLocalRef.current.copy(local);
    pointerActiveRef.current = true;
    const now = performance.now() / 1000;
    const last = lastSampleRef.current;
    const dx = local.x - last.x;
    const dz = local.z - last.z;
    const movedEnough = Number.isNaN(last.x) || (dx * dx + dz * dz) > 0.0016;
    const elapsedEnough = now - last.t > 0.03;
    if (movedEnough || elapsedEnough) {
      pointerTrailRef.current.push({ x: local.x, z: local.z, t: now, strength: 1 });
      if (pointerTrailRef.current.length > 12) pointerTrailRef.current.shift();
      lastSampleRef.current = { x: local.x, z: local.z, t: now };
    }
  }, []);

  const handlePointerOut = useCallback((event) => {
    event.stopPropagation();
    pointerActiveRef.current = false;
  }, []);

  useFrame(({ clock }) => {
    const mesh = grassRef.current;
    if (!mesh || blades.length === 0) return;

    const elapsed = clock.getElapsedTime();
    const now = performance.now() / 1000;
    const interactionRadius = 1.75;
    const interactionRadiusSq = interactionRadius * interactionRadius;
    const trailLifetime = 0.85;
    const maxPush = 0.2;
    const pointer = pointerLocalRef.current;
    const pointerActive = pointerActiveRef.current;
    const trail = pointerTrailRef.current.filter((p) => now - p.t <= trailLifetime);
    pointerTrailRef.current = trail;
    if (pointerActive) {
      const canAppendLatest =
        trail.length === 0 ||
        (Math.abs(trail[trail.length - 1].x - pointer.x) + Math.abs(trail[trail.length - 1].z - pointer.z) > 0.03);
      if (canAppendLatest) {
        trail.push({ x: pointer.x, z: pointer.z, t: now, strength: 1 });
        if (trail.length > 12) trail.shift();
      }
    }

    for (let i = 0; i < blades.length; i += 1) {
      const blade = blades[i];
      const ambientSwayX = Math.sin(elapsed * 1.5 + blade.phase) * 0.045 * blade.sway;
      const ambientSwayZ = Math.cos(elapsed * 1.1 + blade.phase * 0.7) * 0.022 * blade.sway;

      let pushX = 0;
      let pushZ = 0;
      for (let j = 0; j < trail.length; j += 1) {
        const sample = trail[j];
        const dx = blade.x - sample.x;
        const dz = blade.z - sample.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < interactionRadiusSq) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const influence = 1 - dist / interactionRadius;
          const age = now - sample.t;
          const ageFade = 1 - age / trailLifetime;
          const w = influence * influence * Math.max(0, ageFade) * sample.strength;
          pushX += (dx / dist) * w;
          pushZ += (dz / dist) * w;
        }
      }

      const bendMag = Math.min(1, Math.sqrt(pushX * pushX + pushZ * pushZ));
      const tiltX = ambientSwayX + pushZ * maxPush;
      const tiltZ = ambientSwayZ - pushX * maxPush;
      dummy.position.set(blade.x, 0, blade.z);
      dummy.rotation.set(tiltX, blade.yaw, tiltZ, "YXZ");
      dummy.scale.set(blade.width, blade.height * (1 - bendMag * 0.05), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (blades.length === 0) return null;

  return (
    <group ref={groupRef} position={position}>
      {patchSurfaces.map((surface, index) => (
        <mesh
          key={`grass-surface-${index}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[surface.x, 0.001, surface.z]}
          receiveShadow
        >
          <planeGeometry args={[surface.width, surface.depth]} />
        <meshStandardMaterial
          map={roofMatTexture ?? undefined}
          color="#9fbe5f"
          roughness={0.96}
          metalness={0}
        />
        </mesh>
      ))}
      {patchSurfaces.map((surface, index) => (
        <mesh
          key={`grass-pointer-${index}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[surface.x, 0.03, surface.z]}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
        >
          <planeGeometry args={[surface.width, surface.depth]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      ))}
      <instancedMesh ref={grassRef} args={[null, null, blades.length]} frustumCulled={false}>
        <planeGeometry ref={bladeGeometryRef} args={[1, 1, 1, 6]} />
        <meshStandardMaterial
          map={bladeColorTexture ?? undefined}
          alphaMap={bladeAlphaTexture ?? undefined}
          alphaTest={0.2}
          transparent
          color="#b0d26d"
          roughness={0.96}
          metalness={0}
          side={DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
