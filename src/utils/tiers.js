export const TC = {
  HIGH:  { dprCap: 99, particles: 400, glowAll: true, pulse: true },
  MEDIUM:{ dprCap: 1.5, particles: 150, glowAll: false, pulse: true },
  LOW:   { dprCap: 1, particles: 0, glowAll: false, pulse: false },
};
export function detectTier() {
  if (typeof window === 'undefined') return 'HIGH';
  if (matchMedia('(pointer:coarse)').matches || window.innerWidth < 768) return 'LOW';
  return window.innerWidth < 1200 ? 'MEDIUM' : 'HIGH';
}
export const TIER = detectTier();
export const CFG = TC[TIER];
