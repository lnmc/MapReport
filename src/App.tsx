import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { PublicConfig } from '../shared/config';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

function MapView({ config, onReady, onError }: {
  config: PublicConfig;
  onReady: () => void;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: config.mapStyle as unknown as StyleSpecification,
      center: config.defaultCenter,
      zoom: config.defaultZoom,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      maxBounds: [
        [config.mapBounds[0], config.mapBounds[1]],
        [config.mapBounds[2], config.mapBounds[3]],
      ],
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.on('load', onReady);
    map.on('error', onError);

    return () => map.remove();
  }, [config, onReady, onError]);

  return <div className="map" ref={container} aria-label="Interactive map of Zagreb" />;
}

export default function App() {
  const [config, setConfig] = useState<PublicConfig>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const handleReady = useCallback(() => setStatus('ready'), []);
  const handleError = useCallback(() => setStatus('error'), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/config', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Configuration request failed: ${response.status}`);
        return response.json() as Promise<PublicConfig>;
      })
      .then(setConfig)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      {config && (
        <MapView
          config={config}
          onReady={handleReady}
          onError={handleError}
        />
      )}

      <header className="topbar">
        <div className="identity">
          <span className="identity-mark" aria-hidden="true">◎</span>
          <div>
            <p className="eyebrow">MapReport / Zagreb</p>
            <h1>Where It Smells</h1>
          </div>
        </div>
        <span className="status-pill"><span className="status-dot" /> Map preview</span>
      </header>

      <section className="intro-card" aria-label="About this map">
        <p className="section-kicker">A city, observed together</p>
        <h2>What’s in the air?</h2>
        <p>Explore Zagreb on the map. Smell reports are coming in the next release.</p>
        <div className="card-rule" />
        <p className="map-note">{status === 'loading' ? 'Loading the map…' : status === 'error' ? 'The map could not load. Check your connection and try again.' : 'Drag to explore · scroll to zoom'}</p>
      </section>

      {config && <div className="attribution">{config.attribution}</div>}
    </main>
  );
}
