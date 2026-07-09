import { createContext, useContext, type ReactNode } from 'react';
import type { GpsAlignmentInputs, GpsAlignmentLocalPoints, PickMode } from '../types';

export interface AlignmentContextType {
  // Basic State
  currentBuilding: { id: number; name: string } | null;
  selectedFloorId: number | null;
  selectedFloor: { id: number; floor_number: number; floor_name: string | null } | null;
  alignmentMethod: 'osm' | 'pointcloud';
  setAlignmentMethod: (method: 'osm' | 'pointcloud') => void;
  buildingOrigin: [number, number] | null;
  setBuildingOrigin: (origin: [number, number]) => void;

  // OSM Quad Settings
  quadOriginInput: { lat: string; lng: string };
  setQuadOriginInput: (updater: (prev: { lat: string; lng: string }) => { lat: string; lng: string }) => void;
  osmQuadZoom: number;
  setOsmQuadZoom: (value: number) => void;
  osmQuadScale: number;
  setOsmQuadScale: (value: number) => void;
  osmQuadOpacity: number;
  setOsmQuadOpacity: (value: number) => void;
  applyQuadOriginInput: () => void;
  resetQuadOriginToDefault: () => void;
  quadOriginInputError: string | null;
  onDoAlign: () => Promise<void>;

  // Alignment State (OSM)
  pickMode: PickMode;
  setPickMode: (mode: PickMode) => void;
  alignLocalPoints: GpsAlignmentLocalPoints;
  setAlignLocalPoints: (updater: (prev: GpsAlignmentLocalPoints) => GpsAlignmentLocalPoints) => void;
  alignGpsInputs: GpsAlignmentInputs;
  setAlignGpsInputs: (updater: (prev: GpsAlignmentInputs) => GpsAlignmentInputs) => void;
  alignmentMatrix: number[][] | null;
  setAlignmentMatrix: (matrix: number[][] | null) => void;
  alignmentRmse: number | null;
  setAlignmentRmse: (rmse: number | null) => void;
  alignmentError: string | null;
  setAlignmentError: (error: string | null) => void;
  transformedGps: { lat: number; lng: number } | null;
  setTransformedGps: (gps: { lat: number; lng: number } | null) => void;
  showAlignedGpsBillboardText: boolean;
  setShowAlignedGpsBillboardText: (value: boolean) => void;
  hasJustAligned: boolean;
  setHasJustAligned: (value: boolean) => void;
}

const AlignmentContext = createContext<AlignmentContextType | undefined>(undefined);

export function AlignmentProvider({
  children,
  ...ctxValue
}: AlignmentContextType & { children: ReactNode }) {
  return (
    <AlignmentContext.Provider value={ctxValue}>
      {children}
    </AlignmentContext.Provider>
  );
}

export function useAlignmentContext() {
  const context = useContext(AlignmentContext);
  if (!context) throw new Error('useAlignmentContext must be used within AlignmentProvider');
  return context;
}
