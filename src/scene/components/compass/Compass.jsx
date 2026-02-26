import { Ring } from "@react-three/drei";
import { DoubleSide } from "three";
import { deg2rad } from "@/engine";
import { CompassFloorLabel } from "./CompassFloorLabel";

export function Compass({ northLineStartRadius = 0.3 }) {
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
    <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, Math.PI, 0]}>
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

      {/* Degree markings every 30 degrees */}
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
