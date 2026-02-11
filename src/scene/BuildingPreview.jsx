import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Text, Ring } from "@react-three/drei";
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  RepeatWrapping,
  Vector3,
} from "three";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BUILDING_DEPTH,
  BUILDING_HEIGHT,
  BUILDING_WIDTH,
  FACES,
  deg2rad,
} from "@/engine";

/* -------------------- 3D components -------------------- */
const WALL_THICKNESS = 0.18;
const FLOOR_THICKNESS = 0.12;
const BUILDING_LIFT = 0.25;
const PLINTH_HEIGHT = 0.15;
const PLINTH_RECESS = 0.15;

function WallFace({ faceWidth, faceHeight, glazingPct, overhangDepth, finDepth, hFinDepth }) {
  const wallColor = "#e5e7eb";
  const glassColor = "#dbeafe";
  const shadingColor = "#94a3b8";
  const wt = WALL_THICKNESS;

  const windowWidth = faceWidth * Math.max(0, Math.min(1, glazingPct));
  const windowHeight = faceHeight;
  const gap = (faceWidth - windowWidth) / 2;

  if (glazingPct <= 0.001) {
    return (
      <mesh position={[0, faceHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[faceWidth, faceHeight, wt]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
    );
  }

  return (
    <group>
      {/* Left solid segment */}
      {gap > 0.001 && (
        <mesh position={[-faceWidth / 2 + gap / 2, faceHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[gap, faceHeight, wt]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
      {/* Right solid segment */}
      {gap > 0.001 && (
        <mesh position={[faceWidth / 2 - gap / 2, faceHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[gap, faceHeight, wt]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
      {/* Glazing pane (floor-to-ceiling) */}
      <mesh position={[0, windowHeight / 2, 0.001]}>
        <planeGeometry args={[windowWidth, windowHeight]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent
          opacity={0.35}
          roughness={0.008}
          metalness={0}
          transmission={0.95}
          thickness={0.1}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.015}
          envMapIntensity={1.6}
          reflectivity={0.9}
          specularIntensity={1}
          specularColor="#ffffff"
          side={DoubleSide}
        />
      </mesh>
      {/* Overhang */}
      {overhangDepth > 0.01 && (
        <mesh position={[0, faceHeight + 0.05, -overhangDepth / 2]} castShadow receiveShadow>
          <boxGeometry args={[windowWidth + 0.4, wt / 2, overhangDepth]} />
          <meshStandardMaterial color={shadingColor} />
        </mesh>
      )}
      {/* Vertical fins (brise-soleil) */}
      {finDepth > 0.01 && (() => {
        const FIN_PROJECTION = 0.5; // Fixed 50cm projection from facade
        const FIN_THICKNESS = 0.04; // 4cm thick fins
        const MIN_GAP = 0.15; // Minimum 15cm between fins (dense)
        const MAX_GAP = 1.2; // Maximum 1.2m between fins (sparse)

        // finDepth is in meters (0 to ~2.6m), convert back to 0-1 ratio
        const ratio = Math.min(1, finDepth / 2.6);
        // Map ratio to gap: higher ratio = smaller gap = more fins
        const gap = MAX_GAP - ratio * (MAX_GAP - MIN_GAP);

        // Calculate fin positions across the window width
        const fins = [];
        const startX = -windowWidth / 2;
        const endX = windowWidth / 2;

        // Place fins at regular intervals, always including edge fins
        let x = startX;
        while (x <= endX + 0.001) {
          fins.push(x);
          x += gap;
        }
        // Ensure we have a fin at the right edge if not already there
        if (fins.length > 0 && Math.abs(fins[fins.length - 1] - endX) > 0.05) {
          fins.push(endX);
        }

        return (
          <group>
            {fins.map((finX, i) => (
              <mesh
                key={i}
                position={[finX, faceHeight / 2, -FIN_PROJECTION / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[FIN_THICKNESS, faceHeight + 0.1, FIN_PROJECTION]} />
                <meshStandardMaterial color={shadingColor} />
              </mesh>
            ))}
          </group>
        );
      })()}
      {/* Horizontal fins (louvers) */}
      {hFinDepth > 0.01 && (() => {
        const SLAT_PROJECTION = 0.5; // Fixed 50cm projection from facade (matches vertical fins)
        const SLAT_THICKNESS = 0.03; // 3cm thick slats
        const MIN_GAP = 0.1; // Minimum 10cm between slats (dense)
        const MAX_GAP = 0.6; // Maximum 60cm between slats (sparse)

        // hFinDepth is in meters (0 to ~2.6m), convert back to 0-1 ratio
        const ratio = Math.min(1, hFinDepth / 2.6);
        // Map ratio to gap: higher ratio = smaller gap = more slats
        const slatGap = MAX_GAP - ratio * (MAX_GAP - MIN_GAP);

        // Calculate slat positions across the window height
        const slats = [];
        const startY = 0;
        const endY = faceHeight;

        // Place slats at regular intervals
        let y = startY + slatGap;
        while (y <= endY - 0.001) {
          slats.push(y);
          y += slatGap;
        }

        return (
          <group>
            {slats.map((slatY, i) => (
              <mesh
                key={i}
                position={[0, slatY, -SLAT_PROJECTION / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[windowWidth + 0.1, SLAT_THICKNESS, SLAT_PROJECTION]} />
                <meshStandardMaterial color={shadingColor} />
              </mesh>
            ))}
          </group>
        );
      })()}
    </group>
  );
}

function computeSunPatchHits(faceId, windowW, windowH, dir, halfW, halfD) {
  const wt = WALL_THICKNESS;
  let corners;

  switch (faceId) {
    case "south":
      if (dir.z <= 0.02) return null;
      corners = [
        new Vector3(-windowW / 2, 0, -halfD + wt / 2),
        new Vector3(windowW / 2, 0, -halfD + wt / 2),
        new Vector3(windowW / 2, windowH, -halfD + wt / 2),
        new Vector3(-windowW / 2, windowH, -halfD + wt / 2),
      ];
      break;
    case "north":
      if (dir.z >= -0.02) return null;
      corners = [
        new Vector3(windowW / 2, 0, halfD - wt / 2),
        new Vector3(-windowW / 2, 0, halfD - wt / 2),
        new Vector3(-windowW / 2, windowH, halfD - wt / 2),
        new Vector3(windowW / 2, windowH, halfD - wt / 2),
      ];
      break;
    case "east":
      if (dir.x >= -0.02) return null;
      corners = [
        new Vector3(halfW - wt / 2, 0, windowW / 2),
        new Vector3(halfW - wt / 2, 0, -windowW / 2),
        new Vector3(halfW - wt / 2, windowH, -windowW / 2),
        new Vector3(halfW - wt / 2, windowH, windowW / 2),
      ];
      break;
    case "west":
      if (dir.x <= 0.02) return null;
      corners = [
        new Vector3(-halfW + wt / 2, 0, -windowW / 2),
        new Vector3(-halfW + wt / 2, 0, windowW / 2),
        new Vector3(-halfW + wt / 2, windowH, windowW / 2),
        new Vector3(-halfW + wt / 2, windowH, -windowW / 2),
      ];
      break;
    default:
      return null;
  }

  const hits = corners.map((corner) => {
    if (corner.y <= 0.001) return corner.clone();
    const t = -corner.y / dir.y;
    if (t <= 0) return null;
    const hit = corner.clone().addScaledVector(dir, t);
    hit.y = 0;
    if (Math.abs(hit.x) > halfW + 0.05 || Math.abs(hit.z) > halfD + 0.05) return null;
    return hit;
  });

  if (hits.some((pt) => !pt)) return null;
  return hits;
}

function Compass() {
  const radius = 5.5;
  const tickLength = 0.4;
  const labelOffset = radius + 0.8;

  const cardinals = [
    { label: "N", angle: 180, color: "#6366f1" },
    { label: "E", angle: 90, color: "#059669" },
    { label: "S", angle: 0, color: "#0f766e" },
    { label: "W", angle: 270, color: "#1d4ed8" },
  ];

  const intercardinals = [
    { label: "NE", angle: 135 },
    { label: "SE", angle: 45 },
    { label: "SW", angle: 315 },
    { label: "NW", angle: 225 },
  ];

  return (
    <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer ring */}
      <Ring args={[radius - 0.08, radius, 64]}>
        <meshBasicMaterial color="#475569" />
      </Ring>

      {/* Inner ring */}
      <Ring args={[radius - 0.25, radius - 0.2, 64]}>
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.5} />
      </Ring>

      {/* Cardinal direction ticks and labels */}
      {cardinals.map(({ label, angle, color }) => {
        const rad = deg2rad(-angle + 90);
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const tickEndX = Math.cos(rad) * (radius - tickLength);
        const tickEndY = Math.sin(rad) * (radius - tickLength);
        const labelX = Math.cos(rad) * labelOffset;
        const labelY = Math.sin(rad) * labelOffset;

        return (
          <group key={label}>
            {/* Tick mark */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([x, y, 0, tickEndX, tickEndY, 0])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={color} linewidth={2} />
            </line>
            {/* Label */}
            <Text
              position={[labelX, labelY, 0]}
              rotation={[0, 0, 0]}
              fontSize={0.6}
              color={color}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {label}
            </Text>
          </group>
        );
      })}

      {/* Intercardinal ticks */}
      {intercardinals.map(({ label, angle }) => {
        const rad = deg2rad(-angle + 90);
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const tickEndX = Math.cos(rad) * (radius - tickLength * 0.6);
        const tickEndY = Math.sin(rad) * (radius - tickLength * 0.6);

        return (
          <line key={label}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([x, y, 0, tickEndX, tickEndY, 0])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#64748b" />
          </line>
        );
      })}

      {/* North line - always points to true north */}
      {(() => {
        const northAngle = deg2rad(-90); // Fixed pointing to N label
        const innerRadius = 0.3;
        const outerRadius = radius - 0.3;
        const startX = Math.cos(northAngle) * innerRadius;
        const startY = Math.sin(northAngle) * innerRadius;
        const endX = Math.cos(northAngle) * outerRadius;
        const endY = Math.sin(northAngle) * outerRadius;
        const arrowTipX = Math.cos(northAngle) * (outerRadius + 0.4);
        const arrowTipY = Math.sin(northAngle) * (outerRadius + 0.4);
        const arrowLeftX = Math.cos(northAngle + 0.15) * outerRadius;
        const arrowLeftY = Math.sin(northAngle + 0.15) * outerRadius;
        const arrowRightX = Math.cos(northAngle - 0.15) * outerRadius;
        const arrowRightY = Math.sin(northAngle - 0.15) * outerRadius;
        return (
          <group>
            {/* Main north line */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([startX, startY, 0.01, endX, endY, 0.01])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#dc2626" linewidth={2} />
            </line>
            {/* Arrowhead */}
            <mesh position={[0, 0, 0.01]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={3}
                  array={new Float32Array([
                    arrowTipX, arrowTipY, 0,
                    arrowLeftX, arrowLeftY, 0,
                    arrowRightX, arrowRightY, 0,
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <meshBasicMaterial color="#dc2626" side={DoubleSide} />
            </mesh>
          </group>
        );
      })()}

      {/* Degree markings every 30° */}
      {[30, 60, 120, 150, 210, 240, 300, 330].map((angle) => {
        const rad = deg2rad(-angle + 90);
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const tickEndX = Math.cos(rad) * (radius - tickLength * 0.4);
        const tickEndY = Math.sin(rad) * (radius - tickLength * 0.4);

        return (
          <line key={angle}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([x, y, 0, tickEndX, tickEndY, 0])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#94a3b8" />
          </line>
        );
      })}
    </group>
  );
}

function RoomModel({ faceConfigs, sunDirection, orientationDeg = 0 }) {
  const width = BUILDING_WIDTH;
  const depth = BUILDING_DEPTH;
  const height = BUILDING_HEIGHT;
  const halfW = width / 2;
  const halfD = depth / 2;
  const floorColor = "#f8fafc";
  const ceilingColor = "#aab6c8";
  const groundColor = "#b9d7a5";
  const plinthColor = "#2f343a";
  const plinthWidth = Math.max(0.2, width - PLINTH_RECESS * 2);
  const plinthDepth = Math.max(0.2, depth - PLINTH_RECESS * 2);
  const plinthTopY = BUILDING_LIFT - FLOOR_THICKNESS;
  const plinthCenterY = plinthTopY - PLINTH_HEIGHT / 2;

  const grassTexture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, 0, size, size);
    const darker = ["#9ac485", "#8bb776", "#7eaa69"];
    const lighter = ["#c7e4b4", "#d2eec2"];
    for (let i = 0; i < 1600; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 2 + 0.6;
      ctx.fillStyle = Math.random() > 0.5
        ? darker[Math.floor(Math.random() * darker.length)]
        : lighter[Math.floor(Math.random() * lighter.length)];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(30, 30);
    texture.anisotropy = 4;
    return texture;
  }, [groundColor]);

  const localSunDirection = useMemo(() => {
    if (!sunDirection) return null;
    const dir = sunDirection.clone();
    dir.applyAxisAngle(new Vector3(0, 1, 0), -deg2rad(orientationDeg));
    return dir;
  }, [sunDirection, orientationDeg]);

  const prevGeometriesRef = useRef([]);
  const sunPatches = useMemo(() => {
    prevGeometriesRef.current.forEach((g) => g.dispose());
    prevGeometriesRef.current = [];

    if (!localSunDirection || localSunDirection.lengthSq() === 0 || localSunDirection.y <= 0.02) {
      return [];
    }

    const dir = localSunDirection.clone().negate().normalize();
    if (Math.abs(dir.y) <= 0.02) return [];

    const patches = [];
    FACES.forEach((face) => {
      const config = faceConfigs[face.id];
      if (!config || config.glazing <= 0.001) return;

      const windowSpan = face.id === "east" || face.id === "west" ? depth : width;
      const windowW = windowSpan * config.glazing;
      const windowH = height;
      const hits = computeSunPatchHits(face.id, windowW, windowH, dir, halfW, halfD);
      if (!hits) return;

      const center = hits
        .reduce((acc, pt) => acc.add(pt), new Vector3())
        .multiplyScalar(1 / hits.length);
      const rel = hits.map((pt) => pt.clone().sub(center));
      const geometry = new BufferGeometry();
      const positions = new Float32Array([
        rel[0].x, 0, rel[0].z,
        rel[1].x, 0, rel[1].z,
        rel[2].x, 0, rel[2].z,
        rel[0].x, 0, rel[0].z,
        rel[2].x, 0, rel[2].z,
        rel[3].x, 0, rel[3].z,
      ]);
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      prevGeometriesRef.current.push(geometry);

      patches.push({ center: [center.x, 0.01, center.z], geometry });
    });

    return patches;
  }, [localSunDirection, faceConfigs, width, height, halfW, halfD]);

  useEffect(() => {
    return () => {
      prevGeometriesRef.current.forEach((g) => g.dispose());
    };
  }, []);

  return (
    <group rotation={[0, deg2rad(orientationDeg), 0]}>
      {/* Ground plane */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 96]} />
        <meshStandardMaterial
          color={groundColor}
          map={grassTexture ?? undefined}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Recessed plinth */}
      <mesh position={[0, plinthCenterY, 0]} receiveShadow>
        <boxGeometry args={[plinthWidth, PLINTH_HEIGHT, plinthDepth]} />
        <meshStandardMaterial color={plinthColor} />
      </mesh>

      <group position={[0, BUILDING_LIFT, 0]}>
        {/* Floor slab */}
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow>
          <boxGeometry args={[width, FLOOR_THICKNESS, depth]} />
          <meshStandardMaterial color={floorColor} />
        </mesh>

        {/* Ceiling */}
        <mesh position={[0, height + FLOOR_THICKNESS / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, FLOOR_THICKNESS, depth]} />
          <meshStandardMaterial color={ceilingColor} roughness={0.9} metalness={0} />
        </mesh>

        {/* South face (z = -halfD) */}
        <group position={[0, 0, -halfD + WALL_THICKNESS / 2]}>
          <WallFace
            faceWidth={width}
            faceHeight={height}
            glazingPct={faceConfigs.south.glazing}
            overhangDepth={faceConfigs.south.overhang}
            finDepth={faceConfigs.south.fin}
            hFinDepth={faceConfigs.south.hFin}
          />
        </group>

        {/* North face (z = +halfD), rotated 180 around Y */}
        <group position={[0, 0, halfD - WALL_THICKNESS / 2]} rotation={[0, Math.PI, 0]}>
          <WallFace
            faceWidth={width}
            faceHeight={height}
            glazingPct={faceConfigs.north.glazing}
            overhangDepth={faceConfigs.north.overhang}
            finDepth={faceConfigs.north.fin}
            hFinDepth={faceConfigs.north.hFin}
          />
        </group>

        {/* East face (x = +halfW), rotated -90 around Y */}
        <group position={[halfW - WALL_THICKNESS / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <WallFace
            faceWidth={depth}
            faceHeight={height}
            glazingPct={faceConfigs.east.glazing}
            overhangDepth={faceConfigs.east.overhang}
            finDepth={faceConfigs.east.fin}
            hFinDepth={faceConfigs.east.hFin}
          />
        </group>

        {/* West face (x = -halfW), rotated +90 around Y */}
        <group position={[-halfW + WALL_THICKNESS / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <WallFace
            faceWidth={depth}
            faceHeight={height}
            glazingPct={faceConfigs.west.glazing}
            overhangDepth={faceConfigs.west.overhang}
            finDepth={faceConfigs.west.fin}
            hFinDepth={faceConfigs.west.hFin}
          />
        </group>

        {/* Sun patches */}
        {sunPatches.map((patch, i) => (
          <mesh key={i} position={patch.center} castShadow={false} receiveShadow={false}>
            <primitive attach="geometry" object={patch.geometry} />
            <meshStandardMaterial color="#fde68a" transparent opacity={0.55} side={DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function BuildingPreview({
  faceConfigs,
  snapshot,
  sunDirection,
  outdoorTemp,
  cloudCover,
  ventilationLabel,
  ventilationAch,
  orientationDeg = 0,
  showMetrics = true,
  size = "default",
  stretch = false,
  captureMode = false,
  className,
  canvasClassName,
}) {
  const height = BUILDING_HEIGHT;
  const width = BUILDING_WIDTH;

  const sunAltitude = snapshot?.altitude ?? -90;
  const sunFactor = useMemo(() => {
    const t = (sunAltitude + 8) / 14;
    const clamped = Math.min(1, Math.max(0, t));
    return clamped * clamped * (3 - 2 * clamped);
  }, [sunAltitude]);
  const skyColor = useMemo(() => {
    const day = new Color("#dfe6ed");
    const night = new Color("#0b1020");
    return night.lerp(day, sunFactor).getStyle();
  }, [sunFactor]);
  const hemisphereGround = useMemo(() => {
    const day = new Color("#d1d5db");
    const night = new Color("#0f172a");
    return night.lerp(day, sunFactor).getStyle();
  }, [sunFactor]);
  const ambientIntensity = 0.05 + sunFactor * 0.2;
  const hemisphereIntensity = 0.08 + sunFactor * 0.24;
  const sunIntensity = sunFactor * 2.8;
  const lightPosition = useMemo(() => {
    if (!sunDirection) return [3, 5, 4];
    const pos = sunDirection.clone().normalize().multiplyScalar(15);
    return [pos.x, pos.y, pos.z];
  }, [sunDirection]);
  const sunSpherePosition = useMemo(() => {
    if (!sunDirection) return [0, 0, 0];
    const pos = sunDirection.clone().normalize().multiplyScalar(45);
    return [pos.x, pos.y, pos.z];
  }, [sunDirection]);
  const sunSphereOpacity = Math.min(1, sunFactor * 1.2);
  const lightRef = useRef(null);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.parent?.add?.(light.target);
    light.target.position.set(0, height / 2 + BUILDING_LIFT, 0);
    light.target.updateMatrixWorld();
    return () => {
      light.parent?.remove?.(light.target);
    };
  }, [height]);

  const cameraPosition = useMemo(() => {
    return [width * 1.6, height * 2.2, width * 1.6];
  }, [width, height]);

  const isCompact = size === "compact";
  const basePadding = isCompact ? "p-3" : "p-4";
  const cardClass = cn(
    stretch ? `flex min-h-0 flex-col gap-3 ${basePadding}` : `space-y-3 ${basePadding}`,
    className
  );
  const canvasClass = cn(
    stretch ? "flex-1 min-h-[200px]" : isCompact ? "h-64 md:h-72" : "h-80",
    canvasClassName
  );

  return (
    <Card className={cardClass}>
      <div className={`${canvasClass} overflow-hidden rounded-lg bg-slate-200`}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: cameraPosition, fov: 45, near: 0.1, far: 60 }}
          gl={{ preserveDrawingBuffer: true }}
          className="building-preview-canvas"
        >
          <color attach="background" args={[skyColor]} />
          <ambientLight intensity={ambientIntensity} />
          <hemisphereLight intensity={hemisphereIntensity} groundColor={hemisphereGround} />
          <directionalLight
            ref={lightRef}
            castShadow={sunFactor > 0.02}
            position={lightPosition}
            intensity={sunIntensity}
            color="#ffdf91"
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={30}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-bias={-0.0003}
            shadow-normalBias={0.02}
          />
          <mesh position={sunSpherePosition} visible={sunSphereOpacity > 0.02}>
            <sphereGeometry args={[0.9, 32, 32]} />
            <meshBasicMaterial color="#ffe39a" transparent opacity={sunSphereOpacity} />
          </mesh>
          {!captureMode && <Environment preset="sunset" intensity={0.9 * sunFactor} />}
          {!captureMode && <Environment preset="night" intensity={0.55 * (1 - sunFactor)} />}
          <Compass />
          <RoomModel faceConfigs={faceConfigs} sunDirection={sunDirection} orientationDeg={orientationDeg} />
          <OrbitControls
            enablePan
            enableZoom
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.85}
            target={[0, height / 2, 0]}
          />
        </Canvas>
      </div>
      {showMetrics && (
        <div className="grid grid-cols-5 gap-2 text-xs text-slate-600">
          <div>
            <p className="font-medium text-slate-700">Inside</p>
            <p className="text-lg font-semibold text-slate-900">
              {snapshot.T_room.toFixed(1)}°C
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-700">Solar gain</p>
            <p className="text-lg font-semibold text-slate-900">
              {Math.round(snapshot.Q_solar)} W
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-700">Heat loss</p>
            <p className="text-lg font-semibold text-rose-700">
              {Math.round(snapshot.Q_loss_total)} W
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-700">Outdoor</p>
            <p className="text-lg font-semibold text-slate-900">
              {outdoorTemp.toFixed(1)}°C
            </p>
            {cloudCover !== undefined && (
              <p className="text-[10px] text-slate-500">
                Cloud {Math.round(cloudCover * 10)}%
              </p>
            )}
          </div>
          <div>
            <p className="font-medium text-slate-700">Ventilation</p>
            <p className="text-lg font-semibold text-slate-900">{ventilationLabel}</p>
            <p className="text-[10px] text-slate-500">
              Fresh air rate {ventilationAch.toFixed(2)} air changes per hour
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
