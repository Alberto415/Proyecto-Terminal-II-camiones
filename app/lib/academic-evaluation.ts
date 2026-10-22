import { findRoute, PILOT_DATASET_METADATA, type NodeId, type Vehicle } from "./routing.ts";

export type EvaluationScenario = {
  name: string;
  start: NodeId;
  goal: NodeId;
  vehicle: Vehicle;
  blocked: string[];
  expectedValid: boolean;
};

export type BenchmarkRow = {
  scenario: string;
  samples: number;
  validRuns: number;
  valid: boolean;
  expectedValid: boolean;
  compliant: boolean;
  averageMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  explored: number;
  restrictions: number;
  distanceKm: number;
  estimatedMinutes: number;
  path: string;
};

export type BenchmarkReport = {
  reportVersion: "1.1";
  generatedAt: string;
  dataset: typeof PILOT_DATASET_METADATA;
  repetitionsPerScenario: number;
  totalCalculations: number;
  rows: BenchmarkRow[];
};

export const evaluationScenarios: EvaluationScenario[] = [
  { name: "C2 sin incidentes", start: "uam", goal: "logistico", vehicle: { height: 3.6, width: 2.5, length: 10.5, weight: 18, axles: 2, turnRadius: 8.5, fuelConsumption: 26, cargoType: "general", authorizedPrivateZones: false }, blocked: [], expectedValid: true },
  { name: "T3-S2 con cierre", start: "uam", goal: "logistico", vehicle: { height: 4.25, width: 2.6, length: 18.5, weight: 42, axles: 5, turnRadius: 12.5, fuelConsumption: 38, cargoType: "general", authorizedPrivateZones: false }, blocked: ["e15"], expectedValid: true },
  { name: "HazMat", start: "uam", goal: "logistico", vehicle: { height: 4.1, width: 2.55, length: 17, weight: 36, axles: 5, turnRadius: 12, fuelConsumption: 40, cargoType: "peligrosa", authorizedPrivateZones: false }, blocked: [], expectedValid: true },
  { name: "Doble remolque (rechazo esperado)", start: "uam", goal: "logistico", vehicle: { height: 4.35, width: 2.6, length: 31, weight: 60, axles: 9, turnRadius: 15.5, fuelConsumption: 52, cargoType: "general", authorizedPrivateZones: true }, blocked: [], expectedValid: false },
];

function percentile(sorted: number[], ratio: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

export function runAcademicBenchmark(repetitions = 25, generatedAt = new Date().toISOString()): BenchmarkReport {
  const safeRepetitions = Math.max(1, Math.floor(repetitions));
  const rows = evaluationScenarios.map((scenario): BenchmarkRow => {
    const results = Array.from({ length: safeRepetitions }, () =>
      findRoute(scenario.start, scenario.goal, scenario.vehicle, scenario.blocked),
    );
    const representative = results.find((result) => result.path.length > 0) ?? results[0];
    const timings = results.map((result) => result.calculationMs).sort((a, b) => a - b);
    const validRuns = results.filter((result) => result.path.length > 0).length;
    const round = (value: number) => Number(value.toFixed(3));
    return {
      scenario: scenario.name,
      samples: safeRepetitions,
      validRuns,
      valid: validRuns === safeRepetitions,
      expectedValid: scenario.expectedValid,
      compliant: scenario.expectedValid ? validRuns === safeRepetitions : validRuns === 0,
      averageMs: round(timings.reduce((sum, value) => sum + value, 0) / timings.length),
      medianMs: round(percentile(timings, 0.5)),
      p95Ms: round(percentile(timings, 0.95)),
      maxMs: round(timings[timings.length - 1]),
      explored: representative.explored,
      restrictions: representative.rejected.length,
      distanceKm: round(representative.distance),
      estimatedMinutes: representative.minutes,
      path: representative.path.join(" → ") || "Sin ruta",
    };
  });

  return {
    reportVersion: "1.1",
    generatedAt,
    dataset: PILOT_DATASET_METADATA,
    repetitionsPerScenario: safeRepetitions,
    totalCalculations: safeRepetitions * evaluationScenarios.length,
    rows,
  };
}

function csvCell(value: string | number | boolean) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function benchmarkToCsv(report: BenchmarkReport) {
  const headers = ["escenario", "muestras", "corridas_validas", "resultado_esperado", "cumple", "promedio_ms", "mediana_ms", "p95_ms", "maximo_ms", "nodos_explorados", "restricciones_descartadas", "distancia_km", "tiempo_estimado_min", "ruta"];
  const rows = report.rows.map((row) => [row.scenario, row.samples, row.validRuns, row.expectedValid ? "Ruta valida" : "Sin ruta compatible", row.compliant ? "Si" : "No", row.averageMs, row.medianMs, row.p95Ms, row.maxMs, row.explored, row.restrictions, row.distanceKm, row.estimatedMinutes, row.path]);
  return [
    `# Ruta Carga 3D; generado=${report.generatedAt}; dataset=${report.dataset.version}; verificado_navegacion=${report.dataset.verifiedForNavigation}`,
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}
