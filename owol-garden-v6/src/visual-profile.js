export const V4_PROFILE='owol-toon-02';
export const V3_PROFILE='owol-v3';
export function visualProfile(c){return c.visualProfileId || (c.presetId==='front'&&c.widthM===6&&c.depthM===4.5?V4_PROFILE:V3_PROFILE)}
export const renderStyle=c=>visualProfile(c)===V4_PROFILE?'toon':'v3';
