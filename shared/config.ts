export type Bounds = [west: number, south: number, east: number, north: number];

export interface PublicConfig {
  mapStyle: Record<string, unknown>;
  defaultCenter: [longitude: number, latitude: number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  mapBounds: Bounds;
  allowedReportBounds: Bounds;
  supportedTimeWindowsMinutes: number[];
  attribution: string;
}
