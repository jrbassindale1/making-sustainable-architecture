import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls, Ring, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BUILDING_DEPTH,
  BUILDING_HEIGHT,
  BUILDING_WIDTH,
  FACES,
  MIN_WINDOW_CLEAR_HEIGHT,
  clampWindowCenterRatio,
  resolveRooflightConfig,
  WINDOW_SEGMENT_STATE,
  nextWindowSegmentState,
  normalizeWindowSegmentState,
  deg2rad,
} from "@/engine";

/* -------------------- 3D components -------------------- */
const WALL_THICKNESS = 0.3;
const FLOOR_THICKNESS = 0.12;
const BUILDING_LIFT = 0.25;
const PLINTH_HEIGHT = 0.15;
const PLINTH_RECESS = 0.15;
const PARAPET_UPSTAND_HEIGHT = 0.2; // 200 mm above roof slab top
const PARAPET_CLADDING_THICKNESS = 0.02;
const SLAB_EDGE_PULLBACK = 0.02; // 20 mm set back from outer wall/cladding line
const COPING_THICKNESS = 0.05;
const COPING_OVERHANG = 0.02;
const WINDOW_HEAD_CLADDING_OVERLAP = 0.06; // drop cladding 60 mm over window head
const WINDOW_CILL_THICKNESS = 0.02;
const WINDOW_CILL_PROJECTION = 0.08;
const WINDOW_CILL_END_OVERHANG = 0.04;
const WINDOW_CILL_FRAME_OVERLAP = 0.005; // tuck cill 5 mm under frame
const WINDOW_CILL_VERTICAL_OVERLAP = 0.005; // raise cill 5 mm into frame line to avoid clash
const WINDOW_OPEN_TRAVEL = 0.15; // 150 mm
const MAX_WINDOW_LEAF_WIDTH = 0.9; // 900 mm
const ROOFLIGHT_UPSTAND_HEIGHT = 0.12;
const ROOFLIGHT_FRAME_THICKNESS = 0.05;
const ROOFLIGHT_PANEL_THICKNESS = 0.02;
const ROOFLIGHT_SASH_PROFILE = 0.04;
const SHOW_SYNTHETIC_SUN_PATCHES = false;
const DOWNLIGHT_TRIM_RADIUS_M = 0.1;
const DOWNLIGHT_TRIM_THICKNESS_M = 0.02;
const DOWNLIGHT_BEAM_RADIUS_M = 0.095;
const DOWNLIGHT_BEAM_LENGTH_M = 0.08;

function configureTexture(texture, repeat, useSrgb = false) {
  if (!texture) return;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  if (useSrgb) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

function OperableWindowLeaf({
  xCenter,
  topY,
  z,
  leafWidth,
  leafHeight,
  sashProfile,
  frameDepth,
  windowState = WINDOW_SEGMENT_STATE.CLOSED,
  onToggle,
  showInteractionHint = true,
  frameMaterialProps,
  glassMaterialProps,
}) {
  const turnPivotRef = useRef(null);
  const tiltGroupRef = useRef(null);
  const tiltAngleRef = useRef(0);
  const turnAngleRef = useRef(0);
  const prevWindowStateRef = useRef(WINDOW_SEGMENT_STATE.CLOSED);
  const turnPendingRef = useRef(false);
  const glassWidth = Math.max(0.01, leafWidth - sashProfile * 2);
  const glassHeight = Math.max(0.01, leafHeight - sashProfile * 2);
  const glassInset = Math.max(0.002, frameDepth * 0.22);
  const topHungAngle = useMemo(() => {
    const safeHeight = Math.max(leafHeight, 0.001);
    const openingRatio = Math.min(1, WINDOW_OPEN_TRAVEL / safeHeight);
    return Math.asin(openingRatio);
  }, [leafHeight]);
  const safeWindowState = normalizeWindowSegmentState(windowState);
  const turnOpenAngle = Math.PI / 2;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const previousState = prevWindowStateRef.current;
    if (
      safeWindowState === WINDOW_SEGMENT_STATE.TURN &&
      previousState === WINDOW_SEGMENT_STATE.TOP_HUNG &&
      Math.abs(tiltAngleRef.current) > 0.01
    ) {
      turnPendingRef.current = true;
    } else if (safeWindowState !== WINDOW_SEGMENT_STATE.TURN) {
      turnPendingRef.current = false;
    }
    prevWindowStateRef.current = safeWindowState;
  }, [safeWindowState]);

  useFrame((_, delta) => {
    let targetTilt = 0;
    let targetTurn = 0;

    if (safeWindowState === WINDOW_SEGMENT_STATE.TOP_HUNG) {
      targetTilt = topHungAngle;
    } else if (safeWindowState === WINDOW_SEGMENT_STATE.TURN) {
      targetTilt = 0;
      const readyToTurn =
        !turnPendingRef.current || Math.abs(tiltAngleRef.current) <= 0.01;
      if (readyToTurn) {
        turnPendingRef.current = false;
        targetTurn = turnOpenAngle;
      }
    }

    tiltAngleRef.current = MathUtils.damp(tiltAngleRef.current, targetTilt, 10, delta);
    turnAngleRef.current = MathUtils.damp(turnAngleRef.current, targetTurn, 9, delta);
    if (tiltGroupRef.current) tiltGroupRef.current.rotation.x = tiltAngleRef.current;
    if (turnPivotRef.current) turnPivotRef.current.rotation.y = turnAngleRef.current;
  });

  const handleLeafClick = useCallback(
    (event) => {
      event.stopPropagation();
      onToggle?.();
    },
    [onToggle]
  );

  const stopLeafPointer = useCallback((event) => {
    event.stopPropagation();
  }, []);
  const handleLeafHoverStart = useCallback(
    (event) => {
      if (!showInteractionHint) return;
      event.stopPropagation();
      setHovered(true);
    },
    [showInteractionHint]
  );
  const handleLeafHoverEnd = useCallback((event) => {
    if (!showInteractionHint) return;
    event.stopPropagation();
    setHovered(false);
  }, [showInteractionHint]);
  const interactionHintText = useMemo(() => {
    if (safeWindowState === WINDOW_SEGMENT_STATE.CLOSED) return "tap to open";
    if (safeWindowState === WINDOW_SEGMENT_STATE.TOP_HUNG) return "tap to open wider";
    return "tap to close";
  }, [safeWindowState]);

  if (leafWidth <= 0.005 || leafHeight <= 0.005 || sashProfile <= 0.001) return null;

  return (
    <group
      position={[xCenter, topY, z]}
      onPointerDown={stopLeafPointer}
      onClick={handleLeafClick}
      onPointerEnter={handleLeafHoverStart}
      onPointerLeave={handleLeafHoverEnd}
    >
      <group ref={turnPivotRef} position={[-leafWidth / 2, 0, 0]}>
        <group ref={tiltGroupRef} position={[leafWidth / 2, 0, 0]}>
          <mesh position={[-leafWidth / 2 + sashProfile / 2, -leafHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[sashProfile, leafHeight, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh position={[leafWidth / 2 - sashProfile / 2, -leafHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[sashProfile, leafHeight, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh position={[0, -leafHeight + sashProfile / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[leafWidth, sashProfile, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh position={[0, -sashProfile / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[leafWidth, sashProfile, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh position={[0, -leafHeight / 2, -glassInset]}>
            <planeGeometry args={[glassWidth, glassHeight]} />
            <meshPhysicalMaterial {...glassMaterialProps} />
          </mesh>
        </group>
      </group>
      {showInteractionHint && hovered && (
        <Html
          position={[0, 0.1, 0]}
          center
          sprite
          distanceFactor={8}
          transform={false}
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
            background: "rgba(15,23,42,0.9)",
            color: "#f8fafc",
            border: "1px solid rgba(148,163,184,0.5)",
            borderRadius: "999px",
            padding: "2px 8px",
            fontSize: "10px",
            fontWeight: 500,
            boxShadow: "0 6px 18px rgba(2,6,23,0.35)",
          }}
          zIndexRange={[100, 0]}
        >
          <span>{interactionHintText}</span>
        </Html>
      )}
    </group>
  );
}

function WallFace({
  faceId,
  faceWidth,
  faceHeight,
  glazingPct,
  overhangDepth,
  finDepth,
  hFinDepth,
  windowCillLift = 0,
  windowHeadDrop = 0,
  windowCenterRatio = 0,
  getWindowSegmentState,
  onToggleWindow,
  wallMaterialProps,
  glassMaterialProps,
  frameMaterialProps,
  shadingMaterialProps,
  cillMaterialProps,
  captureMode = false,
}) {
  useThree(); // Keep hook for R3F context
  const wt = WALL_THICKNESS;
  const OUTER_FRAME_PROFILE = 0.05; // 50 mm fixed frame
  const SASH_PROFILE = 0.04; // 40 mm operable inner sash
  const FRAME_DEPTH = 0.05; // 50 mm

  const safeGlazingPct = Math.max(0, Math.min(0.8, glazingPct));
  const windowWidth = faceWidth * safeGlazingPct;
  const safeWindowCenterRatio = clampWindowCenterRatio(safeGlazingPct, windowCenterRatio);
  const windowCenterX = safeWindowCenterRatio * (faceWidth / 2);
  const leftJambX = windowCenterX - windowWidth / 2;
  const rightJambX = windowCenterX + windowWidth / 2;
  const maxCillLift = Math.max(0, faceHeight - MIN_WINDOW_CLEAR_HEIGHT);
  const safeCillLift = Math.max(0, Math.min(windowCillLift, maxCillLift));
  const maxHeadDrop = Math.max(0, faceHeight - safeCillLift - MIN_WINDOW_CLEAR_HEIGHT);
  const safeHeadDrop = Math.max(0, Math.min(windowHeadDrop, maxHeadDrop));
  const windowBottomY = safeCillLift;
  const windowTopY = Math.max(windowBottomY + 0.05, faceHeight - safeHeadDrop);
  const windowHeight = Math.max(0.05, windowTopY - windowBottomY);
  const leftGap = Math.max(0, leftJambX + faceWidth / 2);
  const rightGap = Math.max(0, faceWidth / 2 - rightJambX);
  const outerFrameProfile = Math.min(
    OUTER_FRAME_PROFILE,
    windowWidth * 0.45,
    windowHeight * 0.45
  );
  const frameDepth = Math.min(FRAME_DEPTH, wt);
  const clearOpeningWidth = Math.max(0.02, windowWidth - outerFrameProfile * 2);
  const clearOpeningHeight = Math.max(0.02, windowHeight - outerFrameProfile * 2);
  const leafCount = Math.max(1, Math.ceil(clearOpeningWidth / MAX_WINDOW_LEAF_WIDTH));
  const mullionWidth = leafCount > 1 ? outerFrameProfile : 0;
  const leafWidth = Math.max(
    0.02,
    (clearOpeningWidth - mullionWidth * (leafCount - 1)) / leafCount
  );
  const leafHeight = clearOpeningHeight;
  const sashProfile = Math.min(SASH_PROFILE, leafWidth * 0.45, leafHeight * 0.45);
  const leafPitch = leafWidth + mullionWidth;
  const sashSurfaceZ = frameDepth / 2 - 0.002;
  const cillWidth = windowWidth + WINDOW_CILL_END_OVERHANG * 2;
  const cillFrontEdgeZ = -wt / 2 - WINDOW_CILL_PROJECTION;
  const cillBackEdgeZ = sashSurfaceZ + frameDepth / 2 + WINDOW_CILL_FRAME_OVERLAP;
  const cillDepth = Math.max(0.02, cillBackEdgeZ - cillFrontEdgeZ);
  const cillY =
    windowBottomY - WINDOW_CILL_THICKNESS / 2 + WINDOW_CILL_VERTICAL_OVERLAP;
  const cillZ = (cillFrontEdgeZ + cillBackEdgeZ) / 2;
  const wallFaceRef = useRef(null);
  const [windowAreaHovered, setWindowAreaHovered] = useState(false);
  const enableWindowToggle = !captureMode;
  const leafStates = useMemo(
    () =>
      Array.from({ length: leafCount }, (_, leafIndex) =>
        normalizeWindowSegmentState(getWindowSegmentState?.(faceId, leafIndex)),
      ),
    [leafCount, getWindowSegmentState, faceId],
  );
  const hasAnyTurnOpen = leafStates.some((state) => state === WINDOW_SEGMENT_STATE.TURN);
  const hasAnyTopHungOpen = leafStates.some((state) => state === WINDOW_SEGMENT_STATE.TOP_HUNG);
  const windowAreaHintText = hasAnyTurnOpen
    ? "tap to close"
    : hasAnyTopHungOpen
      ? "tap to open wider"
      : "tap to open";

  const handleWindowAreaHoverStart = useCallback((event) => {
    if (!enableWindowToggle) return;
    event.stopPropagation();
    setWindowAreaHovered(true);
  }, [enableWindowToggle]);
  const handleWindowAreaHoverEnd = useCallback((event) => {
    if (!enableWindowToggle) return;
    event.stopPropagation();
    setWindowAreaHovered(false);
  }, [enableWindowToggle]);


  if (glazingPct <= 0.001) {
    return (
      <mesh position={[0, faceHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[faceWidth, faceHeight, wt]} />
        <meshPhysicalMaterial {...wallMaterialProps} />
      </mesh>
    );
  }

  return (
    <group ref={wallFaceRef}>
      {/* Left solid segment */}
      {leftGap > 0.001 && (
        <mesh
          position={[-faceWidth / 2 + leftGap / 2, faceHeight / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[leftGap, faceHeight, wt]} />
          <meshPhysicalMaterial {...wallMaterialProps} />
        </mesh>
      )}
      {/* Right solid segment */}
      {rightGap > 0.001 && (
        <mesh
          position={[faceWidth / 2 - rightGap / 2, faceHeight / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[rightGap, faceHeight, wt]} />
          <meshPhysicalMaterial {...wallMaterialProps} />
        </mesh>
      )}
      {/* Bottom solid segment below window */}
      {windowBottomY > 0.001 && (
        <mesh position={[windowCenterX, windowBottomY / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[windowWidth, windowBottomY, wt]} />
          <meshPhysicalMaterial {...wallMaterialProps} />
        </mesh>
      )}
      {/* Top solid segment above window */}
      {windowTopY < faceHeight - 0.001 && (
        <mesh
          position={[windowCenterX, windowTopY + (faceHeight - windowTopY) / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[windowWidth, faceHeight - windowTopY, wt]} />
          <meshPhysicalMaterial {...wallMaterialProps} />
        </mesh>
      )}
      {/* Fixed outer frame */}
      {outerFrameProfile > 0.005 && (
        <group>
          <mesh
            position={[
              leftJambX + outerFrameProfile / 2,
              windowBottomY + windowHeight / 2,
              sashSurfaceZ,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[outerFrameProfile, windowHeight, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh
            position={[
              rightJambX - outerFrameProfile / 2,
              windowBottomY + windowHeight / 2,
              sashSurfaceZ,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[outerFrameProfile, windowHeight, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh position={[windowCenterX, windowBottomY + outerFrameProfile / 2, sashSurfaceZ]} castShadow receiveShadow>
            <boxGeometry args={[windowWidth, outerFrameProfile, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
          <mesh position={[windowCenterX, windowBottomY + windowHeight - outerFrameProfile / 2, sashSurfaceZ]} castShadow receiveShadow>
            <boxGeometry args={[windowWidth, outerFrameProfile, frameDepth]} />
            <meshPhysicalMaterial {...frameMaterialProps} />
          </mesh>
        </group>
      )}

      {/* Fixed mullions when width exceeds 900 mm */}
      {leafCount > 1 &&
        Array.from({ length: leafCount - 1 }).map((_, i) => {
          const dividerIndex = i + 1;
          const x =
            leftJambX + outerFrameProfile + dividerIndex * leafPitch - mullionWidth / 2;
          return (
            <mesh
              key={`mullion-${dividerIndex}`}
              position={[x, windowBottomY + windowHeight / 2, sashSurfaceZ]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[mullionWidth, clearOpeningHeight, frameDepth]} />
              <meshPhysicalMaterial {...frameMaterialProps} />
            </mesh>
          );
        })}

      {/* Operable inner sashes (with one shared hint for the whole window area) */}
      <group onPointerEnter={handleWindowAreaHoverStart} onPointerLeave={handleWindowAreaHoverEnd}>
        {Array.from({ length: leafCount }).map((_, leafIndex) => {
          const xCenter =
            leftJambX + outerFrameProfile + leafIndex * leafPitch + leafWidth / 2;
          const leafState =
            getWindowSegmentState?.(faceId, leafIndex) ?? WINDOW_SEGMENT_STATE.CLOSED;
          return (
            <OperableWindowLeaf
              key={`leaf-${leafIndex}`}
              xCenter={xCenter}
              topY={windowBottomY + windowHeight - outerFrameProfile}
              z={sashSurfaceZ}
              leafWidth={leafWidth}
              leafHeight={leafHeight}
              sashProfile={sashProfile}
              frameDepth={frameDepth}
              windowState={leafState}
              onToggle={enableWindowToggle ? () => onToggleWindow?.(faceId, leafIndex) : undefined}
              showInteractionHint={false}
              frameMaterialProps={frameMaterialProps}
              glassMaterialProps={glassMaterialProps}
            />
          );
        })}
        {!captureMode && windowAreaHovered && (
          <Html
            position={[windowCenterX, windowBottomY + windowHeight + 0.07, sashSurfaceZ]}
            center
            sprite
            distanceFactor={8}
            transform={false}
            style={{
              pointerEvents: "none",
              whiteSpace: "nowrap",
              background: "rgba(15,23,42,0.9)",
              color: "#f8fafc",
              border: "1px solid rgba(148,163,184,0.5)",
              borderRadius: "999px",
              padding: "2px 8px",
              fontSize: "10px",
              fontWeight: 500,
              boxShadow: "0 6px 18px rgba(2,6,23,0.35)",
            }}
            zIndexRange={[100, 0]}
          >
            <span>{windowAreaHintText}</span>
          </Html>
        )}
      </group>
      {/* Aluminium cill to hide slab/floor edge under the frame */}
      <mesh position={[windowCenterX, cillY, cillZ]} castShadow receiveShadow>
        <boxGeometry args={[cillWidth, WINDOW_CILL_THICKNESS, cillDepth]} />
        <meshPhysicalMaterial {...cillMaterialProps} />
      </mesh>
      {/* Overhang */}
      {overhangDepth > 0.01 && (
        <mesh position={[windowCenterX, windowTopY + 0.05, -overhangDepth / 2]} castShadow receiveShadow>
          <boxGeometry args={[windowWidth + 0.4, wt / 2, overhangDepth]} />
          <meshPhysicalMaterial {...shadingMaterialProps} />
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
        const startX = leftJambX;
        const endX = rightJambX;

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
                position={[finX, windowBottomY + windowHeight / 2, -FIN_PROJECTION / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[FIN_THICKNESS, windowHeight + 0.1, FIN_PROJECTION]} />
                <meshPhysicalMaterial {...shadingMaterialProps} />
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
        const startY = windowBottomY;
        const endY = windowTopY;

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
                position={[windowCenterX, slatY, -SLAT_PROJECTION / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[windowWidth + 0.1, SLAT_THICKNESS, SLAT_PROJECTION]} />
                <meshPhysicalMaterial {...shadingMaterialProps} />
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
        new Vector3(-windowW / 2, 0, -halfD - wt / 2),
        new Vector3(windowW / 2, 0, -halfD - wt / 2),
        new Vector3(windowW / 2, windowH, -halfD - wt / 2),
        new Vector3(-windowW / 2, windowH, -halfD - wt / 2),
      ];
      break;
    case "north":
      if (dir.z >= -0.02) return null;
      corners = [
        new Vector3(windowW / 2, 0, halfD + wt / 2),
        new Vector3(-windowW / 2, 0, halfD + wt / 2),
        new Vector3(-windowW / 2, windowH, halfD + wt / 2),
        new Vector3(windowW / 2, windowH, halfD + wt / 2),
      ];
      break;
    case "east":
      if (dir.x >= -0.02) return null;
      corners = [
        new Vector3(halfW + wt / 2, 0, windowW / 2),
        new Vector3(halfW + wt / 2, 0, -windowW / 2),
        new Vector3(halfW + wt / 2, windowH, -windowW / 2),
        new Vector3(halfW + wt / 2, windowH, windowW / 2),
      ];
      break;
    case "west":
      if (dir.x <= 0.02) return null;
      corners = [
        new Vector3(-halfW - wt / 2, 0, -windowW / 2),
        new Vector3(-halfW - wt / 2, 0, windowW / 2),
        new Vector3(-halfW - wt / 2, windowH, windowW / 2),
        new Vector3(-halfW - wt / 2, windowH, -windowW / 2),
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
  const compassColor = "#ffffff";
  const radius = 5.5;
  const tickLength = 0.4;
  const labelOffset = radius + 0.8;

  const cardinals = [
    { label: "N", angle: 180 },
    { label: "E", angle: 90 },
    { label: "S", angle: 0 },
    { label: "W", angle: 270 },
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
        <meshBasicMaterial color={compassColor} />
      </Ring>

      {/* Cardinal direction ticks and labels */}
      {cardinals.map(({ label, angle }) => {
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
              <lineBasicMaterial color={compassColor} linewidth={2} />
            </line>
            {/* Label */}
            <CompassFloorLabel
              label={label}
              color={compassColor}
              position={[labelX, labelY, 0.01]}
              size={0.82}
            />
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
            <lineBasicMaterial color={compassColor} />
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
              <lineBasicMaterial color={compassColor} linewidth={2} />
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
              <meshBasicMaterial color={compassColor} side={DoubleSide} />
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
            <lineBasicMaterial color={compassColor} />
          </line>
        );
      })}
    </group>
  );
}

function CompassFloorLabel({ label, color, position, size = 0.82 }) {
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
    <mesh position={position} renderOrder={3}>
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

function RoomModel({
  faceConfigs,
  sunDirection,
  sunFactor = 1,
  orientationDeg = 0,
  captureMode = false,
  width = BUILDING_WIDTH,
  depth = BUILDING_DEPTH,
  height = BUILDING_HEIGHT,
  openWindowSegments,
  onToggleWindowSegment,
  onResizeWindowGlazing,
  onJambDragStateChange,
  rooflightSpec,
  rooflightEnabled = true,
  onToggleRooflight,
  downlightsOn = false,
  downlightIntensity = 60,
  downlightAngle = 0.95,
  downlightPenumbra = 1,
  downlightThrowScale = 2.5,
  downlightSourceGlow = 2.5,
}) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const externalWidth = width + WALL_THICKNESS * 2;
  const externalDepth = depth + WALL_THICKNESS * 2;
  const slabWidth = width + Math.max(0, WALL_THICKNESS - SLAB_EDGE_PULLBACK) * 2;
  const slabDepth = depth + Math.max(0, WALL_THICKNESS - SLAB_EDGE_PULLBACK) * 2;
  const resolvedRooflight = useMemo(
    () => resolveRooflightConfig(rooflightSpec, { width, depth }),
    [rooflightSpec, width, depth]
  );
  const hasRooflight = Boolean(rooflightEnabled);
  const rooflightPanelRef = useRef(null);
  const rooflightAngleRef = useRef(0);
  const [rooflightHovered, setRooflightHovered] = useState(false);
  const rooflightInnerWidth = Math.max(0.1, resolvedRooflight.width - ROOFLIGHT_FRAME_THICKNESS * 2);
  const rooflightInnerDepth = Math.max(0.1, resolvedRooflight.depth - ROOFLIGHT_FRAME_THICKNESS * 2);
  const rooflightSashProfile = Math.max(
    0.015,
    Math.min(
      ROOFLIGHT_SASH_PROFILE,
      rooflightInnerWidth * 0.4,
      rooflightInnerDepth * 0.4,
    ),
  );
  const rooflightPanelGlassWidth = Math.max(0.08, rooflightInnerWidth - rooflightSashProfile * 2);
  const rooflightPanelGlassDepth = Math.max(0.08, rooflightInnerDepth - rooflightSashProfile * 2);
  const rooflightPanelSideDepth = Math.max(0.08, rooflightInnerDepth - rooflightSashProfile * 2);
  const slabHalfW = slabWidth / 2;
  const slabHalfD = slabDepth / 2;
  const openingHalfW = rooflightInnerWidth / 2;
  const openingHalfD = rooflightInnerDepth / 2;
  const openingMinX = resolvedRooflight.centerX - openingHalfW;
  const openingMaxX = resolvedRooflight.centerX + openingHalfW;
  const openingMinZ = resolvedRooflight.centerZ - openingHalfD;
  const openingMaxZ = resolvedRooflight.centerZ + openingHalfD;
  const southSlabDepth = Math.max(0, openingMinZ + slabHalfD);
  const northSlabDepth = Math.max(0, slabHalfD - openingMaxZ);
  const westSlabWidth = Math.max(0, openingMinX + slabHalfW);
  const eastSlabWidth = Math.max(0, slabHalfW - openingMaxX);
  const rooflightShaftFrameThickness = Math.max(
    0.015,
    Math.min(
      ROOFLIGHT_FRAME_THICKNESS * 0.8,
      rooflightInnerWidth * 0.35,
      rooflightInnerDepth * 0.35,
    ),
  );
  const rooflightShaftSideDepth = Math.max(
    0.06,
    rooflightInnerDepth - rooflightShaftFrameThickness * 2,
  );
  const rooflightTargetAngle = useMemo(() => {
    if (!hasRooflight) return 0;
    const safeDepth = Math.max(0.001, rooflightInnerDepth);
    const openingRatio = Math.min(1, resolvedRooflight.openHeight / safeDepth);
    return Math.asin(openingRatio);
  }, [hasRooflight, resolvedRooflight.openHeight, rooflightInnerDepth]);
  const handleRooflightClick = useCallback(
    (event) => {
      event.stopPropagation();
      if (captureMode || !hasRooflight) return;
      onToggleRooflight?.();
    },
    [captureMode, hasRooflight, onToggleRooflight]
  );
  const stopRooflightPointer = useCallback((event) => {
    event.stopPropagation();
  }, []);
  const handleRooflightHoverStart = useCallback(
    (event) => {
      event.stopPropagation();
      if (captureMode || !hasRooflight) return;
      setRooflightHovered(true);
    },
    [captureMode, hasRooflight]
  );
  const handleRooflightHoverEnd = useCallback((event) => {
    event.stopPropagation();
    setRooflightHovered(false);
  }, []);
  const rooflightInteractionHintText = useMemo(() => {
    if (!hasRooflight) return "";
    return resolvedRooflight.openHeight > 0.001 ? "tap to close" : "tap to open";
  }, [hasRooflight, resolvedRooflight.openHeight]);
  const grassBaseColor = "#b9d7a5";
  const groundTintColor = useMemo(() => {
    const night = new Color("#121a12");
    const day = new Color("#b9d7a5");
    return night.lerp(day, sunFactor).getStyle();
  }, [sunFactor]);
  const plinthColor = "#2f343a";
  const plinthWidth = Math.max(0.2, externalWidth - PLINTH_RECESS * 2);
  const plinthDepth = Math.max(0.2, externalDepth - PLINTH_RECESS * 2);
  const plinthTopY = BUILDING_LIFT - FLOOR_THICKNESS;
  const plinthCenterY = plinthTopY - PLINTH_HEIGHT / 2;
  const [localOpenWindowSegments, setLocalOpenWindowSegments] = useState(() => ({}));
  const hasControlledWindows = typeof onToggleWindowSegment === "function";
  const resolvedOpenWindowSegments = hasControlledWindows
    ? openWindowSegments ?? {}
    : localOpenWindowSegments;

  const toggleWindowSegment = useCallback(
    (faceId, segmentIndex) => {
      if (captureMode) return;
      if (hasControlledWindows) {
        onToggleWindowSegment(faceId, segmentIndex);
        return;
      }
      const key = `${faceId}:${segmentIndex}`;
      setLocalOpenWindowSegments((prev) => {
        const currentState = normalizeWindowSegmentState(prev[key]);
        const nextState = nextWindowSegmentState(currentState);
        if (nextState === WINDOW_SEGMENT_STATE.CLOSED) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: nextState };
      });
    },
    [captureMode, hasControlledWindows, onToggleWindowSegment]
  );

  const getWindowSegmentState = useCallback(
    (faceId, segmentIndex) =>
      normalizeWindowSegmentState(resolvedOpenWindowSegments[`${faceId}:${segmentIndex}`]),
    [resolvedOpenWindowSegments]
  );

  const {
    wallColorMap,
    wallRoughnessMap,
    wallNormalMap,
    floorColorMap,
    floorRoughnessMap,
    floorNormalMap,
    shadingColorMap,
    shadingRoughnessMap,
    shadingNormalMap,
    glassRoughnessMap,
    glassNormalMap,
  } = useTexture({
    wallColorMap: "/textures/wall/plastered_wall_diff_2k.jpg",
    wallRoughnessMap: "/textures/wall/plastered_wall_rough_2k.jpg",
    wallNormalMap: "/textures/wall/plastered_wall_normal_2k.jpg",
    floorColorMap: "/textures/floor/concrete_floor_diff_2k.jpg",
    floorRoughnessMap: "/textures/floor/concrete_floor_rough_2k.jpg",
    floorNormalMap: "/textures/floor/concrete_floor_normal_2k.jpg",
    shadingColorMap: "/textures/metal/blue_metal_diff_2k.jpg",
    shadingRoughnessMap: "/textures/metal/blue_metal_rough_2k.jpg",
    shadingNormalMap: "/textures/metal/blue_metal_normal_2k.jpg",
    glassRoughnessMap: "/textures/glass/glass_micro_rough_2k.jpg",
    glassNormalMap: "/textures/glass/glass_micro_normal_2k.jpg",
  });

  useEffect(() => {
    configureTexture(wallColorMap, [3.2, 1.4], true);
    configureTexture(wallRoughnessMap, [3.2, 1.4]);
    configureTexture(wallNormalMap, [3.2, 1.4]);
    configureTexture(floorColorMap, [2.4, 2.2], true);
    configureTexture(floorRoughnessMap, [2.4, 2.2]);
    configureTexture(floorNormalMap, [2.4, 2.2]);
    configureTexture(shadingColorMap, [2.1, 1.6], true);
    configureTexture(shadingRoughnessMap, [2.1, 1.6]);
    configureTexture(shadingNormalMap, [2.1, 1.6]);
    configureTexture(glassRoughnessMap, [5.4, 4.2]);
    configureTexture(glassNormalMap, [5.4, 4.2]);
  }, [
    wallColorMap,
    wallRoughnessMap,
    wallNormalMap,
    floorColorMap,
    floorRoughnessMap,
    floorNormalMap,
    shadingColorMap,
    shadingRoughnessMap,
    shadingNormalMap,
    glassRoughnessMap,
    glassNormalMap,
  ]);

  const wallMaterialProps = useMemo(
    () => ({
      color: "#eceff2",
      map: wallColorMap ?? undefined,
      roughnessMap: wallRoughnessMap ?? undefined,
      normalMap: wallNormalMap ?? undefined,
      normalScale: new Vector2(0.38, 0.38),
      roughness: 0.88,
      metalness: 0.02,
      clearcoat: 0.03,
      clearcoatRoughness: 0.8,
    }),
    [wallColorMap, wallRoughnessMap, wallNormalMap]
  );

  const floorMaterialProps = useMemo(
    () => ({
      color: "#eceff3",
      map: floorColorMap ?? undefined,
      roughnessMap: floorRoughnessMap ?? undefined,
      normalMap: floorNormalMap ?? undefined,
      normalScale: new Vector2(0.5, 0.5),
      roughness: 0.73,
      metalness: 0.03,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
    }),
    [floorColorMap, floorRoughnessMap, floorNormalMap]
  );

  const ceilingMaterialProps = useMemo(
    () => ({
      color: "#e6e9ee",
      roughness: 0.9,
      metalness: 0,
      clearcoat: 0,
    }),
    []
  );
  const rooflightRevealMaterialProps = useMemo(
    () => ({
      color: "#e6e9ee",
      roughness: 0.9,
      metalness: 0,
      clearcoat: 0,
    }),
    []
  );

  const shadingMaterialProps = useMemo(
    () => ({
      color: "#8da0b6",
      map: shadingColorMap ?? undefined,
      roughnessMap: shadingRoughnessMap ?? undefined,
      normalMap: shadingNormalMap ?? undefined,
      normalScale: new Vector2(0.28, 0.28),
      roughness: 0.35,
      metalness: 0.52,
      clearcoat: 0.38,
      clearcoatRoughness: 0.35,
    }),
    [shadingColorMap, shadingRoughnessMap, shadingNormalMap]
  );

  const copingMaterialProps = useMemo(
    () => ({
      color: "#b8c2cc",
      roughness: 0.24,
      metalness: 0.86,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
    }),
    []
  );

  const frameMaterialProps = useMemo(
    () => ({
      color: "#6f8198",
      map: shadingColorMap ?? undefined,
      roughnessMap: shadingRoughnessMap ?? undefined,
      normalMap: shadingNormalMap ?? undefined,
      normalScale: new Vector2(0.22, 0.22),
      roughness: 0.28,
      metalness: 0.62,
      clearcoat: 0.42,
      clearcoatRoughness: 0.26,
    }),
    [shadingColorMap, shadingRoughnessMap, shadingNormalMap]
  );

  const glassMaterialProps = useMemo(
    () => ({
      color: "#def3ff",
      roughnessMap: glassRoughnessMap ?? undefined,
      normalMap: glassNormalMap ?? undefined,
      normalScale: new Vector2(0.03, 0.03),
      transparent: true,
      opacity: 0.38,
      roughness: 0.03,
      metalness: 0,
      transmission: 0.97,
      thickness: 0.2,
      ior: 1.52,
      attenuationDistance: 3.5,
      attenuationColor: "#d2ebff",
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 2.1,
      reflectivity: 0.96,
      specularIntensity: 1,
      specularColor: "#ffffff",
      side: DoubleSide,
    }),
    [glassRoughnessMap, glassNormalMap]
  );

  const grassTexture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = grassBaseColor;
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
  }, [grassBaseColor]);

  const localSunDirection = useMemo(() => {
    if (!sunDirection) return null;
    const dir = sunDirection.clone();
    dir.applyAxisAngle(new Vector3(0, 1, 0), -deg2rad(orientationDeg));
    return dir;
  }, [sunDirection, orientationDeg]);
  const downlightLayout = useMemo(() => {
    const insetFromEdge = 0.4;
    const xOffset = Math.max(0, halfW - insetFromEdge);
    const zOffset = Math.max(0, halfD - insetFromEdge);
    const y = Math.max(0.2, height - DOWNLIGHT_TRIM_THICKNESS_M / 2);
    const points = [
      [-xOffset, y, -zOffset],
      [xOffset, y, -zOffset],
      [-xOffset, y, zOffset],
      [xOffset, y, zOffset],
    ];
    const fallbackY = Math.max(0.2, height - DOWNLIGHT_TRIM_THICKNESS_M / 2);
    return points.map(([x, pointY, z]) => [x, pointY ?? fallbackY, z]);
  }, [halfW, halfD, height]);
  const resolvedDownlightIntensity = Math.max(
    0,
    Number.isFinite(downlightIntensity) ? downlightIntensity : 60,
  );
  const resolvedDownlightAngle = Math.max(
    0.15,
    Math.min(1.2, Number.isFinite(downlightAngle) ? downlightAngle : 0.42),
  );
  const resolvedDownlightPenumbra = Math.max(
    0,
    Math.min(1, Number.isFinite(downlightPenumbra) ? downlightPenumbra : 0.42),
  );
  const resolvedDownlightThrowScale = Math.max(
    0.8,
    Math.min(4, Number.isFinite(downlightThrowScale) ? downlightThrowScale : 2.5),
  );
  const resolvedDownlightSourceGlow = Math.max(
    0,
    Math.min(4, Number.isFinite(downlightSourceGlow) ? downlightSourceGlow : 2.5),
  );

  const prevGeometriesRef = useRef([]);
  const sunPatches = useMemo(() => {
    prevGeometriesRef.current.forEach((g) => g.dispose());
    prevGeometriesRef.current = [];
    if (!SHOW_SYNTHETIC_SUN_PATCHES) return [];

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
  }, [localSunDirection, faceConfigs, width, depth, height, halfW, halfD]);

  useEffect(() => {
    return () => {
      prevGeometriesRef.current.forEach((g) => g.dispose());
    };
  }, []);

  useFrame((_, delta) => {
    rooflightAngleRef.current = MathUtils.damp(
      rooflightAngleRef.current,
      rooflightTargetAngle,
      8,
      delta
    );
    if (rooflightPanelRef.current) {
      rooflightPanelRef.current.rotation.x = rooflightAngleRef.current;
    }
  });

  return (
    <group rotation={[0, deg2rad(orientationDeg), 0]}>
      {/* Ground plane */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 96]} />
        <meshStandardMaterial
          color={groundTintColor}
          map={grassTexture ?? undefined}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Recessed plinth */}
      <mesh position={[0, plinthCenterY, 0]} receiveShadow>
        <boxGeometry args={[plinthWidth, PLINTH_HEIGHT, plinthDepth]} />
        <meshPhysicalMaterial color={plinthColor} roughness={0.66} metalness={0.16} />
      </mesh>

      <group position={[0, BUILDING_LIFT, 0]}>
        {/* Floor slab */}
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow>
          <boxGeometry args={[slabWidth, FLOOR_THICKNESS, slabDepth]} />
          <meshPhysicalMaterial {...floorMaterialProps} />
        </mesh>

        {/* Ceiling / rooflight */}
        {hasRooflight ? (
          <>
            {/* Ceiling slab with rooflight opening */}
            {southSlabDepth > 0.001 && (
              <mesh
                position={[0, height + FLOOR_THICKNESS / 2, -slabHalfD + southSlabDepth / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[slabWidth, FLOOR_THICKNESS, southSlabDepth]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}
            {northSlabDepth > 0.001 && (
              <mesh
                position={[0, height + FLOOR_THICKNESS / 2, openingMaxZ + northSlabDepth / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[slabWidth, FLOOR_THICKNESS, northSlabDepth]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}
            {westSlabWidth > 0.001 && (
              <mesh
                position={[-slabHalfW + westSlabWidth / 2, height + FLOOR_THICKNESS / 2, resolvedRooflight.centerZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[westSlabWidth, FLOOR_THICKNESS, rooflightInnerDepth]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}
            {eastSlabWidth > 0.001 && (
              <mesh
                position={[openingMaxX + eastSlabWidth / 2, height + FLOOR_THICKNESS / 2, resolvedRooflight.centerZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[eastSlabWidth, FLOOR_THICKNESS, rooflightInnerDepth]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}

            {/* Rooflight shaft frame through slab thickness (visible inside + outside) */}
            <group
              position={[
                resolvedRooflight.centerX,
                height + FLOOR_THICKNESS / 2,
                resolvedRooflight.centerZ,
              ]}
            >
              <mesh position={[0, 0, -rooflightInnerDepth / 2 + rooflightShaftFrameThickness / 2]} castShadow receiveShadow>
                <boxGeometry args={[rooflightInnerWidth, FLOOR_THICKNESS, rooflightShaftFrameThickness]} />
                <meshPhysicalMaterial {...rooflightRevealMaterialProps} />
              </mesh>
              <mesh position={[0, 0, rooflightInnerDepth / 2 - rooflightShaftFrameThickness / 2]} castShadow receiveShadow>
                <boxGeometry args={[rooflightInnerWidth, FLOOR_THICKNESS, rooflightShaftFrameThickness]} />
                <meshPhysicalMaterial {...rooflightRevealMaterialProps} />
              </mesh>
              <mesh position={[-rooflightInnerWidth / 2 + rooflightShaftFrameThickness / 2, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[rooflightShaftFrameThickness, FLOOR_THICKNESS, rooflightShaftSideDepth]} />
                <meshPhysicalMaterial {...rooflightRevealMaterialProps} />
              </mesh>
              <mesh position={[rooflightInnerWidth / 2 - rooflightShaftFrameThickness / 2, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[rooflightShaftFrameThickness, FLOOR_THICKNESS, rooflightShaftSideDepth]} />
                <meshPhysicalMaterial {...rooflightRevealMaterialProps} />
              </mesh>
            </group>

            {/* Flat rooflight with openable top panel */}
            <group
              position={[
                resolvedRooflight.centerX,
                height + FLOOR_THICKNESS,
                resolvedRooflight.centerZ,
              ]}
            >
              <mesh position={[0, ROOFLIGHT_UPSTAND_HEIGHT / 2, -resolvedRooflight.depth / 2 + ROOFLIGHT_FRAME_THICKNESS / 2]} castShadow receiveShadow>
                <boxGeometry args={[resolvedRooflight.width, ROOFLIGHT_UPSTAND_HEIGHT, ROOFLIGHT_FRAME_THICKNESS]} />
                <meshPhysicalMaterial {...frameMaterialProps} />
              </mesh>
              <mesh position={[0, ROOFLIGHT_UPSTAND_HEIGHT / 2, resolvedRooflight.depth / 2 - ROOFLIGHT_FRAME_THICKNESS / 2]} castShadow receiveShadow>
                <boxGeometry args={[resolvedRooflight.width, ROOFLIGHT_UPSTAND_HEIGHT, ROOFLIGHT_FRAME_THICKNESS]} />
                <meshPhysicalMaterial {...frameMaterialProps} />
              </mesh>
              <mesh position={[-resolvedRooflight.width / 2 + ROOFLIGHT_FRAME_THICKNESS / 2, ROOFLIGHT_UPSTAND_HEIGHT / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[ROOFLIGHT_FRAME_THICKNESS, ROOFLIGHT_UPSTAND_HEIGHT, rooflightInnerDepth]} />
                <meshPhysicalMaterial {...frameMaterialProps} />
              </mesh>
              <mesh position={[resolvedRooflight.width / 2 - ROOFLIGHT_FRAME_THICKNESS / 2, ROOFLIGHT_UPSTAND_HEIGHT / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[ROOFLIGHT_FRAME_THICKNESS, ROOFLIGHT_UPSTAND_HEIGHT, rooflightInnerDepth]} />
                <meshPhysicalMaterial {...frameMaterialProps} />
              </mesh>

              <group
                ref={rooflightPanelRef}
                position={[0, ROOFLIGHT_UPSTAND_HEIGHT + ROOFLIGHT_PANEL_THICKNESS / 2, rooflightInnerDepth / 2]}
                onPointerDown={stopRooflightPointer}
                onClick={handleRooflightClick}
                onPointerEnter={handleRooflightHoverStart}
                onPointerLeave={handleRooflightHoverEnd}
              >
                <group position={[0, 0, -rooflightInnerDepth / 2]}>
                  <mesh position={[0, 0, -rooflightInnerDepth / 2 + rooflightSashProfile / 2]} castShadow receiveShadow>
                    <boxGeometry args={[rooflightInnerWidth, ROOFLIGHT_PANEL_THICKNESS, rooflightSashProfile]} />
                    <meshPhysicalMaterial {...frameMaterialProps} />
                  </mesh>
                  <mesh position={[0, 0, rooflightInnerDepth / 2 - rooflightSashProfile / 2]} castShadow receiveShadow>
                    <boxGeometry args={[rooflightInnerWidth, ROOFLIGHT_PANEL_THICKNESS, rooflightSashProfile]} />
                    <meshPhysicalMaterial {...frameMaterialProps} />
                  </mesh>
                  <mesh position={[-rooflightInnerWidth / 2 + rooflightSashProfile / 2, 0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[rooflightSashProfile, ROOFLIGHT_PANEL_THICKNESS, rooflightPanelSideDepth]} />
                    <meshPhysicalMaterial {...frameMaterialProps} />
                  </mesh>
                  <mesh position={[rooflightInnerWidth / 2 - rooflightSashProfile / 2, 0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[rooflightSashProfile, ROOFLIGHT_PANEL_THICKNESS, rooflightPanelSideDepth]} />
                    <meshPhysicalMaterial {...frameMaterialProps} />
                  </mesh>
                  <mesh castShadow={false} receiveShadow>
                    <boxGeometry args={[rooflightPanelGlassWidth, ROOFLIGHT_PANEL_THICKNESS * 0.6, rooflightPanelGlassDepth]} />
                    <meshPhysicalMaterial {...glassMaterialProps} />
                  </mesh>
                </group>
                {rooflightHovered && (
                  <Html
                    position={[0, 0.09, -0.01]}
                    center
                    sprite
                    distanceFactor={8}
                    transform={false}
                    style={{
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                      background: "rgba(15,23,42,0.9)",
                      color: "#f8fafc",
                      border: "1px solid rgba(148,163,184,0.5)",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 500,
                      boxShadow: "0 6px 18px rgba(2,6,23,0.35)",
                    }}
                    zIndexRange={[100, 0]}
                  >
                    <span>{rooflightInteractionHintText}</span>
                  </Html>
                )}
              </group>
            </group>
          </>
        ) : (
          <mesh position={[0, height + FLOOR_THICKNESS / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[slabWidth, FLOOR_THICKNESS, slabDepth]} />
            <meshPhysicalMaterial {...ceilingMaterialProps} />
          </mesh>
        )}

        {downlightLayout.map((position, index) => (
          <CeilingDownlight
            key={`downlight-${index}`}
            position={position}
            downlightsOn={downlightsOn}
            intensity={resolvedDownlightIntensity}
            throwScale={resolvedDownlightThrowScale}
            angle={resolvedDownlightAngle}
            penumbra={resolvedDownlightPenumbra}
            sourceGlow={resolvedDownlightSourceGlow}
            roomHeight={height}
          />
        ))}

        {/* South face (z = -halfD internal, wall outside room) */}
        <group position={[0, 0, -halfD - WALL_THICKNESS / 2]}>
          <WallFace
            faceId="south"
            faceWidth={width}
            faceHeight={height}
            glazingPct={faceConfigs.south.glazing}
            overhangDepth={faceConfigs.south.overhang}
            finDepth={faceConfigs.south.fin}
            hFinDepth={faceConfigs.south.hFin}
            windowCillLift={faceConfigs.south.cillLift ?? 0}
            windowHeadDrop={faceConfigs.south.headDrop ?? 0}
            windowCenterRatio={faceConfigs.south.windowCenterRatio ?? 0}
            getWindowSegmentState={getWindowSegmentState}
            onToggleWindow={toggleWindowSegment}
            onResizeGlazing={onResizeWindowGlazing}
            onJambDragStateChange={onJambDragStateChange}
            wallMaterialProps={wallMaterialProps}
            glassMaterialProps={glassMaterialProps}
            frameMaterialProps={frameMaterialProps}
            shadingMaterialProps={shadingMaterialProps}
            cillMaterialProps={frameMaterialProps}
            captureMode={captureMode}
          />
        </group>

        {/* North face (z = +halfD internal, wall outside room), rotated 180 around Y */}
        <group position={[0, 0, halfD + WALL_THICKNESS / 2]} rotation={[0, Math.PI, 0]}>
          <WallFace
            faceId="north"
            faceWidth={width}
            faceHeight={height}
            glazingPct={faceConfigs.north.glazing}
            overhangDepth={faceConfigs.north.overhang}
            finDepth={faceConfigs.north.fin}
            hFinDepth={faceConfigs.north.hFin}
            windowCillLift={faceConfigs.north.cillLift ?? 0}
            windowHeadDrop={faceConfigs.north.headDrop ?? 0}
            windowCenterRatio={faceConfigs.north.windowCenterRatio ?? 0}
            getWindowSegmentState={getWindowSegmentState}
            onToggleWindow={toggleWindowSegment}
            onResizeGlazing={onResizeWindowGlazing}
            onJambDragStateChange={onJambDragStateChange}
            wallMaterialProps={wallMaterialProps}
            glassMaterialProps={glassMaterialProps}
            frameMaterialProps={frameMaterialProps}
            shadingMaterialProps={shadingMaterialProps}
            cillMaterialProps={frameMaterialProps}
            captureMode={captureMode}
          />
        </group>

        {/* East face (x = +halfW internal, wall outside room), rotated -90 around Y */}
        <group position={[halfW + WALL_THICKNESS / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <WallFace
            faceId="east"
            faceWidth={depth}
            faceHeight={height}
            glazingPct={faceConfigs.east.glazing}
            overhangDepth={faceConfigs.east.overhang}
            finDepth={faceConfigs.east.fin}
            hFinDepth={faceConfigs.east.hFin}
            windowCillLift={faceConfigs.east.cillLift ?? 0}
            windowHeadDrop={faceConfigs.east.headDrop ?? 0}
            windowCenterRatio={faceConfigs.east.windowCenterRatio ?? 0}
            getWindowSegmentState={getWindowSegmentState}
            onToggleWindow={toggleWindowSegment}
            onResizeGlazing={onResizeWindowGlazing}
            onJambDragStateChange={onJambDragStateChange}
            wallMaterialProps={wallMaterialProps}
            glassMaterialProps={glassMaterialProps}
            frameMaterialProps={frameMaterialProps}
            shadingMaterialProps={shadingMaterialProps}
            cillMaterialProps={frameMaterialProps}
            captureMode={captureMode}
          />
        </group>

        {/* West face (x = -halfW internal, wall outside room), rotated +90 around Y */}
        <group position={[-halfW - WALL_THICKNESS / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <WallFace
            faceId="west"
            faceWidth={depth}
            faceHeight={height}
            glazingPct={faceConfigs.west.glazing}
            overhangDepth={faceConfigs.west.overhang}
            finDepth={faceConfigs.west.fin}
            hFinDepth={faceConfigs.west.hFin}
            windowCillLift={faceConfigs.west.cillLift ?? 0}
            windowHeadDrop={faceConfigs.west.headDrop ?? 0}
            windowCenterRatio={faceConfigs.west.windowCenterRatio ?? 0}
            getWindowSegmentState={getWindowSegmentState}
            onToggleWindow={toggleWindowSegment}
            onResizeGlazing={onResizeWindowGlazing}
            onJambDragStateChange={onJambDragStateChange}
            wallMaterialProps={wallMaterialProps}
            glassMaterialProps={glassMaterialProps}
            frameMaterialProps={frameMaterialProps}
            shadingMaterialProps={shadingMaterialProps}
            cillMaterialProps={frameMaterialProps}
            captureMode={captureMode}
          />
        </group>

        {/* Timber cladding: continuous at outer face from floor slab to parapet top */}
        {(() => {
          const makeCladdingPanels = (internalSpan, glazingPct, windowCenterRatio = 0) => {
            const clampedGlazing = Math.max(0, Math.min(0.8, glazingPct ?? 0));
            const windowWidth = internalSpan * clampedGlazing;
            const clampedCenterRatio = clampWindowCenterRatio(
              clampedGlazing,
              windowCenterRatio ?? 0,
            );
            const windowCenter = clampedCenterRatio * (internalSpan / 2);
            const windowLeft = windowCenter - windowWidth / 2;
            const windowRight = windowCenter + windowWidth / 2;
            const fullSpan = internalSpan + WALL_THICKNESS * 2;
            const bottomBandHeight = FLOOR_THICKNESS;
            const windowZoneHeight = Math.max(0.01, height - WINDOW_HEAD_CLADDING_OVERLAP);
            const topBandBaseY = windowZoneHeight;
            const topBandTopY = height + FLOOR_THICKNESS + PARAPET_UPSTAND_HEIGHT;
            const topBandHeight = Math.max(0.01, topBandTopY - topBandBaseY);
            const bottomBandCenterY = -FLOOR_THICKNESS / 2;
            const windowZoneCenterY = windowZoneHeight / 2;
            const topBandCenterY = topBandBaseY + topBandHeight / 2;
            const panels = [
              { center: 0, centerY: bottomBandCenterY, span: fullSpan, panelHeight: bottomBandHeight },
              { center: 0, centerY: topBandCenterY, span: fullSpan, panelHeight: topBandHeight },
            ];

            if (clampedGlazing <= 0.001) {
              panels.push({
                center: 0,
                centerY: windowZoneCenterY,
                span: fullSpan,
                panelHeight: windowZoneHeight,
              });
              return panels;
            }

            const leftSpan = Math.max(0, windowLeft + internalSpan / 2) + WALL_THICKNESS;
            const rightSpan = Math.max(0, internalSpan / 2 - windowRight) + WALL_THICKNESS;
            if (leftSpan <= 0.001 && rightSpan <= 0.001) return panels;

            if (leftSpan > 0.001) {
              panels.push({
                center: -fullSpan / 2 + leftSpan / 2,
                centerY: windowZoneCenterY,
                span: leftSpan,
                panelHeight: windowZoneHeight,
              });
            }
            if (rightSpan > 0.001) {
              panels.push({
                center: fullSpan / 2 - rightSpan / 2,
                centerY: windowZoneCenterY,
                span: rightSpan,
                panelHeight: windowZoneHeight,
              });
            }
            return panels;
          };

          const claddingThickness = PARAPET_CLADDING_THICKNESS;
          const southNorthCladdingZ = halfD + WALL_THICKNESS - claddingThickness / 2;
          const eastWestCladdingX = halfW + WALL_THICKNESS - claddingThickness / 2;
          const southNorthCladdingLength = width + WALL_THICKNESS * 2;
          const eastWestCladdingLength = depth + WALL_THICKNESS * 2;
          const southPanels = makeCladdingPanels(
            width,
            faceConfigs.south.glazing,
            faceConfigs.south.windowCenterRatio,
          );
          const northPanels = makeCladdingPanels(
            width,
            faceConfigs.north.glazing,
            faceConfigs.north.windowCenterRatio,
          );
          const eastPanels = makeCladdingPanels(
            depth,
            faceConfigs.east.glazing,
            faceConfigs.east.windowCenterRatio,
          );
          const westPanels = makeCladdingPanels(
            depth,
            faceConfigs.west.glazing,
            faceConfigs.west.windowCenterRatio,
          );
          const copingWidthAcrossWall = WALL_THICKNESS + COPING_OVERHANG * 2;
          const copingCenterY =
            height + FLOOR_THICKNESS + PARAPET_UPSTAND_HEIGHT + COPING_THICKNESS / 2;
          const southNorthCopingLength = southNorthCladdingLength + COPING_OVERHANG * 2;
          const eastWestCopingLength = eastWestCladdingLength + COPING_OVERHANG * 2;
          const southNorthCopingZ = halfD + WALL_THICKNESS / 2;
          const eastWestCopingX = halfW + WALL_THICKNESS / 2;

          return (
            <group>
              {/* South / North cladding */}
              {southPanels.map((panel, i) => (
                <mesh
                  key={`south-clad-${i}`}
                  position={[panel.center, panel.centerY, -southNorthCladdingZ]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[panel.span, panel.panelHeight, claddingThickness]} />
                  <meshPhysicalMaterial {...wallMaterialProps} />
                </mesh>
              ))}
              {northPanels.map((panel, i) => (
                <mesh
                  key={`north-clad-${i}`}
                  position={[panel.center, panel.centerY, southNorthCladdingZ]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[panel.span, panel.panelHeight, claddingThickness]} />
                  <meshPhysicalMaterial {...wallMaterialProps} />
                </mesh>
              ))}

              {/* East / West cladding */}
              {eastPanels.map((panel, i) => (
                <mesh
                  key={`east-clad-${i}`}
                  position={[eastWestCladdingX, panel.centerY, panel.center]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[claddingThickness, panel.panelHeight, panel.span]} />
                  <meshPhysicalMaterial {...wallMaterialProps} />
                </mesh>
              ))}
              {westPanels.map((panel, i) => (
                <mesh
                  key={`west-clad-${i}`}
                  position={[-eastWestCladdingX, panel.centerY, panel.center]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[claddingThickness, panel.panelHeight, panel.span]} />
                  <meshPhysicalMaterial {...wallMaterialProps} />
                </mesh>
              ))}

              {/* Aluminium coping to cap the upstand */}
              <mesh position={[0, copingCenterY, -southNorthCopingZ]} castShadow receiveShadow>
                <boxGeometry args={[southNorthCopingLength, COPING_THICKNESS, copingWidthAcrossWall]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
              <mesh position={[0, copingCenterY, southNorthCopingZ]} castShadow receiveShadow>
                <boxGeometry args={[southNorthCopingLength, COPING_THICKNESS, copingWidthAcrossWall]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
              <mesh position={[eastWestCopingX, copingCenterY, 0]} castShadow receiveShadow>
                <boxGeometry args={[copingWidthAcrossWall, COPING_THICKNESS, eastWestCopingLength]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
              <mesh position={[-eastWestCopingX, copingCenterY, 0]} castShadow receiveShadow>
                <boxGeometry args={[copingWidthAcrossWall, COPING_THICKNESS, eastWestCopingLength]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
            </group>
          );
        })()}

        {/* Sun patches */}
        {SHOW_SYNTHETIC_SUN_PATCHES &&
          sunPatches.map((patch, i) => (
            <mesh key={i} position={patch.center} castShadow={false} receiveShadow={false}>
              <primitive attach="geometry" object={patch.geometry} />
              <meshStandardMaterial color="#fde68a" transparent opacity={0.55} side={DoubleSide} />
            </mesh>
          ))}
      </group>
    </group>
  );
}

function CeilingDownlight({
  position,
  downlightsOn,
  intensity,
  throwScale,
  angle,
  penumbra,
  sourceGlow,
  roomHeight,
}) {
  const lightRef = useRef(null);
  const spillLightRef = useRef(null);
  const glowRadius = Math.max(
    DOWNLIGHT_TRIM_RADIUS_M * 0.28,
    Math.min(
      DOWNLIGHT_TRIM_RADIUS_M * 0.92,
      DOWNLIGHT_TRIM_RADIUS_M * (0.42 + sourceGlow * 0.24),
    ),
  );
  const glowOpacityOn = Math.max(0.12, Math.min(1, 0.38 + sourceGlow * 0.38));

  useEffect(() => {
    const lights = [lightRef.current, spillLightRef.current].filter(Boolean);
    if (lights.length === 0) return;
    lights.forEach((light) => {
      light.parent?.add?.(light.target);
      light.target.position.set(position[0], 0, position[2]);
      light.target.updateMatrixWorld();
    });
    return () => {
      lights.forEach((light) => {
        light.parent?.remove?.(light.target);
      });
    };
  }, [position]);

  return (
    <group>
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry
          args={[DOWNLIGHT_TRIM_RADIUS_M, DOWNLIGHT_TRIM_RADIUS_M, DOWNLIGHT_TRIM_THICKNESS_M, 24]}
        />
        <meshPhysicalMaterial color="#cbd5e1" roughness={0.35} metalness={0.72} />
      </mesh>
      <mesh
        position={[position[0], position[1] - DOWNLIGHT_TRIM_THICKNESS_M * 0.9, position[2]]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow={false}
        receiveShadow={false}
      >
        <cylinderGeometry
          args={[glowRadius, glowRadius, DOWNLIGHT_TRIM_THICKNESS_M * 0.3, 24]}
        />
        <meshBasicMaterial
          color={downlightsOn ? "#fff6d5" : "#9ca3af"}
          transparent
          opacity={downlightsOn ? glowOpacityOn : 0.06}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        visible={downlightsOn}
        position={[position[0], position[1] - DOWNLIGHT_BEAM_LENGTH_M / 2, position[2]]}
        rotation={[Math.PI, 0, 0]}
        castShadow={false}
        receiveShadow={false}
      >
        <coneGeometry args={[DOWNLIGHT_BEAM_RADIUS_M, DOWNLIGHT_BEAM_LENGTH_M, 24]} />
        <meshBasicMaterial
          color="#fff8de"
          transparent
          opacity={0.98}
        />
      </mesh>
      <spotLight
        ref={lightRef}
        position={[position[0], position[1] - 0.05, position[2]]}
        intensity={downlightsOn ? intensity : 0}
        color="#ffe8bb"
        distance={Math.max(1.8, roomHeight * throwScale)}
        angle={angle}
        penumbra={penumbra}
        decay={2}
        castShadow={downlightsOn}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.00008}
        shadow-normalBias={0.02}
      />
      <spotLight
        ref={spillLightRef}
        position={[position[0], position[1] - 0.06, position[2]]}
        intensity={downlightsOn ? intensity * 0.6 : 0}
        color="#ffefc7"
        distance={Math.max(2.2, roomHeight * throwScale * 1.35)}
        angle={Math.min(1.05, angle * 1.45)}
        penumbra={Math.max(0.85, penumbra)}
        decay={2}
        castShadow={false}
      />
    </group>
  );
}

function SunOrb({ position, opacity, animate }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const haloRef = useRef(null);
  const haloMaterialRef = useRef(null);

  useEffect(() => {
    if (!meshRef.current || !materialRef.current || !haloRef.current || !haloMaterialRef.current) return;
    meshRef.current.scale.set(1, 1, 1);
    haloRef.current.scale.set(1, 1, 1);
    materialRef.current.opacity = opacity;
    haloMaterialRef.current.opacity = opacity * 0.45;
  }, [opacity, animate]);

  useFrame(({ clock }) => {
    if (
      !animate ||
      !meshRef.current ||
      !materialRef.current ||
      !haloRef.current ||
      !haloMaterialRef.current
    ) return;
    const pulse = (Math.sin(clock.getElapsedTime() * 1.7) + 1) / 2;
    const coreScale = 1 + pulse * 0.22;
    const haloScale = 1.35 + pulse * 0.36;
    meshRef.current.scale.set(coreScale, coreScale, coreScale);
    haloRef.current.scale.set(haloScale, haloScale, haloScale);
    materialRef.current.opacity = Math.min(1, opacity * (0.9 + pulse * 0.3));
    haloMaterialRef.current.opacity = Math.min(1, opacity * 0.5 * (0.78 + pulse * 0.22));
  });

  return (
    <group position={position} visible={opacity > 0.02}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[1.85, 32, 32]} />
        <meshBasicMaterial
          ref={haloMaterialRef}
          color="#ffe8a8"
          transparent
          opacity={opacity * 0.45}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          color="#fff2be"
          transparent
          opacity={opacity}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

function ScenePostProcessing({ sunFactor, captureMode }) {
  return (
    <EffectComposer multisampling={captureMode ? 2 : 4} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={captureMode ? 8 : 14}
        radius={0.085}
        intensity={15}
        luminanceInfluence={0.25}
        color="black"
      />
      <Bloom
        blendFunction={BlendFunction.SCREEN}
        mipmapBlur
        luminanceThreshold={0.82}
        luminanceSmoothing={0.2}
        intensity={0.14 + sunFactor * 0.3}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.22} darkness={0.33} />
    </EffectComposer>
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
  buildingWidth = BUILDING_WIDTH,
  buildingDepth = BUILDING_DEPTH,
  buildingHeight = BUILDING_HEIGHT,
  orientationDeg = 0,
  showMetrics = true,
  size = "default",
  stretch = false,
  captureMode = false,
  openWindowSegments,
  onToggleWindowSegment,
  onResizeWindowGlazing,
  rooflightSpec,
  rooflightEnabled = true,
  onToggleRooflight,
  downlightsOn = false,
  downlightIntensity = 60,
  downlightAngle = 0.95,
  downlightPenumbra = 1,
  downlightThrowScale = 2.5,
  downlightSourceGlow = 2.5,
  className,
  canvasClassName,
}) {
  const height = buildingHeight;
  const width = buildingWidth;

  const sunAltitude = snapshot?.altitude ?? -90;
  const sunFactor = useMemo(() => {
    const t = (sunAltitude + 8) / 14;
    const clamped = Math.min(1, Math.max(0, t));
    return clamped * clamped * (3 - 2 * clamped);
  }, [sunAltitude]);
  const skyColor = useMemo(() => {
    const day = new Color("#9fcaf0");
    const night = new Color("#0b1020");
    return night.lerp(day, sunFactor).getStyle();
  }, [sunFactor]);
  const fogColor = useMemo(() => {
    const day = new Color("#a8cae6");
    const night = new Color("#0b1020");
    return night.lerp(day, sunFactor).getStyle();
  }, [sunFactor]);
  const fogNear = 34 + sunFactor * 8;
  const fogFar = 57 + sunFactor * 2;
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
  const [isJambDragging, setIsJambDragging] = useState(false);

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
          <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
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
          <SunOrb position={sunSpherePosition} opacity={sunSphereOpacity} animate={!captureMode} />
          {!captureMode && <Environment preset="sunset" intensity={0.9 * sunFactor} />}
          {!captureMode && <Environment preset="night" intensity={0.55 * (1 - sunFactor)} />}
          <Compass />
          <RoomModel
            faceConfigs={faceConfigs}
            sunDirection={sunDirection}
            sunFactor={sunFactor}
            orientationDeg={orientationDeg}
            captureMode={captureMode}
            width={buildingWidth}
            depth={buildingDepth}
            height={buildingHeight}
            openWindowSegments={openWindowSegments}
            onToggleWindowSegment={onToggleWindowSegment}
            onResizeWindowGlazing={onResizeWindowGlazing}
            onJambDragStateChange={setIsJambDragging}
            rooflightSpec={rooflightSpec}
            rooflightEnabled={rooflightEnabled}
            onToggleRooflight={onToggleRooflight}
            downlightsOn={downlightsOn}
            downlightIntensity={downlightIntensity}
            downlightAngle={downlightAngle}
            downlightPenumbra={downlightPenumbra}
            downlightThrowScale={downlightThrowScale}
            downlightSourceGlow={downlightSourceGlow}
          />
          <OrbitControls
            enabled={!isJambDragging}
            enablePan
            enableZoom
            autoRotate={false}
            autoRotateSpeed={0.35}
            enableDamping
            dampingFactor={0.08}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.85}
            target={[0, height / 2, 0]}
          />
          <ScenePostProcessing sunFactor={sunFactor} captureMode={captureMode} />
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
