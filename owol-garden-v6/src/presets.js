import { CATALOG, random } from "./catalog.js";
import { seedGarden } from "./layout.js";
import { placementError } from "./rules.js";
import { inside, plantingZone } from "./scene-config.js";
export function populate(c) {
  if (c.presetId === "legacy") return seedGarden();
  const items = [],
    r = random(c.seed);
  let id = 1;
  const add = (type, x, z, extra = {}) => {
    const item = {
      id,
      type,
      x: +x.toFixed(3),
      z: +z.toFixed(3),
      r: Math.round(r() * 24) * 15,
      scale: CATALOG[type].category === "plants" ? 0.9 + r() * 0.14 : 1,
      variant: Math.floor(r() * 3),
      ...extra,
    };
    if (placementError(item, items, c)) return false;
    items.push(item);
    id++;
    return true;
  };
  add("bench", c.bench.x, c.bench.z, { r: c.bench.r, variant: 0 });
  c.plantableZones.forEach((zone, index) => {
    const xs = zone.polygon.map((p) => p[0]),
      zs = zone.polygon.map((p) => p[1]),
      minx = Math.min(...xs),
      maxx = Math.max(...xs),
      minz = Math.min(...zs),
      maxz = Math.max(...zs);
    const cx = (minx + maxx) / 2,
      cz = (minz + maxz) / 2;
    if (index < 2)
      add("tree", cx, cz - (maxz - minz) * 0.23, {
        scale: c.presetId === "front" ? 0.92 : 0.7,
        r: index * 135 + 22,
      });
    const area = (maxx - minx) * (maxz - minz),
      target = Math.min(
        60,
        Math.floor(area * (zone.kind === "planter" ? 9 : 7.5)),
      );
    let n = 0;
    for (let k = 0; k < 1500 && n < target; k++) {
      const x = minx + r() * (maxx - minx),
        z = minz + r() * (maxz - minz);
      if (!inside(zone.polygon, x, z)) continue;
      const lane = (z - minz) / (maxz - minz),
        edge = Math.min(x - minx, maxx - x);
      const type =
        lane < 0.2
          ? "shrub"
          : edge < 0.29
            ? "cover"
            : lane < 0.38
              ? "hosta"
              : lane < 0.62
                ? "flower"
                : lane < 0.82
                  ? "grass"
                  : "meadow";
      if (
        c.surfaces.some((p) => p.material === "turf" && inside(p.polygon, x, z))
      )
        continue;
      if (
        items.some(
          (p) =>
            CATALOG[p.type].category === "plants" &&
            Math.hypot(p.x - x, p.z - z) <
              (p.type === "tree" ? 0.35 : type === "shrub" ? 0.43 : 0.29),
        )
      )
        continue;
      if (add(type, x, z)) n++;
    }
  });
  return items;
}
