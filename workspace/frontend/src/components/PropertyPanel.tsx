import type { Wall2D, Room2D } from './Canvas2DViewer'

type Props = {
  selectedWall: Wall2D | null
  wallIndex: number | null
  wallCount: number
  roomCount: number
}

export function PropertyPanel({ selectedWall, wallIndex, wallCount, roomCount }: Props) {
  return (
    <aside className="inspector card">
      <strong>Properties</strong>

      {selectedWall && wallIndex !== null ? (
        <div className="inspector-info">
          <p><span>Type</span> Wall</p>
          <p><span>Index</span> #{wallIndex}</p>
          <p><span>Start</span> ({selectedWall.x1.toFixed(2)}, {selectedWall.y1.toFixed(2)})</p>
          <p><span>End</span> ({selectedWall.x2.toFixed(2)}, {selectedWall.y2.toFixed(2)})</p>
          <p>
            <span>Length</span>
            {Math.hypot(
              selectedWall.x2 - selectedWall.x1,
              selectedWall.y2 - selectedWall.y1,
            ).toFixed(2)}{' '}
            m
          </p>
        </div>
      ) : (
        <p className="hint">
          {wallCount > 0 ? '벽을 선택하면 속성이 표시됩니다.' : '도면이 비어 있습니다.'}
        </p>
      )}

      <div className="inspector-stats">
        <small>벽 {wallCount}개 · 영역 {roomCount}개</small>
      </div>
    </aside>
  )
}
