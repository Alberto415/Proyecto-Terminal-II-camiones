import type { Vehicle } from "./routing.ts";
export type TruckKind = "rigid" | "tractor" | "double";
export type TruckConfiguration = { kind: TruckKind; label: string; length: number; width: number; height: number; axles: number; trailers: number };
export function truckConfiguration(vehicle: Pick<Vehicle, "length" | "width" | "height" | "axles">): TruckConfiguration {
  const kind: TruckKind = vehicle.length >= 25 || vehicle.axles >= 8 ? "double" : vehicle.length >= 14 || vehicle.axles >= 4 ? "tractor" : "rigid";
  return { kind, label: kind === "double" ? "Doble remolque" : kind === "tractor" ? "Tractocamión" : "Camión rígido", trailers: kind === "double" ? 2 : kind === "tractor" ? 1 : 0, length: Math.max(6, Math.min(40, vehicle.length)), width: Math.max(1.8, Math.min(3.5, vehicle.width)), height: Math.max(2.5, Math.min(5, vehicle.height)), axles: Math.max(2, Math.min(12, vehicle.axles)) };
}
export const DEFAULT_TRUCK = truckConfiguration({ length: 18.5, width: 2.6, height: 4.25, axles: 5 });
export function truckModelUrl(kind: TruckKind) { return `/models/truck-${kind}.glb`; }
