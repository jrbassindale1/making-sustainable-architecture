import { useEffect, useRef } from "react";
import { AdditiveBlending } from "three";
import {
  DOWNLIGHT_TRIM_RADIUS_M,
  DOWNLIGHT_TRIM_THICKNESS_M,
  DOWNLIGHT_BEAM_RADIUS_M,
  DOWNLIGHT_BEAM_LENGTH_M,
} from "../../constants/architecture";

export function CeilingDownlight({
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
