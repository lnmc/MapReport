import { describe, expect, it } from 'vitest';
import { createPublicConfig } from '../worker/config';
import { createApp } from '../worker/app';

describe('map and API configuration', () => {
  it('serves health and a public config centred on Zagreb', async () => {
    const app = createApp();
    const health = await app.request('/health', {}, {});
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const response = await app.request('/config', {}, {});
    expect(response.status).toBe(200);
    const config = await response.json();
    expect(config.defaultCenter).toEqual([15.9819, 45.815]);
    expect(config.supportedTimeWindowsMinutes).toEqual([30, 60, 180, 720]);
    expect(config.mapStyle.layers).toHaveLength(43);
    expect(config.mapStyle.sources.protomaps.url).toContain('vector-z0-15.pmtiles');
    expect(config.mapStyle.sources).not.toHaveProperty('ride-terrain-production');
    expect(config.mapStyle.layers).not.toContainEqual(expect.objectContaining({ id: 'terrain-production' }));
    expect(config.attribution).not.toContain('Mapterhorn');
    expect(JSON.stringify(config)).not.toContain('password');
  });

  it('applies archive URL overrides without mutating the reference style', () => {
    const changed = createPublicConfig({ MAP_PMTILES_URL: 'https://example.com/map.pmtiles' });
    expect((changed.mapStyle.sources as Record<string, { url: string }>).protomaps.url)
      .toBe('pmtiles://https://example.com/map.pmtiles');
    expect((createPublicConfig().mapStyle.sources as Record<string, { url: string }>).protomaps.url)
      .toContain('ridemaps.neoncore.dev');
    expect(() => createPublicConfig({ MAP_PMTILES_URL: 'http://example.com/map.pmtiles' }))
      .toThrow('HTTPS');
  });
});
