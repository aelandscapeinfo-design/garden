import {PLANTS_V6} from './plant-library-v6.js';
// Visual catalogue only. Botanical claims belong in a future verified OWOL database.
export const CATALOG = {
  tree: {
    name: "가벼운 수관",
    en: "AIRY CANOPY",
    category: "plants",
    model: "tree",
    radius: 0.18,
    height: 3.5,
    solid: true,
    botanicalId: null,
  },
  shrub: {
    name: "잎의 덩어리",
    en: "LEAFY SHRUB",
    category: "plants",
    model: "shrub",
    radius: 0.22,
    height: 0.85,
    botanicalId: null,
  },
  grass: {
    name: "가는 잎의 결",
    en: "SOFT GRASS",
    category: "plants",
    model: "grass",
    radius: 0.16,
    height: 0.85,
    botanicalId: null,
  },
  hosta: {
    name: "넓은 잎",
    en: "BROAD LEAF",
    category: "plants",
    model: "hosta",
    radius: 0.17,
    height: 0.45,
    botanicalId: null,
  },
  flower: {
    name: "보랏빛 꽃대",
    en: "VIOLET SPIRES",
    category: "plants",
    model: "flower",
    radius: 0.14,
    height: 0.8,
    botanicalId: null,
  },
  meadow: {
    name: "작은 흰 꽃",
    en: "AIRY BLOSSOMS",
    category: "plants",
    model: "meadow",
    radius: 0.13,
    height: 0.58,
    botanicalId: null,
  },
  cover: {
    name: "낮은 잎의 융단",
    en: "LOW FOLIAGE",
    category: "plants",
    model: "cover",
    radius: 0.17,
    height: 0.16,
    botanicalId: null,
  },
  gravel: {
    name: "고운 자갈",
    en: "FINE GRAVEL",
    category: "surface",
    model: "gravel",
    radius: 0.46,
    height: 0.06,
  },
  stone: {
    name: "자연석 판석",
    en: "LIMESTONE",
    category: "surface",
    model: "stone",
    radius: 0.34,
    height: 0.09,
  },
  wood: {
    name: "목재 포장",
    en: "TIMBER",
    category: "surface",
    model: "wood",
    radius: 0.48,
    height: 0.1,
  },
  bench: {
    name: "잠깐 머무는 자리",
    en: "GARDEN BENCH",
    category: "objects",
    model: "bench",
    radius: 0.8,
    height: 0.88,
    solid: true,
  },
};
for(const [type,p] of Object.entries(PLANTS_V6))CATALOG[type]={name:p.displayNameKo,en:p.botanicalName,category:'plants',model:type,radius:p.footprint.radiusM,height:p.modelDisplayHeightM,botanicalId:null};
export const VERIFIED_PLANT_DATA = {};
export const STORAGE_KEY = "owol-garden-v2";
export const EXAMPLE_NOTE =
  "8 × 8 m 예시 정원 · 입력한 실제 부지의 크기·형상을 재현하지 않습니다.";
export const DISCLAIMER =
  "실제 식재와 시공은 현장 조건과 전문가 검토가 필요합니다.";
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
