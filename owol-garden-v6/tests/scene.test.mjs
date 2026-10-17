import { test } from "node:test";
import assert from "node:assert/strict";
import { createScene, PRESETS, plantingZone } from "../src/scene-config.js";
import { populate } from "../src/presets.js";
import { placementError, relocate } from "../src/rules.js";
import { encode, decode } from "../src/persistence.js";
import { seedGarden } from "../src/layout.js";
const i = (type, x, z, id = 9999, r = 0) => ({
  type,
  x,
  z,
  id,
  r,
  scale: 1,
  variant: 0,
});
for (const id of ["front", "terrace", "courtyard", "rooftop"])
  test(id + " valid generated example and schema round-trip", () => {
    const c = createScene(id),
      items = populate(c);
    assert.ok(items.length > 10);
    assert.ok(items.some(i=>i.type==="bench"),"Every default scene has a sitting place");
    for (const item of items)
      assert.equal(placementError(item, items, c), null, JSON.stringify(item));
    const d = encode({
        config: c,
        items,
        pending: [],
        profile: { space: PRESETS[id].name },
        wish: "쉬고 싶어요",
        camera: null,
      }),
      result = decode(JSON.stringify(d));
    assert.deepEqual(result.items, items);
    assert.deepEqual(result.sceneConfig, c);
  });
test("terrace protects tiled/deck floor, door and railing; planter accepts planting", () => {
  const c = createScene("terrace");
  assert.match(placementError(i("tree", 0, 0), [], c), /플랜터/);
  assert.match(placementError(i("tree", 0, -1.25), [], c), /문 앞/);
  assert.match(placementError(i("tree", 3.1, 0), [], c), /경계/);
  assert.equal(placementError(i("tree", -2.5, 0), [], c), null);
  assert.match(placementError(i("bench", -2.5, 0), [], c), /플랜터|경계/);
});
test("front soil accepts plants; permanent walk and door stay clear", () => {
  const c = createScene("front");
  assert.equal(placementError(i("hosta", -2, -1), [], c), null);
  assert.notEqual(placementError(i("tree", 0.5, 0), [], c), null);
  assert.notEqual(placementError(i("bench", 0.5, -2.5), [], c), null);
});
test("dimensions regenerate all spatial definitions; transfer retains every ID", () => {
  const a = createScene("terrace", 6, 3),
    b = createScene("terrace", 10, 5),
    small = createScene("terrace", 3, 3);
  assert.notDeepEqual(a.boundary, b.boundary);
  assert.notDeepEqual(a.walls, b.walls);
  assert.notDeepEqual(a.plantableZones, b.plantableZones);
  assert.notDeepEqual(a.viewpoints, b.viewpoints);
  const items = populate(b),
    result = relocate(items, small);
  assert.ok(result.pending.length);
  assert.deepEqual(
    [...result.items, ...result.pending.map((p) => p.item)]
      .map((i) => i.id)
      .sort(),
    items.map((i) => i.id).sort(),
  );
});
test("V2 always migrates to legacy 8×8 irrespective of profile", () => {
  const old = {
      version: 2,
      items: seedGarden(),
      profile: { space: "테라스" },
      wish: "a",
    },
    m = decode(old);
  assert.equal(m.sceneConfig.presetId, "legacy");
  assert.equal(m.sceneConfig.widthM, 8);
  assert.equal(m.items.length, old.items.length);
  assert.equal(old.version, 2);
});
test("invalid versions, duplicate IDs, invalid dimensions and unsafe placement rejected", () => {
  const c = createScene(),
    d = encode({
      config: c,
      items: populate(c),
      pending: [],
      profile: {},
      wish: "",
    });
  for (const mutate of [
    (d) => (d.version = 7),
    (d) => d.items.push(d.items[0]),
    (d) => (d.sceneConfig.widthM = 999),
    (d) => (d.items[0].x = 99),
  ]) {
    const copy = structuredClone(d);
    mutate(copy);
    assert.throws(() => decode(copy));
  }
  assert.throws(() => decode("{bad json"));
});
test("bench approach rotates with geometry", () => {
  const c = createScene("legacy");
  for (const angle of [0, 90, 180, 270]) {
    const a = (angle * Math.PI) / 180,
      b = i("bench", 0, 0, 1, angle);
    assert.notEqual(
      placementError(i("hosta", Math.sin(a) * 0.7, Math.cos(a) * 0.7), [b], c),
      null,
    );
    assert.equal(
      placementError(i("hosta", -Math.sin(a) * 1, -Math.cos(a) * 1), [b], c),
      null,
    );
  }
});

test("prototype names are not valid asset or preset identifiers",()=>{assert.throws(()=>createScene("__proto__",8,6));assert.throws(()=>decode({version:2,items:[i("constructor",0,0)]}));});

test("rotated paving keeps its full physical footprint within the boundary",()=>{const c=createScene('front');assert.match(placementError(i('wood',3.5,-1.8,1,45),[],c),/경계/);assert.match(placementError(i('stone',3.6,-1.8),[],c),/경계/);assert.equal(placementError(i('wood',3,-1.8,1,45),[],c),null);});
