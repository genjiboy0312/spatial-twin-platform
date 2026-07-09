// Alignment 화면에서 공유하는 최소 타입 정의 모음.
export type AlignmentMethod = 'osm' | 'pointcloud';
export type LocalInputMode = 'manual' | 'viewer';
export type AnchorTuple = [number, number, number];
export type PickSource = '2d' | '3d';

export type ViewerPickedPoint = {
  id: number;
  point: AnchorTuple;
  source: PickSource;
};
