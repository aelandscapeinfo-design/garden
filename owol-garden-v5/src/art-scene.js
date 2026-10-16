// A deliberately small, shared fixture: the V3 comparison uses these exact coordinates.
import { createScene } from './scene-config.js';
import { placementError } from './rules.js';
export const ART_TYPES = ['tree', 'shrub', 'grass', 'flower'];
export function artScene() {
  const config = createScene('front', 6, 4.5, 3107);
  const items = [];
  const add = (type,x,z,scale=1,r=0,variant=0) => {
    const i={id:items.length+1,type,x,z,scale,r,variant};
    const error=placementError(i,items,config);
    if(error) throw Error(`${type} at ${x},${z}: ${error}`);
    items.push(i);
  };
  add('bench',config.bench.x,config.bench.z,1,0);
  add('tree',-1.8,-.95,.85,22);
  for(const p of [[-2.48,-1.48,.9,25],[-1.05,-1.53,.8,80],[-.94,-.75,.68,15],[-2.42,-.6,.82,140],[2.35,.15,.8,22]]) add('shrub',...p);
  for(const p of [[-2.5,.1,.9,20],[-1.0,.12,.92,85],[-.92,.8,.95,140],[1.65,.5,.95,5],[2.52,.95,.85,80]]) add('grass',...p);
  for(const p of [[-2.45,1.22,.95,30],[-1.92,1.36,.82,120],[-1.38,1.35,1,70],[-2.18,.92,.85,5],[1.6,1.35,.95,40],[2.12,1.55,.86,100],[2.57,1.65,.95,160]]) add('flower',...p);
  return {config,items};
}
