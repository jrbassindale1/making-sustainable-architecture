import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls, Ring, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  MathUtils,
  Object3D,
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
const WINDOW_CILL_THICKNESS = 0.02;
const WINDOW_CILL_PROJECTION = 0.08;
const WINDOW_CILL_END_OVERHANG = 0.04;
const WINDOW_CILL_FRAME_OVERLAP = 0.005; // tuck cill 5 mm under frame
const WINDOW_CILL_VERTICAL_OVERLAP = 0.005; // raise cill 5 mm into frame line to avoid clash
const WINDOW_OPEN_TRAVEL = 0.15; // 150 mm
const MAX_WINDOW_LEAF_WIDTH = 0.9; // 900 mm
const ROOFLIGHT_FRAME_THICKNESS = 0.05;
const ROOFLIGHT_PANEL_THICKNESS = 0.02;
const ROOFLIGHT_SASH_PROFILE = 0.04;
// Align rooflight glass top close to parapet coping top level.
const ROOFLIGHT_UPSTAND_HEIGHT =
  PARAPET_UPSTAND_HEIGHT + COPING_THICKNESS - ROOFLIGHT_PANEL_THICKNESS * 0.8;
const GRAVEL_STRIP_WIDTH = 1.5; // 1.5 m perimeter band around external wall line
const CLADDING_TILE_WIDTH_M = 0.96; // 8 boards per tile -> ~120 mm board module
const CLADDING_TILE_HEIGHT_M = 2.4;
const SHOW_SYNTHETIC_SUN_PATCHES = false;
const DOWNLIGHT_TRIM_RADIUS_M = 0.1;
const DOWNLIGHT_TRIM_THICKNESS_M = 0.02;
const DOWNLIGHT_BEAM_RADIUS_M = 0.095;
const DOWNLIGHT_BEAM_LENGTH_M = 0.08;
const OVERHANG_COLUMN_SIZE = 0.3; // 300 mm x 300 mm columns (match wall thickness)

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
          <mesh position={[0, -leafHeight / 2, -glassInset]} renderOrder={999}>
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
  overhangDepth = 0,
  shadingLeftExtension = 0,
  shadingRightExtension = 0,
  shadingLeftHasColumn = false,
  shadingRightHasColumn = false,
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
  const SHADING_FACE_GAP = 0.006;
  const finAndLouverMaterialProps = {
    color: "#b8c4ce",
    metalness: 0.6,
    roughness: 0.35,
  };
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
      {/* Note: Overhang support columns are now rendered in the main BuildingPreview component */}
      {/* Vertical fins (brise-soleil) */}
      {finDepth > 0.01 && (() => {
        const FIN_PROJECTION = 0.3; // Fixed 30cm projection from facade
        const FIN_THICKNESS = 0.02; // 20mm thick aluminium fins
        const hasOverhangColumns = overhangDepth > 1;
        const finCenterZ = hasOverhangColumns
          ? -wt / 2 - overhangDepth + FIN_PROJECTION / 2 - SHADING_FACE_GAP
          : -wt / 2 - FIN_PROJECTION / 2 - SHADING_FACE_GAP;

        // Base positions match window mullion rhythm
        const basePositions = [leftJambX];
        // Add mullion positions (between each leaf)
        for (let i = 1; i < leafCount; i++) {
          const mullionX = leftJambX + outerFrameProfile + i * leafPitch - mullionWidth / 2;
          basePositions.push(mullionX);
        }
        basePositions.push(rightJambX);

        // finDepth controls subdivision: 0 = just base positions, max = dense subdivisions
        const ratio = Math.min(1, finDepth / 2.6);
        // Calculate subdivisions per bay (0 at low ratio, up to 4 at max)
        const subdivisionsPerBay = Math.floor(ratio * 5);

        // Build final fin positions with subdivisions
        const fins = [];
        for (let i = 0; i < basePositions.length; i++) {
          fins.push(basePositions[i]);
          // Add subdivisions between this position and the next
          if (i < basePositions.length - 1 && subdivisionsPerBay > 0) {
            const bayWidth = basePositions[i + 1] - basePositions[i];
            const subStep = bayWidth / (subdivisionsPerBay + 1);
            for (let s = 1; s <= subdivisionsPerBay; s++) {
              fins.push(basePositions[i] + s * subStep);
            }
          }
        }

        return (
          <group>
            {fins.map((finX, i) => (
              <mesh
                key={i}
                position={[finX, windowBottomY + windowHeight / 2, finCenterZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[FIN_THICKNESS, windowHeight + 0.1, FIN_PROJECTION]} />
                <meshPhysicalMaterial {...finAndLouverMaterialProps} />
              </mesh>
            ))}
          </group>
        );
      })()}
      {/* Horizontal fins (louvers) */}
      {hFinDepth > 0.01 && (() => {
        const SLAT_PROJECTION = 0.3; // Fixed 30cm projection from facade (matches vertical fins)
        const SLAT_THICKNESS = 0.03; // 3cm thick slats
        const hasOverhangColumns = overhangDepth > 1;
        const slatCenterZ = hasOverhangColumns
          ? -wt / 2 - overhangDepth + SLAT_PROJECTION / 2 - SHADING_FACE_GAP
          : -wt / 2 - SLAT_PROJECTION / 2 - SHADING_FACE_GAP;
        const leftSpanExtension = shadingLeftHasColumn
          ? Math.max(0, shadingLeftExtension - OVERHANG_COLUMN_SIZE)
          : 0;
        const rightSpanExtension = shadingRightHasColumn
          ? Math.max(0, shadingRightExtension - OVERHANG_COLUMN_SIZE)
          : 0;
        const spanFromColumns = shadingLeftHasColumn || shadingRightHasColumn;
        const slatWidth = spanFromColumns
          ? Math.max(0.05, faceWidth + leftSpanExtension + rightSpanExtension)
          : windowWidth + 0.1;
        const slatCenterX = spanFromColumns
          ? (rightSpanExtension - leftSpanExtension) / 2
          : windowCenterX;
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
                position={[slatCenterX, slatY, slatCenterZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[slatWidth, SLAT_THICKNESS, SLAT_PROJECTION]} />
                <meshPhysicalMaterial {...finAndLouverMaterialProps} />
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

function Compass({ northLineStartRadius = 0.3 }) {
  const compassColor = "#ffffff";
  const baseOuterRadius = 5.5;
  const outerRadius = baseOuterRadius + 2;
  const ringThickness = 0.08;
  const tickLength = 0.4;
  const tickStartRadius = outerRadius;
  const labelOffset = outerRadius + 1.1;

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
      <Ring args={[outerRadius - ringThickness, outerRadius, 64]}>
        <meshBasicMaterial color={compassColor} />
      </Ring>

      {/* Cardinal direction ticks and labels */}
      {cardinals.map(({ label, angle }) => {
        const rad = deg2rad(-angle + 90);
        const x = Math.cos(rad) * tickStartRadius;
        const y = Math.sin(rad) * tickStartRadius;
        const tickEndX = Math.cos(rad) * (tickStartRadius + tickLength);
        const tickEndY = Math.sin(rad) * (tickStartRadius + tickLength);
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
        const x = Math.cos(rad) * tickStartRadius;
        const y = Math.sin(rad) * tickStartRadius;
        const tickEndX = Math.cos(rad) * (tickStartRadius + tickLength * 0.6);
        const tickEndY = Math.sin(rad) * (tickStartRadius + tickLength * 0.6);

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
        const northLineEndRadius = outerRadius + tickLength * 0.7;
        const startRadius = Math.min(
          northLineEndRadius - 0.12,
          Math.max(0.3, northLineStartRadius),
        );
        const startX = Math.cos(northAngle) * startRadius;
        const startY = Math.sin(northAngle) * startRadius;
        const endX = Math.cos(northAngle) * northLineEndRadius;
        const endY = Math.sin(northAngle) * northLineEndRadius;
        const arrowTipX = Math.cos(northAngle) * (outerRadius + tickLength * 1.5);
        const arrowTipY = Math.sin(northAngle) * (outerRadius + tickLength * 1.5);
        const arrowLeftX = Math.cos(northAngle + 0.15) * (outerRadius + tickLength * 0.6);
        const arrowLeftY = Math.sin(northAngle + 0.15) * (outerRadius + tickLength * 0.6);
        const arrowRightX = Math.cos(northAngle - 0.15) * (outerRadius + tickLength * 0.6);
        const arrowRightY = Math.sin(northAngle - 0.15) * (outerRadius + tickLength * 0.6);
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
        const x = Math.cos(rad) * tickStartRadius;
        const y = Math.sin(rad) * tickStartRadius;
        const tickEndX = Math.cos(rad) * (tickStartRadius + tickLength * 0.4);
        const tickEndY = Math.sin(rad) * (tickStartRadius + tickLength * 0.4);

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

function RoofGrass({
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

function FacadeCladdingMesh({
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

  // Roof overhang extensions from each face
  const southOverhang = faceConfigs?.south?.overhang || 0;
  const northOverhang = faceConfigs?.north?.overhang || 0;
  const eastOverhang = faceConfigs?.east?.overhang || 0;
  const westOverhang = faceConfigs?.west?.overhang || 0;

  // Extended roof slab dimensions (separate from floor slab for rooflight compatibility)
  const roofSlabWidth = slabWidth + eastOverhang + westOverhang;
  const roofSlabDepth = slabDepth + southOverhang + northOverhang;
  const roofOffsetX = (eastOverhang - westOverhang) / 2;
  const roofOffsetZ = (northOverhang - southOverhang) / 2;
  const roofGrassInset = 0.18;
  const roofGrassWidth = Math.max(0.4, roofSlabWidth - roofGrassInset * 2);
  const roofGrassDepth = Math.max(0.4, roofSlabDepth - roofGrassInset * 2);
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
  // Use extended roof dimensions for rooflight slab calculations
  const roofHalfW = roofSlabWidth / 2;
  const roofHalfD = roofSlabDepth / 2;
  const openingHalfW = rooflightInnerWidth / 2;
  const openingHalfD = rooflightInnerDepth / 2;
  // Opening position relative to extended roof center (adjusted for offset)
  const openingMinX = resolvedRooflight.centerX - roofOffsetX - openingHalfW;
  const openingMaxX = resolvedRooflight.centerX - roofOffsetX + openingHalfW;
  const openingMinZ = resolvedRooflight.centerZ - roofOffsetZ - openingHalfD;
  const openingMaxZ = resolvedRooflight.centerZ - roofOffsetZ + openingHalfD;
  const roofGrassHole = hasRooflight
    ? {
      minX: openingMinX,
      maxX: openingMaxX,
      minZ: openingMinZ,
      maxZ: openingMaxZ,
    }
    : null;
  const southSlabDepth = Math.max(0, openingMinZ + roofHalfD);
  const northSlabDepth = Math.max(0, roofHalfD - openingMaxZ);
  const westSlabWidth = Math.max(0, openingMinX + roofHalfW);
  const eastSlabWidth = Math.max(0, roofHalfW - openingMaxX);
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
  const gravelTintColor = useMemo(() => {
    const night = new Color("#3f474e");
    const day = new Color("#c5ccd2");
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
  const parapetMetalColor = "#9ea9b4";
  const parapetMetalMaterialProps = useMemo(
    () => ({
      color: parapetMetalColor,
      roughness: 0.54,
      metalness: 0.22,
      clearcoat: 0.12,
      clearcoatRoughness: 0.56,
      envMapIntensity: 0.45,
    }),
    [parapetMetalColor]
  );
  const frameMetalColor = parapetMetalColor;
  const frameMetalMaterialProps = useMemo(
    () => ({
      color: frameMetalColor,
      roughness: 0.54,
      metalness: 0.22,
      clearcoat: 0.12,
      clearcoatRoughness: 0.56,
      envMapIntensity: 0.45,
    }),
    [frameMetalColor]
  );
  const rooflightRevealMaterialProps = frameMetalMaterialProps;

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

  const copingMaterialProps = parapetMetalMaterialProps;
  const frameMaterialProps = frameMetalMaterialProps;

  const glassMaterialProps = useMemo(
    () => ({
      color: "#def3ff",
      roughnessMap: glassRoughnessMap ?? undefined,
      normalMap: glassNormalMap ?? undefined,
      normalScale: new Vector2(0.03, 0.03),
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
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

  // Separate material for rooflight glass (box geometry needs FrontSide to avoid artifacts)
  const rooflightGlassMaterialProps = useMemo(
    () => ({
      ...glassMaterialProps,
      side: FrontSide,
    }),
    [glassMaterialProps]
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
  const { gravelColorTexture, gravelBumpTexture } = useMemo(() => {
    const size = 256;
    const colorCanvas = document.createElement("canvas");
    const bumpCanvas = document.createElement("canvas");
    colorCanvas.width = size;
    colorCanvas.height = size;
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const colorCtx = colorCanvas.getContext("2d");
    const bumpCtx = bumpCanvas.getContext("2d");
    if (!colorCtx || !bumpCtx) return { gravelColorTexture: null, gravelBumpTexture: null };

    colorCtx.fillStyle = "#bcc3c9";
    colorCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = "rgb(120,120,120)";
    bumpCtx.fillRect(0, 0, size, size);

    const stoneTones = ["#e3e7ea", "#d6dce1", "#c8d0d7", "#b8c2cb", "#a8b3be", "#96a2ae", "#838f9c"];
    for (let i = 0; i < 3000; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 3 + 1.2;

      colorCtx.fillStyle = stoneTones[Math.floor(Math.random() * stoneTones.length)];
      colorCtx.beginPath();
      colorCtx.arc(x, y, r, 0, Math.PI * 2);
      colorCtx.fill();

      const heightValue = Math.floor(88 + Math.random() * 120);
      bumpCtx.fillStyle = `rgb(${heightValue},${heightValue},${heightValue})`;
      bumpCtx.beginPath();
      bumpCtx.arc(x, y, r, 0, Math.PI * 2);
      bumpCtx.fill();
    }

    const colorTexture = new CanvasTexture(colorCanvas);
    colorTexture.wrapS = RepeatWrapping;
    colorTexture.wrapT = RepeatWrapping;
    colorTexture.repeat.set(6, 6);
    colorTexture.anisotropy = 8;
    colorTexture.colorSpace = SRGBColorSpace;
    colorTexture.needsUpdate = true;

    const bumpTexture = new CanvasTexture(bumpCanvas);
    bumpTexture.wrapS = RepeatWrapping;
    bumpTexture.wrapT = RepeatWrapping;
    bumpTexture.repeat.set(6, 6);
    bumpTexture.anisotropy = 8;
    bumpTexture.needsUpdate = true;

    return { gravelColorTexture: colorTexture, gravelBumpTexture: bumpTexture };
  }, []);
  const { facadeCladdingColorTexture, facadeCladdingBumpTexture } = useMemo(() => {
    const size = 768;
    const colorCanvas = document.createElement("canvas");
    const bumpCanvas = document.createElement("canvas");
    colorCanvas.width = size;
    colorCanvas.height = size;
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const colorCtx = colorCanvas.getContext("2d");
    const bumpCtx = bumpCanvas.getContext("2d");
    if (!colorCtx || !bumpCtx) {
      return { facadeCladdingColorTexture: null, facadeCladdingBumpTexture: null };
    }

    const baseColor = "#ead7bf";
    colorCtx.fillStyle = baseColor;
    colorCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = "rgb(162,162,162)";
    bumpCtx.fillRect(0, 0, size, size);

    const boardCount = 8;
    const boardWidth = size / boardCount;
    const boardPalette = ["#ecdcc8", "#e7d4bb", "#e3ceb3", "#f0e1cf", "#dec6a6"];
    const grainPalette = ["rgba(148,110,76,0.2)", "rgba(124,88,56,0.16)", "rgba(170,130,94,0.12)"];

    for (let board = 0; board < boardCount; board += 1) {
      const x0 = Math.round(board * boardWidth);
      const x1 = Math.round((board + 1) * boardWidth);
      colorCtx.fillStyle = boardPalette[Math.floor(Math.random() * boardPalette.length)];
      colorCtx.fillRect(x0, 0, x1 - x0, size);

      // Vertical wood grain streaks.
      const streaks = 42;
      for (let i = 0; i < streaks; i += 1) {
        const x = x0 + Math.random() * Math.max(1, x1 - x0 - 2);
        const y = Math.random() * size;
        const h = Math.random() * (size * 0.22) + size * 0.05;
        const w = Math.random() * 2.2 + 0.4;
        colorCtx.fillStyle = grainPalette[Math.floor(Math.random() * grainPalette.length)];
        colorCtx.fillRect(x, y, w, h);
      }

      // Knots.
      const knots = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < knots; i += 1) {
        const cx = x0 + boardWidth * (0.22 + Math.random() * 0.56);
        const cy = size * (0.1 + Math.random() * 0.8);
        const rx = Math.random() * 6 + 5;
        const ry = rx * (0.55 + Math.random() * 0.35);
        colorCtx.save();
        colorCtx.translate(cx, cy);
        colorCtx.rotate((Math.random() - 0.5) * 0.7);
        colorCtx.fillStyle = "rgba(128,92,62,0.3)";
        colorCtx.beginPath();
        colorCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        colorCtx.fill();
        colorCtx.restore();
      }
    }

    // Dark board joints to read as vertical rainscreen planks.
    for (let i = 1; i < boardCount; i += 1) {
      const seamX = Math.round(i * boardWidth);
      colorCtx.fillStyle = "rgba(76,54,36,0.38)";
      colorCtx.fillRect(seamX - 1, 0, 2, size);
      colorCtx.fillStyle = "rgba(255,255,255,0.08)";
      colorCtx.fillRect(seamX + 1, 0, 1, size);

      bumpCtx.fillStyle = "rgb(104,104,104)";
      bumpCtx.fillRect(seamX - 1, 0, 2, size);
      bumpCtx.fillStyle = "rgb(176,176,176)";
      bumpCtx.fillRect(seamX + 1, 0, 1, size);
    }

    const colorTexture = new CanvasTexture(colorCanvas);
    colorTexture.wrapS = RepeatWrapping;
    colorTexture.wrapT = RepeatWrapping;
    colorTexture.repeat.set(2.4, 1.5);
    colorTexture.anisotropy = 8;
    colorTexture.colorSpace = SRGBColorSpace;
    colorTexture.needsUpdate = true;

    const bumpTexture = new CanvasTexture(bumpCanvas);
    bumpTexture.wrapS = RepeatWrapping;
    bumpTexture.wrapT = RepeatWrapping;
    bumpTexture.repeat.set(2.4, 1.5);
    bumpTexture.anisotropy = 8;
    bumpTexture.needsUpdate = true;

    return {
      facadeCladdingColorTexture: colorTexture,
      facadeCladdingBumpTexture: bumpTexture,
    };
  }, []);
  const facadeCladdingMaterialProps = useMemo(
    () => ({
      color: "#ead8c1",
      map: facadeCladdingColorTexture ?? undefined,
      bumpMap: facadeCladdingBumpTexture ?? undefined,
      bumpScale: 0.022,
      roughness: 0.82,
      metalness: 0.02,
      clearcoat: 0.03,
      clearcoatRoughness: 0.86,
    }),
    [facadeCladdingColorTexture, facadeCladdingBumpTexture]
  );

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

  // External soffit downlights - activated when overhang is deep enough to have columns (> 1m)
  const externalSoffitDownlightLayout = useMemo(() => {
    const y = Math.max(0.2, height - DOWNLIGHT_TRIM_THICKNESS_M / 2);
    const targetY = -BUILDING_LIFT; // Aim at ground level
    const lights = [];

    // South face soffit lights
    if (southOverhang > 1.0) {
      const minX = -(halfW + WALL_THICKNESS + westOverhang);
      const maxX = halfW + WALL_THICKNESS + eastOverhang;
      const spanX = maxX - minX;
      if (spanX > 0.001) {
        const soffitCenterZ = -(halfD + WALL_THICKNESS + southOverhang / 2);
        lights.push(
          { key: "south-1", position: [minX + spanX / 3, y, soffitCenterZ], targetY },
          { key: "south-2", position: [minX + (spanX * 2) / 3, y, soffitCenterZ], targetY },
        );
      }
    }

    // North face soffit lights
    if (northOverhang > 1.0) {
      const minX = -(halfW + WALL_THICKNESS + westOverhang);
      const maxX = halfW + WALL_THICKNESS + eastOverhang;
      const spanX = maxX - minX;
      if (spanX > 0.001) {
        const soffitCenterZ = halfD + WALL_THICKNESS + northOverhang / 2;
        lights.push(
          { key: "north-1", position: [minX + spanX / 3, y, soffitCenterZ], targetY },
          { key: "north-2", position: [minX + (spanX * 2) / 3, y, soffitCenterZ], targetY },
        );
      }
    }

    // East face soffit lights
    if (eastOverhang > 1.0) {
      const minZ = -(halfD + WALL_THICKNESS + southOverhang);
      const maxZ = halfD + WALL_THICKNESS + northOverhang;
      const spanZ = maxZ - minZ;
      if (spanZ > 0.001) {
        const soffitCenterX = halfW + WALL_THICKNESS + eastOverhang / 2;
        lights.push(
          { key: "east-1", position: [soffitCenterX, y, minZ + spanZ / 3], targetY },
          { key: "east-2", position: [soffitCenterX, y, minZ + (spanZ * 2) / 3], targetY },
        );
      }
    }

    // West face soffit lights
    if (westOverhang > 1.0) {
      const minZ = -(halfD + WALL_THICKNESS + southOverhang);
      const maxZ = halfD + WALL_THICKNESS + northOverhang;
      const spanZ = maxZ - minZ;
      if (spanZ > 0.001) {
        const soffitCenterX = -(halfW + WALL_THICKNESS + westOverhang / 2);
        lights.push(
          { key: "west-1", position: [soffitCenterX, y, minZ + spanZ / 3], targetY },
          { key: "west-2", position: [soffitCenterX, y, minZ + (spanZ * 2) / 3], targetY },
        );
      }
    }

    return lights;
  }, [
    height,
    halfW,
    halfD,
    southOverhang,
    northOverhang,
    eastOverhang,
    westOverhang,
  ]);

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

      {/* Gravel perimeter strip (fixed 1.5m wide, tracks building size changes) */}
      {(() => {
        const gravelThickness = 0.01;
        const gravelY = -0.005;
        // Extend inward to include the recessed base zone, and outward by 1.5m.
        const inwardBackset = PLINTH_RECESS;
        const innerWidth = Math.max(0.2, externalWidth - inwardBackset * 2);
        const innerDepth = Math.max(0.2, externalDepth - inwardBackset * 2);
        const outerWidth = externalWidth + GRAVEL_STRIP_WIDTH * 2;
        const outerDepth = externalDepth + GRAVEL_STRIP_WIDTH * 2;
        const stripDepth = (outerDepth - innerDepth) / 2;
        const stripWidth = (outerWidth - innerWidth) / 2;
        const halfInnerW = innerWidth / 2;
        const halfInnerD = innerDepth / 2;

        return (
          <>
            <mesh position={[0, gravelY, -(halfInnerD + stripDepth / 2)]} receiveShadow>
              <boxGeometry args={[outerWidth, gravelThickness, stripDepth]} />
              <meshStandardMaterial
                map={gravelColorTexture ?? undefined}
                bumpMap={gravelBumpTexture ?? undefined}
                bumpScale={0.05}
                color={gravelTintColor}
                roughness={0.99}
                metalness={0}
              />
            </mesh>
            <mesh position={[0, gravelY, halfInnerD + stripDepth / 2]} receiveShadow>
              <boxGeometry args={[outerWidth, gravelThickness, stripDepth]} />
              <meshStandardMaterial
                map={gravelColorTexture ?? undefined}
                bumpMap={gravelBumpTexture ?? undefined}
                bumpScale={0.05}
                color={gravelTintColor}
                roughness={0.99}
                metalness={0}
              />
            </mesh>
            <mesh position={[halfInnerW + stripWidth / 2, gravelY, 0]} receiveShadow>
              <boxGeometry args={[stripWidth, gravelThickness, innerDepth]} />
              <meshStandardMaterial
                map={gravelColorTexture ?? undefined}
                bumpMap={gravelBumpTexture ?? undefined}
                bumpScale={0.05}
                color={gravelTintColor}
                roughness={0.99}
                metalness={0}
              />
            </mesh>
            <mesh position={[-(halfInnerW + stripWidth / 2), gravelY, 0]} receiveShadow>
              <boxGeometry args={[stripWidth, gravelThickness, innerDepth]} />
              <meshStandardMaterial
                map={gravelColorTexture ?? undefined}
                bumpMap={gravelBumpTexture ?? undefined}
                bumpScale={0.05}
                color={gravelTintColor}
                roughness={0.99}
                metalness={0}
              />
            </mesh>
          </>
        );
      })()}

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
            {/* Ceiling slab with rooflight opening - uses extended roof dimensions */}
            {southSlabDepth > 0.001 && (
              <mesh
                position={[roofOffsetX, height + FLOOR_THICKNESS / 2, -roofHalfD + southSlabDepth / 2 + roofOffsetZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[roofSlabWidth, FLOOR_THICKNESS, southSlabDepth]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}
            {northSlabDepth > 0.001 && (
              <mesh
                position={[roofOffsetX, height + FLOOR_THICKNESS / 2, openingMaxZ + northSlabDepth / 2 + roofOffsetZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[roofSlabWidth, FLOOR_THICKNESS, northSlabDepth]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}
            {westSlabWidth > 0.001 && (
              <mesh
                position={[-roofHalfW + westSlabWidth / 2 + roofOffsetX, height + FLOOR_THICKNESS / 2, (openingMinZ + openingMaxZ) / 2 + roofOffsetZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[westSlabWidth, FLOOR_THICKNESS, openingMaxZ - openingMinZ]} />
                <meshPhysicalMaterial {...ceilingMaterialProps} />
              </mesh>
            )}
            {eastSlabWidth > 0.001 && (
              <mesh
                position={[openingMaxX + eastSlabWidth / 2 + roofOffsetX, height + FLOOR_THICKNESS / 2, (openingMinZ + openingMaxZ) / 2 + roofOffsetZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[eastSlabWidth, FLOOR_THICKNESS, openingMaxZ - openingMinZ]} />
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
                  <mesh castShadow={false} receiveShadow renderOrder={999}>
                    <boxGeometry args={[rooflightPanelGlassWidth, ROOFLIGHT_PANEL_THICKNESS * 0.6, rooflightPanelGlassDepth]} />
                    <meshPhysicalMaterial {...rooflightGlassMaterialProps} />
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
          <mesh position={[roofOffsetX, height + FLOOR_THICKNESS / 2, roofOffsetZ]} castShadow receiveShadow>
            <boxGeometry args={[roofSlabWidth, FLOOR_THICKNESS, roofSlabDepth]} />
            <meshPhysicalMaterial {...ceilingMaterialProps} />
          </mesh>
        )}

        <RoofGrass
          patchWidth={roofGrassWidth}
          patchDepth={roofGrassDepth}
          rooflightHole={roofGrassHole}
          position={[roofOffsetX, height + FLOOR_THICKNESS + 0.003, roofOffsetZ]}
        />

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

        {/* External soffit downlights (when overhang has columns) */}
        {externalSoffitDownlightLayout.map(({ key, position, targetY }) => (
          <CeilingDownlight
            key={`soffit-downlight-${key}`}
            position={position}
            downlightsOn={downlightsOn}
            intensity={resolvedDownlightIntensity}
            throwScale={resolvedDownlightThrowScale}
            angle={resolvedDownlightAngle}
            penumbra={resolvedDownlightPenumbra}
            sourceGlow={resolvedDownlightSourceGlow}
            roomHeight={height + BUILDING_LIFT}
            targetY={targetY}
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
            shadingLeftExtension={WALL_THICKNESS + westOverhang}
            shadingRightExtension={WALL_THICKNESS + eastOverhang}
            shadingLeftHasColumn={southOverhang > 1 || westOverhang > 1}
            shadingRightHasColumn={southOverhang > 1 || eastOverhang > 1}
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
            shadingLeftExtension={WALL_THICKNESS + eastOverhang}
            shadingRightExtension={WALL_THICKNESS + westOverhang}
            shadingLeftHasColumn={northOverhang > 1 || eastOverhang > 1}
            shadingRightHasColumn={northOverhang > 1 || westOverhang > 1}
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
            shadingLeftExtension={WALL_THICKNESS + southOverhang}
            shadingRightExtension={WALL_THICKNESS + northOverhang}
            shadingLeftHasColumn={eastOverhang > 1 || southOverhang > 1}
            shadingRightHasColumn={eastOverhang > 1 || northOverhang > 1}
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
            shadingLeftExtension={WALL_THICKNESS + northOverhang}
            shadingRightExtension={WALL_THICKNESS + southOverhang}
            shadingLeftHasColumn={westOverhang > 1 || northOverhang > 1}
            shadingRightHasColumn={westOverhang > 1 || southOverhang > 1}
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
          const makeCladdingPanels = (
            internalSpan,
            glazingPct,
            windowCenterRatio = 0,
            windowCillLift = 0,
            windowHeadDrop = 0,
          ) => {
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
            const bottomBandCenterY = -FLOOR_THICKNESS / 2;
            const maxCillLift = Math.max(0, height - MIN_WINDOW_CLEAR_HEIGHT);
            const safeCillLift = Math.max(0, Math.min(windowCillLift ?? 0, maxCillLift));
            const maxHeadDrop = Math.max(0, height - safeCillLift - MIN_WINDOW_CLEAR_HEIGHT);
            const safeHeadDrop = Math.max(0, Math.min(windowHeadDrop ?? 0, maxHeadDrop));
            const windowBottomY = safeCillLift;
            const windowTopY = Math.max(windowBottomY + 0.05, height - safeHeadDrop);
            // Wall panels (stay at building wall)
            const panels = [
              { center: 0, centerY: bottomBandCenterY, span: fullSpan, panelHeight: bottomBandHeight },
            ];

            if (clampedGlazing <= 0.001) {
              panels.push({
                center: 0,
                centerY: height / 2,
                span: fullSpan,
                panelHeight: height,
              });
              return panels;
            }

            const leftSpan = Math.max(0, windowLeft + internalSpan / 2) + WALL_THICKNESS;
            const rightSpan = Math.max(0, internalSpan / 2 - windowRight) + WALL_THICKNESS;
            const hasVerticalFill = windowBottomY > 0.001 || windowTopY < height - 0.001;

            if (leftSpan <= 0.001 && rightSpan <= 0.001 && !hasVerticalFill) return panels;

            if (leftSpan > 0.001) {
              panels.push({
                center: -fullSpan / 2 + leftSpan / 2,
                centerY: height / 2,
                span: leftSpan,
                panelHeight: height,
              });
            }
            if (rightSpan > 0.001) {
              panels.push({
                center: fullSpan / 2 - rightSpan / 2,
                centerY: height / 2,
                span: rightSpan,
                panelHeight: height,
              });
            }

            if (windowBottomY > 0.001) {
              panels.push({
                center: windowCenter,
                centerY: windowBottomY / 2,
                span: windowWidth,
                panelHeight: windowBottomY,
              });
            }
            if (windowTopY < height - 0.001) {
              const topHeight = height - windowTopY;
              panels.push({
                center: windowCenter,
                centerY: windowTopY + topHeight / 2,
                span: windowWidth,
                panelHeight: topHeight,
              });
            }
            return panels;
          };
          const trimPanelsAtFaceEnds = (panels, fullSpan, trimInset) => {
            if (trimInset <= 0) return panels;
            const halfSpan = fullSpan / 2;
            const edgeEpsilon = 0.0005;
            return panels
              .map((panel) => {
                let start = panel.center - panel.span / 2;
                let end = panel.center + panel.span / 2;
                if (start <= -halfSpan + edgeEpsilon) start += trimInset;
                if (end >= halfSpan - edgeEpsilon) end -= trimInset;
                const nextSpan = end - start;
                if (nextSpan <= 0.001) return null;
                return {
                  ...panel,
                  center: (start + end) / 2,
                  span: nextSpan,
                };
              })
              .filter(Boolean);
          };

          const claddingThickness = PARAPET_CLADDING_THICKNESS;
          const claddingOutset = 0.004; // 4 mm stand-off to prevent z-fighting with backing wall
          const cornerJoinInset = Math.max(0, claddingThickness - claddingOutset);
          const southNorthCladdingZ =
            halfD + WALL_THICKNESS + claddingOutset - claddingThickness / 2;
          const eastWestCladdingX =
            halfW + WALL_THICKNESS + claddingOutset - claddingThickness / 2;
          const southNorthCladdingLength = width + WALL_THICKNESS * 2;
          const eastWestCladdingLength = depth + WALL_THICKNESS * 2;
          const southPanels = makeCladdingPanels(
            width,
            faceConfigs.south.glazing,
            faceConfigs.south.windowCenterRatio,
            faceConfigs.south.cillLift,
            faceConfigs.south.headDrop,
          );
          const northPanels = makeCladdingPanels(
            width,
            faceConfigs.north.glazing,
            faceConfigs.north.windowCenterRatio,
            faceConfigs.north.cillLift,
            faceConfigs.north.headDrop,
          );
          const eastPanels = trimPanelsAtFaceEnds(
            makeCladdingPanels(
              depth,
              faceConfigs.east.glazing,
              faceConfigs.east.windowCenterRatio,
              faceConfigs.east.cillLift,
              faceConfigs.east.headDrop,
            ),
            eastWestCladdingLength,
            cornerJoinInset,
          );
          const westPanels = trimPanelsAtFaceEnds(
            makeCladdingPanels(
              depth,
              faceConfigs.west.glazing,
              faceConfigs.west.windowCenterRatio,
              faceConfigs.west.cillLift,
              faceConfigs.west.headDrop,
            ),
            eastWestCladdingLength,
            cornerJoinInset,
          );
          const copingWidthAcrossWall = WALL_THICKNESS + COPING_OVERHANG * 2;
          const copingCenterY =
            height + FLOOR_THICKNESS + PARAPET_UPSTAND_HEIGHT + COPING_THICKNESS / 2;
          // Extended coping to match roof overhangs
          const southNorthCopingLength = southNorthCladdingLength + eastOverhang + westOverhang + COPING_OVERHANG * 2;
          const eastWestCopingLength = eastWestCladdingLength + southOverhang + northOverhang + COPING_OVERHANG * 2;
          const southCopingZ = halfD + WALL_THICKNESS / 2 + southOverhang;
          const northCopingZ = halfD + WALL_THICKNESS / 2 + northOverhang;
          const eastCopingX = halfW + WALL_THICKNESS / 2 + eastOverhang;
          const westCopingX = halfW + WALL_THICKNESS / 2 + westOverhang;

          return (
            <group>
              {/* South / North cladding */}
              {southPanels.map((panel, i) => (
                <FacadeCladdingMesh
                  key={`south-clad-${i}`}
                  position={[panel.center, panel.centerY, -southNorthCladdingZ]}
                  size={[panel.span, panel.panelHeight, claddingThickness]}
                  uAxis="x"
                  baseColorTexture={facadeCladdingColorTexture}
                  baseBumpTexture={facadeCladdingBumpTexture}
                  materialProps={facadeCladdingMaterialProps}
                />
              ))}
              {northPanels.map((panel, i) => (
                <FacadeCladdingMesh
                  key={`north-clad-${i}`}
                  position={[-panel.center, panel.centerY, southNorthCladdingZ]}
                  size={[panel.span, panel.panelHeight, claddingThickness]}
                  uAxis="x"
                  baseColorTexture={facadeCladdingColorTexture}
                  baseBumpTexture={facadeCladdingBumpTexture}
                  materialProps={facadeCladdingMaterialProps}
                />
              ))}

              {/* East / West cladding */}
              {eastPanels.map((panel, i) => (
                <FacadeCladdingMesh
                  key={`east-clad-${i}`}
                  position={[eastWestCladdingX, panel.centerY, panel.center]}
                  size={[claddingThickness, panel.panelHeight, panel.span]}
                  uAxis="z"
                  baseColorTexture={facadeCladdingColorTexture}
                  baseBumpTexture={facadeCladdingBumpTexture}
                  materialProps={facadeCladdingMaterialProps}
                />
              ))}
              {westPanels.map((panel, i) => (
                <FacadeCladdingMesh
                  key={`west-clad-${i}`}
                  position={[-eastWestCladdingX, panel.centerY, -panel.center]}
                  size={[claddingThickness, panel.panelHeight, panel.span]}
                  uAxis="z"
                  baseColorTexture={facadeCladdingColorTexture}
                  baseBumpTexture={facadeCladdingBumpTexture}
                  materialProps={facadeCladdingMaterialProps}
                />
              ))}

              {/* Inner parapet lining: roof slab top to coping underside on inner parapet face */}
              {(() => {
                const liningHeight = PARAPET_UPSTAND_HEIGHT;
                const liningCenterY = height + FLOOR_THICKNESS + liningHeight / 2;
                const southNorthLiningSpan = width + eastOverhang + westOverhang;
                const eastWestLiningSpan = depth + southOverhang + northOverhang;
                const southInnerLiningZ = -(halfD + southOverhang + claddingThickness / 2);
                const northInnerLiningZ = halfD + northOverhang + claddingThickness / 2;
                const eastInnerLiningX = halfW + eastOverhang + claddingThickness / 2;
                const westInnerLiningX = -(halfW + westOverhang + claddingThickness / 2);

                return (
                  <>
                    <mesh key="south-inner-lining" position={[roofOffsetX, liningCenterY, southInnerLiningZ]} castShadow receiveShadow>
                      <boxGeometry args={[southNorthLiningSpan, liningHeight, claddingThickness]} />
                      <meshPhysicalMaterial {...copingMaterialProps} />
                    </mesh>
                    <mesh key="north-inner-lining" position={[roofOffsetX, liningCenterY, northInnerLiningZ]} castShadow receiveShadow>
                      <boxGeometry args={[southNorthLiningSpan, liningHeight, claddingThickness]} />
                      <meshPhysicalMaterial {...copingMaterialProps} />
                    </mesh>
                    <mesh key="east-inner-lining" position={[eastInnerLiningX, liningCenterY, roofOffsetZ]} castShadow receiveShadow>
                      <boxGeometry args={[claddingThickness, liningHeight, eastWestLiningSpan]} />
                      <meshPhysicalMaterial {...copingMaterialProps} />
                    </mesh>
                    <mesh key="west-inner-lining" position={[westInnerLiningX, liningCenterY, roofOffsetZ]} castShadow receiveShadow>
                      <boxGeometry args={[claddingThickness, liningHeight, eastWestLiningSpan]} />
                      <meshPhysicalMaterial {...copingMaterialProps} />
                    </mesh>
                  </>
                );
              })()}

              {/* Aluminium coping to cap the upstand - extended for overhangs */}
              <mesh position={[roofOffsetX, copingCenterY, -southCopingZ]} castShadow receiveShadow>
                <boxGeometry args={[southNorthCopingLength, COPING_THICKNESS, copingWidthAcrossWall]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
              <mesh position={[roofOffsetX, copingCenterY, northCopingZ]} castShadow receiveShadow>
                <boxGeometry args={[southNorthCopingLength, COPING_THICKNESS, copingWidthAcrossWall]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
              <mesh position={[eastCopingX, copingCenterY, roofOffsetZ]} castShadow receiveShadow>
                <boxGeometry args={[copingWidthAcrossWall, COPING_THICKNESS, eastWestCopingLength]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>
              <mesh position={[-westCopingX, copingCenterY, roofOffsetZ]} castShadow receiveShadow>
                <boxGeometry args={[copingWidthAcrossWall, COPING_THICKNESS, eastWestCopingLength]} />
                <meshPhysicalMaterial {...copingMaterialProps} />
              </mesh>

              {/* Support columns for overhangs > 1m */}
              {(() => {
                const columnSize = OVERHANG_COLUMN_SIZE;
                const columnBottom = -BUILDING_LIFT; // Ground level
                const columnTop = height; // Underside of roof slab
                const columnHeight = columnTop - columnBottom;
                const columnCenterY = columnBottom + columnHeight / 2;
                const columns = [];

                // South-East corner column (when south or east overhang > 1m)
                if (southOverhang > 1.0 || eastOverhang > 1.0) {
                  const colX = halfW + WALL_THICKNESS + eastOverhang - columnSize / 2;
                  const colZ = -(halfD + WALL_THICKNESS + southOverhang - columnSize / 2);
                  columns.push(
                    <FacadeCladdingMesh
                      key="col-se"
                      position={[colX, columnCenterY, colZ]}
                      size={[columnSize, columnHeight, columnSize]}
                      uAxis="x"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                  );
                }

                // South-West corner column
                if (southOverhang > 1.0 || westOverhang > 1.0) {
                  const colX = -(halfW + WALL_THICKNESS + westOverhang - columnSize / 2);
                  const colZ = -(halfD + WALL_THICKNESS + southOverhang - columnSize / 2);
                  columns.push(
                    <FacadeCladdingMesh
                      key="col-sw"
                      position={[colX, columnCenterY, colZ]}
                      size={[columnSize, columnHeight, columnSize]}
                      uAxis="x"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                  );
                }

                // North-East corner column
                if (northOverhang > 1.0 || eastOverhang > 1.0) {
                  const colX = halfW + WALL_THICKNESS + eastOverhang - columnSize / 2;
                  const colZ = halfD + WALL_THICKNESS + northOverhang - columnSize / 2;
                  columns.push(
                    <FacadeCladdingMesh
                      key="col-ne"
                      position={[colX, columnCenterY, colZ]}
                      size={[columnSize, columnHeight, columnSize]}
                      uAxis="x"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                  );
                }

                // North-West corner column
                if (northOverhang > 1.0 || westOverhang > 1.0) {
                  const colX = -(halfW + WALL_THICKNESS + westOverhang - columnSize / 2);
                  const colZ = halfD + WALL_THICKNESS + northOverhang - columnSize / 2;
                  columns.push(
                    <FacadeCladdingMesh
                      key="col-nw"
                      position={[colX, columnCenterY, colZ]}
                      size={[columnSize, columnHeight, columnSize]}
                      uAxis="x"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                  );
                }

                return columns;
              })()}

              {/* Fascia cladding: continuous pink band at outer overhang edge */}
              {(() => {
                const fasciaHeight = FLOOR_THICKNESS + PARAPET_UPSTAND_HEIGHT;
                const fasciaCenterY = height + fasciaHeight / 2;
                // Keep fascia aligned to cladding/overhang extents (not coping overhang),
                // so corner joints meet cleanly without protruding strips.
                const southNorthFasciaLength = southNorthCladdingLength + eastOverhang + westOverhang;
                const eastWestFasciaLength = Math.max(
                  0.05,
                  eastWestCladdingLength + southOverhang + northOverhang - cornerJoinInset * 2,
                );
                return (
                  <>
                    <FacadeCladdingMesh
                      key="south-fascia-front"
                      position={[roofOffsetX, fasciaCenterY, -(halfD + WALL_THICKNESS + southOverhang + claddingOutset - claddingThickness / 2)]}
                      size={[southNorthFasciaLength, fasciaHeight, claddingThickness]}
                      uAxis="x"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                    <FacadeCladdingMesh
                      key="north-fascia-front"
                      position={[roofOffsetX, fasciaCenterY, halfD + WALL_THICKNESS + northOverhang + claddingOutset - claddingThickness / 2]}
                      size={[southNorthFasciaLength, fasciaHeight, claddingThickness]}
                      uAxis="x"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                    <FacadeCladdingMesh
                      key="east-fascia-front"
                      position={[halfW + WALL_THICKNESS + eastOverhang + claddingOutset - claddingThickness / 2, fasciaCenterY, roofOffsetZ]}
                      size={[claddingThickness, fasciaHeight, eastWestFasciaLength]}
                      uAxis="z"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                    <FacadeCladdingMesh
                      key="west-fascia-front"
                      position={[-(halfW + WALL_THICKNESS + westOverhang + claddingOutset - claddingThickness / 2), fasciaCenterY, roofOffsetZ]}
                      size={[claddingThickness, fasciaHeight, eastWestFasciaLength]}
                      uAxis="z"
                      baseColorTexture={facadeCladdingColorTexture}
                      baseBumpTexture={facadeCladdingBumpTexture}
                      materialProps={facadeCladdingMaterialProps}
                    />
                  </>
                );
              })()}
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
  targetY = 0,
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
      light.target.position.set(position[0], targetY, position[2]);
      light.target.updateMatrixWorld();
    });
    return () => {
      lights.forEach((light) => {
        light.parent?.remove?.(light.target);
      });
    };
  }, [position, targetY]);

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

function SunOrb({ position, opacity }) {
  return (
    <group position={position} visible={opacity > 0.02}>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial
          color="#fff4d6"
          transparent
          opacity={opacity * 0.15}
          blending={AdditiveBlending}
          depthWrite={false}
          side={BackSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Mid glow */}
      <mesh>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial
          color="#ffe8a8"
          transparent
          opacity={opacity * 0.25}
          blending={AdditiveBlending}
          depthWrite={false}
          side={BackSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial
          color="#fff2be"
          transparent
          opacity={opacity * 0.4}
          blending={AdditiveBlending}
          depthWrite={false}
          side={BackSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshBasicMaterial
          color="#fffef5"
          transparent
          opacity={opacity}
          depthWrite={false}
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
  const compassNorthLineStartRadius = useMemo(() => {
    const gravelHalfW = (buildingWidth + WALL_THICKNESS * 2) / 2 + GRAVEL_STRIP_WIDTH;
    const gravelHalfD = (buildingDepth + WALL_THICKNESS * 2) / 2 + GRAVEL_STRIP_WIDTH;
    const theta = deg2rad(orientationDeg);
    const northProjection =
      Math.abs(Math.sin(theta)) * gravelHalfW +
      Math.abs(Math.cos(theta)) * gravelHalfD;
    return northProjection + 0.04;
  }, [buildingWidth, buildingDepth, orientationDeg]);
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
          <SunOrb position={sunSpherePosition} opacity={sunSphereOpacity} />
          {!captureMode && <Environment preset="sunset" intensity={0.9 * sunFactor} />}
          {!captureMode && <Environment preset="night" intensity={0.55 * (1 - sunFactor)} />}
          <Compass northLineStartRadius={compassNorthLineStartRadius} />
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
