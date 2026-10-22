import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkToCsv, runAcademicBenchmark } from "../app/lib/academic-evaluation.ts";

test("la evaluación genera un informe reproducible y exportable", () => {
  const report = runAcademicBenchmark(3, "2026-10-11T12:00:00.000Z");
  assert.equal(report.generatedAt, "2026-10-11T12:00:00.000Z");
  assert.equal(report.rows.length, 4);
  assert.equal(report.totalCalculations, 12);
  assert.equal(report.dataset.verifiedForNavigation, false);
  assert.ok(report.rows.every((row) => row.compliant));
  for (const row of report.rows) {
    assert.equal(row.samples, 3);
    assert.ok(row.averageMs >= 0);
    assert.ok(row.p95Ms >= row.medianMs);
    assert.ok(row.maxMs >= row.p95Ms);
    assert.ok(row.path.length > 0);
  }

  const csv = benchmarkToCsv(report);
  assert.match(csv, /datos_sintéticos|dataset=/i);
  assert.match(csv, /promedio_ms/);
  assert.match(csv, /C2 sin incidentes/);
  assert.match(csv, /Sin ruta compatible/);
});
