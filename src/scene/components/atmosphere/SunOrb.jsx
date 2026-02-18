import { AdditiveBlending, BackSide } from "three";

export function SunOrb({ position, opacity }) {
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
