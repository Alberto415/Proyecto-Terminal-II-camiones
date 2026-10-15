"use client";

import { useEffect, useState } from "react";

export type MapProvider = "cesium" | "google";

export type MapCredentials = {
  cesiumToken: string;
  googleApiKey: string;
  provider: MapProvider;
};

export const MAP_STORAGE_KEYS = {
  cesium: "ruta-carga:cesium-token",
  google: "ruta-carga:google-api-key",
  provider: "ruta-carga:map-provider",
} as const;

type Props = {
  open: boolean;
  credentials: MapCredentials;
  onClose: () => void;
  onSaved: (credentials: MapCredentials) => void;
};

export default function MapCredentialsPanel({ open, credentials, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(credentials);
  const [showValues, setShowValues] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  function saveCredentials() {
    const next: MapCredentials = {
      cesiumToken: draft.cesiumToken.trim(),
      googleApiKey: draft.googleApiKey.trim(),
      provider: draft.provider,
    };

    if (next.cesiumToken) localStorage.setItem(MAP_STORAGE_KEYS.cesium, next.cesiumToken);
    else localStorage.removeItem(MAP_STORAGE_KEYS.cesium);

    if (next.googleApiKey) localStorage.setItem(MAP_STORAGE_KEYS.google, next.googleApiKey);
    else localStorage.removeItem(MAP_STORAGE_KEYS.google);

    localStorage.setItem(MAP_STORAGE_KEYS.provider, next.provider);
    onSaved(next);
    onClose();
  }

  function clearStoredCredentials() {
    localStorage.removeItem(MAP_STORAGE_KEYS.cesium);
    localStorage.removeItem(MAP_STORAGE_KEYS.google);
    localStorage.removeItem(MAP_STORAGE_KEYS.provider);
    const cleared: MapCredentials = { cesiumToken: "", googleApiKey: "", provider: "cesium" };
    setDraft(cleared);
    onSaved(cleared);
  }

  return (
    <div className="key-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="key-dialog" role="dialog" aria-modal="true" aria-labelledby="key-dialog-title">
        <div className="key-dialog-heading">
          <div>
            <p>CONFIGURACIÓN DEL MAPA</p>
            <h2 id="key-dialog-title">Claves de Cesium y Google</h2>
          </div>
          <button type="button" className="key-dialog-close" onClick={onClose} aria-label="Cerrar configuración">×</button>
        </div>

        <div className="provider-picker" role="radiogroup" aria-label="Proveedor de mapa preferido">
          <label className={draft.provider === "cesium" ? "selected" : ""}>
            <input aria-label="Usar Cesium como proveedor" type="radio" name="map-provider" value="cesium" checked={draft.provider === "cesium"} onChange={() => setDraft((current) => ({ ...current, provider: "cesium" }))} />
            <span><strong>Cesium</strong><small>Mapa predeterminado con terreno y edificios OSM</small></span>
          </label>
          <label className={draft.provider === "google" ? "selected" : ""}>
            <input aria-label="Usar Google 3D como proveedor" type="radio" name="map-provider" value="google" checked={draft.provider === "google"} onChange={() => setDraft((current) => ({ ...current, provider: "google" }))} />
            <span><strong>Google 3D</strong><small>Requiere APIs habilitadas y facturación activa</small></span>
          </label>
        </div>

        <label className="key-field">
          <span><strong>Token de Cesium ion</strong><em>{draft.cesiumToken ? "Configurado" : "Pendiente"}</em></span>
          <input
            aria-label="Token de Cesium ion"
            type={showValues ? "text" : "password"}
            value={draft.cesiumToken}
            onChange={(event) => setDraft((current) => ({ ...current, cesiumToken: event.target.value }))}
            placeholder="Pega aquí tu token de Cesium"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="key-field">
          <span><strong>API key de Google Maps</strong><em>{draft.googleApiKey ? "Configurada" : "Opcional"}</em></span>
          <input
            aria-label="API key de Google Maps"
            type={showValues ? "text" : "password"}
            value={draft.googleApiKey}
            onChange={(event) => setDraft((current) => ({ ...current, googleApiKey: event.target.value }))}
            placeholder="Pega aquí tu API key de Google"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="show-key-values">
          <input aria-label="Mostrar las claves mientras edito" type="checkbox" checked={showValues} onChange={(event) => setShowValues(event.target.checked)} />
          Mostrar las claves mientras edito
        </label>

        <div className="key-security-note">
          <strong>Se guardan solo en este navegador.</strong>
          <span>No se escriben en el código ni se suben a GitHub. Restringe las credenciales por dominio y por API.</span>
        </div>

        <div className="key-dialog-actions">
          <button type="button" className="key-clear-button" onClick={clearStoredCredentials}>Borrar claves recordadas</button>
          <div>
            <button type="button" className="key-cancel-button" onClick={onClose}>Cancelar</button>
            <button type="button" className="key-save-button" onClick={saveCredentials}>Guardar y usar</button>
          </div>
        </div>
      </section>
    </div>
  );
}
