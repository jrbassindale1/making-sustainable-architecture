import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { MathUtils } from "three";
import { WINDOW_SEGMENT_STATE, normalizeWindowSegmentState } from "@/engine";
import { WINDOW_OPEN_TRAVEL } from "../../constants/architecture";

export function OperableWindowLeaf({
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
