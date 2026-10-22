export default function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    operacion: "M4 5h5v5H4z M15 14h5v5h-5z M9 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6",
    vehiculo: "M3 6h11v11H3z M14 10h4l3 4v3h-7 M6 17v2 M18 17v2 M14 14h7",
    restricciones: "M12 3 2 21h20L12 3Z M12 9v5 M12 17v1",
    entorno: "M3 20V9h6v11 M9 20V3h6v17 M15 20V12h6v8 M2 20h20 M11 7h2 M11 11h2",
    diagnostico: "M4 3v18h17 M8 16v-4 M13 16V7 M18 16v-6",
    ayuda: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17v1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.operacion} /></svg>;
}
