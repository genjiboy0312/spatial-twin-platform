export interface GpsAlignmentInputs {
  originLat: string;
  originLng: string;
  point1Lat: string;
  point1Lng: string;
  point2Lat: string;
  point2Lng: string;
}

export interface GpsAlignmentLocalPoints {
  origin: [number, number, number] | null;
  point1: [number, number, number] | null;
  point2: [number, number, number] | null;
  display: [number, number, number] | null;
}

export type PickMode = 'none' | 'origin' | 'point1' | 'point2' | 'display';
