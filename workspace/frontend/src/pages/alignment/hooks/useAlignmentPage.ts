import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  AlignmentMethod,
  AnchorTuple,
  LocalInputMode,
  PickSource,
  ViewerPickedPoint,
} from './useAlignmentPage.types';
import { DEFAULT_SEOUL_CITY_HALL_ORIGIN } from './useAlignmentPage.constants';

export type AlignmentBuilding = { id: number; name: string };
export type AlignmentFloor = { id: number; floor_number: number; floor_name: string | null };
export type AlignmentViewMode = '2d' | '3d';

type QuadOriginInput = { lat: string; lng: string };
type TransformedPoint = { x: number; y: number; z: number };
type StateSetter<T> = Dispatch<SetStateAction<T>>;

export interface UseAlignmentPageReturn {
  // Basic State
  currentBuilding: AlignmentBuilding | null;
  setCurrentBuilding: StateSetter<AlignmentBuilding | null>;
  floors: AlignmentFloor[];
  setFloors: StateSetter<AlignmentFloor[]>;
  selectedFloorId: number | null;
  setSelectedFloorId: StateSetter<number | null>;
  selectedFloor: AlignmentFloor | null;
  handleFloorSelect: (floorId: number) => void;
  goToProjects: () => void;

  // View State
  viewMode: AlignmentViewMode;
  setViewMode: StateSetter<AlignmentViewMode>;

  // Alignment Method
  alignmentMethod: AlignmentMethod;
  setAlignmentMethod: StateSetter<AlignmentMethod>;

  // Building Origin
  buildingOrigin: [number, number] | null;
  setBuildingOrigin: StateSetter<[number, number] | null>;
  lockOriginToBuilding: boolean;
  setLockOriginToBuilding: StateSetter<boolean>;

  // OSM Quad Settings
  quadOriginInput: QuadOriginInput;
  setQuadOriginInput: StateSetter<QuadOriginInput>;
  quadOriginInputError: string | null;
  setQuadOriginInputError: StateSetter<string | null>;
  osmQuadZoom: number;
  setOsmQuadZoom: StateSetter<number>;
  osmQuadScale: number;
  setOsmQuadScale: StateSetter<number>;
  osmQuadOpacity: number;
  setOsmQuadOpacity: StateSetter<number>;
  applyQuadOriginInput: () => void;
  resetQuadOriginToDefault: () => void;

  // OSM Alignment State
  localInputMode: LocalInputMode;
  setLocalInputMode: StateSetter<LocalInputMode>;
  viewerPickedPoint: ViewerPickedPoint | null;
  setViewerPickedPoint: StateSetter<ViewerPickedPoint | null>;
  handleViewerPointPicked: (point: AnchorTuple, source: PickSource) => void;
  clearPickedPoints: () => void;

  // PointCloud Alignment State
  selectedPointCloudId: number | null;
  setSelectedPointCloudId: StateSetter<number | null>;
  modelAnchors: AnchorTuple[];
  setModelAnchors: StateSetter<AnchorTuple[]>;
  cloudAnchors: AnchorTuple[];
  setCloudAnchors: StateSetter<AnchorTuple[]>;
  showAnchorWorkflow: boolean;
  setShowAnchorWorkflow: StateSetter<boolean>;
  showAlignmentResult: boolean;
  setShowAlignmentResult: StateSetter<boolean>;
  transformedPoints: TransformedPoint[];
  setTransformedPoints: StateSetter<TransformedPoint[]>;

  // Page Handlers
  handleOSMPlacementApplied: (origin: [number, number]) => void;
  handlePointCloudAnchorComplete: (modelAnchorsData: AnchorTuple[], cloudAnchorsData: AnchorTuple[]) => void;
  handleAlignmentSave: () => void;
  handleAlignmentReset: () => void;
}

// AlignmentPage의 "기본 데이터 오케스트레이션" 훅:
// 건물/층 선택, OSM 원점, picker 상태, 초기 로딩/동기화를 담당한다.
export function useAlignmentPage(): UseAlignmentPageReturn {
  // Basic State: 현재 프로젝트에서는 페이지 로컬 상태로 관리한다.
  const [currentBuilding, setCurrentBuilding] = useState<AlignmentBuilding | null>(null);
  const [floors, setFloors] = useState<AlignmentFloor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);

  // View State
  const [viewMode, setViewMode] = useState<AlignmentViewMode>('3d');

  // Local state: Alignment 페이지 전용 UI/정합 상태
  const [alignmentMethod, setAlignmentMethod] = useState<AlignmentMethod>('osm');
  const [lockOriginToBuilding, setLockOriginToBuilding] = useState(true);
  const [buildingOrigin, setBuildingOrigin] = useState<[number, number] | null>(null);
  const [osmQuadZoom, setOsmQuadZoom] = useState<number>(17);
  const [osmQuadScale, setOsmQuadScale] = useState<number>(2);
  const [osmQuadOpacity, setOsmQuadOpacity] = useState<number>(0.72);

  // OSM Quad origin input state
  const [quadOriginInput, setQuadOriginInput] = useState<QuadOriginInput>({
    lat: String(DEFAULT_SEOUL_CITY_HALL_ORIGIN[0]),
    lng: String(DEFAULT_SEOUL_CITY_HALL_ORIGIN[1]),
  });
  const [quadOriginInputError, setQuadOriginInputError] = useState<string | null>(null);

  // OSM alignment state
  const [localInputMode, setLocalInputMode] = useState<LocalInputMode>('manual');
  const [viewerPickedPoint, setViewerPickedPoint] = useState<ViewerPickedPoint | null>(null);

  // PointCloud alignment state
  const [selectedPointCloudId, setSelectedPointCloudId] = useState<number | null>(null);
  const [modelAnchors, setModelAnchors] = useState<AnchorTuple[]>([]);
  const [cloudAnchors, setCloudAnchors] = useState<AnchorTuple[]>([]);
  const [showAnchorWorkflow, setShowAnchorWorkflow] = useState(false);
  const [showAlignmentResult, setShowAlignmentResult] = useState(false);
  const [transformedPoints, setTransformedPoints] = useState<TransformedPoint[]>([]);

  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.id === selectedFloorId) ?? null,
    [floors, selectedFloorId]
  );

  const applyQuadOriginInput = useCallback(() => {
    const lat = Number(quadOriginInput.lat);
    const lng = Number(quadOriginInput.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setQuadOriginInputError('Invalid coordinate values');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setQuadOriginInputError('Coordinate values out of range');
      return;
    }

    setQuadOriginInputError(null);
    setBuildingOrigin([lat, lng]);
  }, [quadOriginInput]);

  const resetQuadOriginToDefault = useCallback(() => {
    setQuadOriginInput({
      lat: String(DEFAULT_SEOUL_CITY_HALL_ORIGIN[0]),
      lng: String(DEFAULT_SEOUL_CITY_HALL_ORIGIN[1]),
    });
    setBuildingOrigin(DEFAULT_SEOUL_CITY_HALL_ORIGIN);
    setQuadOriginInputError(null);
  }, []);

  const handleFloorSelect = useCallback((floorId: number) => {
    setSelectedFloorId(floorId);
  }, []);

  const handleOSMPlacementApplied = useCallback((origin: [number, number]) => {
    setBuildingOrigin(origin);
    setQuadOriginInput({ lat: String(origin[0]), lng: String(origin[1]) });
    setQuadOriginInputError(null);
  }, []);

  const handlePointCloudAnchorComplete = useCallback((modelAnchorsData: AnchorTuple[], cloudAnchorsData: AnchorTuple[]) => {
    setModelAnchors(modelAnchorsData);
    setCloudAnchors(cloudAnchorsData);
    setShowAnchorWorkflow(false);
    setShowAlignmentResult(true);
  }, []);

  const handleAlignmentSave = useCallback(() => {
    setShowAlignmentResult(false);
  }, []);

  const handleAlignmentReset = useCallback(() => {
    setModelAnchors([]);
    setCloudAnchors([]);
    setTransformedPoints([]);
    setShowAlignmentResult(false);
    setShowAnchorWorkflow(false);
    setViewerPickedPoint(null);
  }, []);

  const handleViewerPointPicked = useCallback((point: AnchorTuple, source: PickSource) => {
    setViewerPickedPoint({
      id: Date.now(),
      point,
      source,
    });
  }, []);

  const clearPickedPoints = useCallback(() => {
    setViewerPickedPoint(null);
  }, []);

  const goToProjects = useCallback(() => {
    window.history.pushState(null, '', '/projects');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return {
    currentBuilding,
    setCurrentBuilding,
    floors,
    setFloors,
    selectedFloorId,
    setSelectedFloorId,
    selectedFloor,
    handleFloorSelect,
    goToProjects,
    viewMode,
    setViewMode,
    alignmentMethod,
    setAlignmentMethod,
    buildingOrigin,
    setBuildingOrigin,
    lockOriginToBuilding,
    setLockOriginToBuilding,
    quadOriginInput,
    setQuadOriginInput,
    quadOriginInputError,
    setQuadOriginInputError,
    osmQuadZoom,
    setOsmQuadZoom,
    osmQuadScale,
    setOsmQuadScale,
    osmQuadOpacity,
    setOsmQuadOpacity,
    applyQuadOriginInput,
    resetQuadOriginToDefault,
    localInputMode,
    setLocalInputMode,
    viewerPickedPoint,
    setViewerPickedPoint,
    handleViewerPointPicked,
    clearPickedPoints,
    selectedPointCloudId,
    setSelectedPointCloudId,
    modelAnchors,
    setModelAnchors,
    cloudAnchors,
    setCloudAnchors,
    showAnchorWorkflow,
    setShowAnchorWorkflow,
    showAlignmentResult,
    setShowAlignmentResult,
    transformedPoints,
    setTransformedPoints,
    handleOSMPlacementApplied,
    handlePointCloudAnchorComplete,
    handleAlignmentSave,
    handleAlignmentReset,
  };
}

export type { AlignmentMethod, LocalInputMode, AnchorTuple, PickSource, ViewerPickedPoint };
