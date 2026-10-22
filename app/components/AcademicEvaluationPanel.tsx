"use client";

import { useEffect, useState } from "react";
import { ACADEMIC_STORAGE } from "../lib/academic-simulation";
import { benchmarkToCsv, runAcademicBenchmark, type BenchmarkReport } from "../lib/academic-evaluation";
import { PILOT_DATASET_METADATA } from "../lib/routing";

const REPORT_STORAGE_KEY = "ruta-carga-benchmark-v2";

function downloadFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AcademicEvaluationPanel() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(REPORT_STORAGE_KEY);
        if (stored) {
          const previous = JSON.parse(stored) as BenchmarkReport;
          if (previous.dataset?.version === PILOT_DATASET_METADATA.version) setReport(previous);
        }
      } catch { localStorage.removeItem(REPORT_STORAGE_KEY); }
    });
  }, []);

  function runBenchmark() {
    const next = runAcademicBenchmark();
    setReport(next);
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(next));
  }

  function saveEvaluation() {
    const current = JSON.parse(localStorage.getItem(ACADEMIC_STORAGE.evaluation) ?? "[]") as unknown[];
    current.push({ rating, comment: comment.trim(), createdAt: new Date().toISOString() });
    localStorage.setItem(ACADEMIC_STORAGE.evaluation, JSON.stringify(current.slice(-50)));
    setComment("");
    setSaved(true);
  }

  return (
    <section className="academic-evaluation" aria-labelledby="evaluation-title">
      <div className="evaluation-heading">
        <div><p className="eyebrow">VALIDACIÓN ACADÉMICA</p><h2 id="evaluation-title">Pruebas y evaluación</h2></div>
        <div className="evaluation-actions">
          <button onClick={runBenchmark}>Ejecutar 100 cálculos</button>
          <button disabled={!report} onClick={() => report && downloadFile("ruta-carga-validacion.csv", benchmarkToCsv(report), "text/csv;charset=utf-8")}>Descargar CSV</button>
          <button disabled={!report} onClick={() => report && downloadFile("ruta-carga-validacion.json", JSON.stringify(report, null, 2), "application/json")}>Descargar JSON</button>
        </div>
      </div>

      <div className="evaluation-grid">
        <div className="benchmark-panel">
          <h3>Escenarios controlados</h3>
          {report ? (
            <div className="benchmark-table">
              <div className="benchmark-header"><span>Escenario</span><span>Ruta</span><span>Promedio / p95</span><span>Nodos</span></div>
              {report.rows.map((row) => <div key={row.scenario}><span>{row.scenario}<small>{row.restrictions} descartes · {row.distanceKm} km</small></span><strong className={row.compliant ? "valid" : "invalid"}>{row.compliant ? "Cumple" : "Revisar"}<small>{row.validRuns}/{row.samples} rutas</small></strong><span>{row.averageMs} / {row.p95Ms} ms</span><span>{row.explored}</span></div>)}
              <p className="benchmark-provenance">Conjunto {report.dataset.version} · {report.totalCalculations} cálculos · datos sintéticos · {new Date(report.generatedAt).toLocaleString("es-MX")}</p>
            </div>
          ) : <p className="evaluation-empty">Ejecuta la prueba para medir viabilidad, tiempo y nodos explorados en cuatro escenarios.</p>}
        </div>

        <div className="usability-panel">
          <h3>Evaluación de usuario local</h3>
          <label>Claridad de la ruta<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
          <label>Observaciones<textarea value={comment} onChange={(event) => { setComment(event.target.value); setSaved(false); }} placeholder="Describe si las restricciones y la simulación fueron fáciles de comprender." /></label>
          <button onClick={saveEvaluation}>Guardar evaluación</button>
          {saved && <p className="evaluation-saved">Evaluación guardada en este navegador.</p>}
        </div>
      </div>
    </section>
  );
}
