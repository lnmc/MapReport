import referenceStyle from './map-style.json';
import type { PublicConfig } from '../shared/config';

export interface PublicEnvironment {
  MAP_PMTILES_URL?: string;
  MAP_TERRAIN_PMTILES_URL?: string;
}

const SOURCE_BOUNDS: PublicConfig['mapBounds'] = [
  5.712890625, 39.43619299931409, 23.115234375, 51.508742458803326,
];

function pmtilesUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error('Map archive URL must use HTTPS');
  return `pmtiles://${parsed.toString()}`;
}

export function createPublicConfig(env: PublicEnvironment = {}): PublicConfig {
  // Clone the reference so per-request overrides cannot mutate the imported baseline.
  const mapStyle = structuredClone(referenceStyle);
  mapStyle.sources.protomaps.url = pmtilesUrl(
    env.MAP_PMTILES_URL,
    referenceStyle.sources.protomaps.url,
  );
  mapStyle.sources['ride-terrain-production'].url = pmtilesUrl(
    env.MAP_TERRAIN_PMTILES_URL,
    referenceStyle.sources['ride-terrain-production'].url,
  );

  return {
    mapStyle,
    defaultCenter: [15.9819, 45.815],
    defaultZoom: 11.3,
    minZoom: 4,
    maxZoom: 16,
    mapBounds: SOURCE_BOUNDS,
    allowedReportBounds: [15.7, 45.6, 16.3, 46.05],
    supportedTimeWindowsMinutes: [30, 60, 180, 720],
    attribution: '© OpenStreetMap contributors · © Protomaps · © Natural Earth · © OSMCoastline · © Mapterhorn',
  };
}
