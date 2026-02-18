import { useCallback, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  WINDOW_SEGMENT_STATE,
  normalizeWindowSegmentState,
  clampWindowCenterRatio,
  MIN_WINDOW_CLEAR_HEIGHT,
} from "@/engine";
import {
  WALL_THICKNESS,
  MAX_WINDOW_LEAF_WIDTH,
  WINDOW_CILL_THICKNESS,
  WINDOW_CILL_PROJECTION,
  WINDOW_CILL_END_OVERHANG,
  WINDOW_CILL_FRAME_OVERLAP,
  WINDOW_CILL_VERTICAL_OVERLAP,
  OVERHANG_COLUMN_SIZE,
  BUILDING_LIFT,
} from "../../constants/architecture";
import { OperableWindowLeaf } from "../windows/OperableWindowLeaf";

export function WallFace({
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

        // Calculate column span extensions (same as horizontal louvres)
        const leftSpanExtension = shadingLeftHasColumn
          ? Math.max(0, shadingLeftExtension - OVERHANG_COLUMN_SIZE)
          : 0;
        const rightSpanExtension = shadingRightHasColumn
          ? Math.max(0, shadingRightExtension - OVERHANG_COLUMN_SIZE)
          : 0;
        const spanFromColumns = hasOverhangColumns && (shadingLeftHasColumn || shadingRightHasColumn);

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
        let fins = [];
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

        // When spanning between columns, expand fins to fill the column width
        // using a consistent spacing based on finDepth (same approach as horizontal louvres)
        if (spanFromColumns) {
          // Calculate the expanded span boundaries with 30cm clearance from columns
          const COLUMN_CLEARANCE = 0.3;
          const expandedLeft = -faceWidth / 2 - leftSpanExtension + COLUMN_CLEARANCE;
          const expandedRight = faceWidth / 2 + rightSpanExtension - COLUMN_CLEARANCE;
          const totalWidth = expandedRight - expandedLeft;

          // Map finDepth ratio to spacing (same as horizontal louvres)
          // Higher ratio = smaller gap = more fins
          const MIN_GAP = 0.1; // 10cm spacing (dense)
          const MAX_GAP = 0.6; // 60cm spacing (sparse)
          const finSpacing = MAX_GAP - ratio * (MAX_GAP - MIN_GAP);

          // Calculate number of fins and center them
          const numFins = Math.floor(totalWidth / finSpacing) + 1;
          const actualSpan = (numFins - 1) * finSpacing;
          const startOffset = (totalWidth - actualSpan) / 2;

          // Rebuild fins array centered between columns
          const expandedFins = [];
          for (let i = 0; i < numFins; i++) {
            expandedFins.push(expandedLeft + startOffset + i * finSpacing);
          }
          fins = expandedFins;
        }

        // When spanning between columns, fins extend from outside ground level to soffit
        // Outside ground is at -BUILDING_LIFT (building is lifted above ground)
        // Otherwise, fins are centered on the window
        const finHeight = spanFromColumns
          ? faceHeight + BUILDING_LIFT
          : windowHeight + 0.1;
        const finCenterY = spanFromColumns
          ? (faceHeight - BUILDING_LIFT) / 2
          : windowBottomY + windowHeight / 2;

        return (
          <group>
            {fins.map((finX, i) => (
              <mesh
                key={i}
                position={[finX, finCenterY, finCenterZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[FIN_THICKNESS, finHeight, FIN_PROJECTION]} />
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

        // Only span from columns if this face actually has an overhang with columns
        const leftSpanExtension = (hasOverhangColumns && shadingLeftHasColumn)
          ? Math.max(0, shadingLeftExtension - OVERHANG_COLUMN_SIZE)
          : 0;
        const rightSpanExtension = (hasOverhangColumns && shadingRightHasColumn)
          ? Math.max(0, shadingRightExtension - OVERHANG_COLUMN_SIZE)
          : 0;
        const spanFromColumns = hasOverhangColumns && (shadingLeftHasColumn || shadingRightHasColumn);

        // Calculate span - horizontal fins go all the way to column edges
        const expandedLeft = spanFromColumns
          ? -faceWidth / 2 - leftSpanExtension
          : windowCenterX - windowWidth / 2 - 0.05;
        const expandedRight = spanFromColumns
          ? faceWidth / 2 + rightSpanExtension
          : windowCenterX + windowWidth / 2 + 0.05;
        const slatWidth = expandedRight - expandedLeft;
        const slatCenterX = (expandedLeft + expandedRight) / 2;

        // Map hFinDepth ratio to spacing (same as vertical fins)
        const MIN_GAP = 0.1; // 10cm spacing (dense)
        const MAX_GAP = 0.6; // 60cm spacing (sparse)
        const ratio = Math.min(1, hFinDepth / 2.6);
        const slatGap = MAX_GAP - ratio * (MAX_GAP - MIN_GAP);

        // Calculate vertical span with 30cm clearance from top and ground
        const VERTICAL_CLEARANCE = 0.3;
        const startY = spanFromColumns ? -BUILDING_LIFT + VERTICAL_CLEARANCE : windowBottomY;
        const endY = spanFromColumns ? faceHeight - VERTICAL_CLEARANCE : windowTopY;
        const totalHeight = endY - startY;

        // Calculate number of slats and center them vertically
        const numSlats = Math.max(1, Math.floor(totalHeight / slatGap) + 1);
        const actualSpan = (numSlats - 1) * slatGap;
        const startOffset = (totalHeight - actualSpan) / 2;

        // Build centered slat positions
        const slats = [];
        for (let i = 0; i < numSlats; i++) {
          slats.push(startY + startOffset + i * slatGap);
        }

        // Calculate tie rod positions (every 1.5m, centered, min 1m from columns)
        const TIE_ROD_SIZE = 0.02; // 20mm x 20mm
        const TIE_ROD_SPACING = 1.5;
        const TIE_ROD_COLUMN_CLEARANCE = 1.0;
        const tieRods = [];

        if (spanFromColumns) {
          const tieRodLeft = expandedLeft + TIE_ROD_COLUMN_CLEARANCE;
          const tieRodRight = expandedRight - TIE_ROD_COLUMN_CLEARANCE;
          const tieRodSpan = tieRodRight - tieRodLeft;

          if (tieRodSpan > 0) {
            const numTieRods = Math.max(1, Math.floor(tieRodSpan / TIE_ROD_SPACING) + 1);
            const actualTieRodSpan = (numTieRods - 1) * TIE_ROD_SPACING;
            const tieRodStartOffset = (tieRodSpan - actualTieRodSpan) / 2;

            for (let i = 0; i < numTieRods; i++) {
              tieRods.push(tieRodLeft + tieRodStartOffset + i * TIE_ROD_SPACING);
            }
          }
        }

        const tieRodHeight = faceHeight + BUILDING_LIFT;
        const tieRodCenterY = (faceHeight - BUILDING_LIFT) / 2;

        return (
          <group>
            {slats.map((slatY, i) => (
              <mesh
                key={`slat-${i}`}
                position={[slatCenterX, slatY, slatCenterZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[slatWidth, SLAT_THICKNESS, SLAT_PROJECTION]} />
                <meshPhysicalMaterial {...finAndLouverMaterialProps} />
              </mesh>
            ))}
            {tieRods.map((tieRodX, i) => (
              <mesh
                key={`tie-${i}`}
                position={[tieRodX, tieRodCenterY, slatCenterZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[TIE_ROD_SIZE, tieRodHeight, TIE_ROD_SIZE]} />
                <meshPhysicalMaterial {...finAndLouverMaterialProps} />
              </mesh>
            ))}
          </group>
        );
      })()}
    </group>
  );
}
