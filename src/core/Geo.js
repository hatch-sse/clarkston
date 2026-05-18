export const ORIGIN = { lat: 55.7899, lon: -4.2757 };
export const METRES_PER_DEGREE = 111320;

export function project(lat, lon) {
  const x = (lon - ORIGIN.lon) * METRES_PER_DEGREE * Math.cos(ORIGIN.lat * Math.PI / 180);
  const z = -(lat - ORIGIN.lat) * METRES_PER_DEGREE;
  return { x, z };
}
