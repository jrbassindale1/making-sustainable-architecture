import { Vector3 } from "three";
import { WALL_THICKNESS } from "../constants/architecture";

export function computeSunPatchHits(faceId, windowW, windowH, dir, halfW, halfD) {
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
