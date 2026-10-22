"use client";

import { useState } from "react";
import { ACADEMIC_STORAGE } from "../lib/academic-simulation";

export type AcademicSession = {
  id: string;
  name: string;
  email: string;
  guest: boolean;
};

type Props = {
  session: AcademicSession | null;
  ready: boolean;
  onSession: (session: AcademicSession) => void;
};

export default function AcademicSessionGate({ session, ready, onSession }: Props) {
  const [mode, setMode] = useState<"welcome" | "profile">("welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (!ready || session) return null;

  function start(next: AcademicSession) {
    localStorage.setItem(ACADEMIC_STORAGE.session, JSON.stringify(next));
    onSession(next);
  }

  function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    const safeName = name.trim();
    if (!safeName) return;
    start({
      id: `local-${Date.now()}`,
      name: safeName,
      email: email.trim(),
      guest: false,
    });
  }

  return (
    <div className="academic-login-backdrop">
      <section className="academic-login" aria-labelledby="academic-login-title">
        <div className="academic-login-brand"><span>RC</span><strong>RUTA CARGA 3D</strong></div>
        <p className="academic-label">ACCESO AL PROTOTIPO</p>
        <h1 id="academic-login-title">Navegación académica para transporte pesado</h1>
        <p className="academic-login-copy">Los perfiles, vehículos y recorridos se guardan únicamente en este navegador. No es un sistema de autenticación real.</p>

        {mode === "welcome" ? (
          <div className="academic-login-options">
            <button className="academic-login-primary" onClick={() => setMode("profile")}>Crear perfil local</button>
            <button className="academic-login-guest" onClick={() => start({ id: `guest-${Date.now()}`, name: "Operador invitado", email: "", guest: true })}>Continuar como invitado</button>
          </div>
        ) : (
          <form className="academic-login-form" onSubmit={submitProfile}>
            <label>Nombre del operador<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alberto González" required /></label>
            <label>Correo académico (opcional)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@universidad.mx" /></label>
            <div><button type="button" onClick={() => setMode("welcome")}>Regresar</button><button type="submit">Guardar perfil</button></div>
          </form>
        )}

        <div className="academic-disclaimer"><strong>Modo académico</strong><span>Tráfico, GPS, restricciones y eventos son simulados.</span></div>
      </section>
    </div>
  );
}
