import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { Floor } from '../api/floors'

type Props = {
  isOpen: boolean
  onClose: () => void
  floors: Floor[]
  selectedFloorId: number | ''
  onSelectFloor: (floorId: number) => void
}

type Offset = { x: number; z: number; r: number }
type RefPoint = { x: number; z: number }
type Axis = 'x' | 'z' | 'r'

const FLOOR_COLORS = ['#38bdf8', '#22c55e', '#facc15', '#a78bfa', '#f97316', '#ef4444', '#14b8a6', '#60a5fa']

function floorLabel(floor: Floor) {
  return floor.floor_name ?? `${floor.floor_number}F`
}

function defaultOffset(): Offset {
  return { x: 0, z: 0, r: 0 }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number) {
  return Number(value.toFixed(2))
}

export function FloorPositionModal({ isOpen, onClose, floors, selectedFloorId, onSelectFloor }: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [expanded, setExpanded] = useState(true)
  const [adjustMode, setAdjustMode] = useState(false)
  const [showBright, setShowBright] = useState(false)
  const [refPointPicking, setRefPointPicking] = useState(false)
  const [markerSize, setMarkerSize] = useState(1)
  const [offsets, setOffsets] = useState<Record<number, Offset>>({})
  const [refPoints, setRefPoints] = useState<Record<number, RefPoint>>({})
  const [rawInputs, setRawInputs] = useState<Record<Axis, string | undefined>>({ x: undefined, z: undefined, r: undefined })
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const inputDragRef = useRef<{ axis: Axis; floorId: number; startY: number; startValue: number; active: boolean } | null>(null)
  const heldArrowRef = useRef<{ axis: Axis; direction: 1 | -1 } | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const orbitDragRef = useRef<{ type: 'rotate' | 'pan'; sx: number; sy: number; rx: number; ry: number; px: number; py: number; moved: boolean } | null>(null)
  const [viewRot, setViewRot] = useState({ x: 0, y: 0 })
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 })

  const sortedFloors = useMemo(
    () => floors.slice().sort((a, b) => b.floor_number - a.floor_number),
    [floors],
  )

  const selectedFloor = useMemo(() => {
    if (selectedFloorId !== '') return sortedFloors.find((floor) => floor.id === selectedFloorId) ?? sortedFloors[0] ?? null
    return sortedFloors[0] ?? null
  }, [selectedFloorId, sortedFloors])

  const selectedId = selectedFloor?.id ?? null
  const currentOffset = selectedId !== null ? offsets[selectedId] ?? defaultOffset() : defaultOffset()
  const currentRefPoint = selectedId !== null ? refPoints[selectedId] : undefined

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || selectedFloorId !== '' || sortedFloors.length === 0) return
    onSelectFloor(sortedFloors[0]!.id)
  }, [isOpen, onSelectFloor, selectedFloorId, sortedFloors])

  useEffect(() => {
    if (!isOpen) return
    setAdjustMode(false)
    setRefPointPicking(false)
    setRawInputs({ x: undefined, z: undefined, r: undefined })
    inputDragRef.current = null
    heldArrowRef.current = null
  }, [isOpen, selectedId])

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const drag = inputDragRef.current
      if (!drag) return
      const diff = drag.startY - event.clientY
      if (!drag.active && Math.abs(diff) > 3) {
        drag.active = true
        document.body.style.userSelect = 'none'
      }
      if (!drag.active) return
      const step = drag.axis === 'r' ? 0.08 : 0.025
      updateOffset(drag.axis, formatNumber(drag.startValue + diff * step), drag.floorId)
    }

    const handleMouseUp = () => {
      inputDragRef.current = null
      heldArrowRef.current = null
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  })

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!heldArrowRef.current || selectedId === null) return
      const { axis, direction } = heldArrowRef.current
      const current = offsets[selectedId] ?? defaultOffset()
      const step = axis === 'r' ? 0.4 : 0.12
      updateOffset(axis, formatNumber(current[axis] + direction * step), selectedId)
    }, 55)
    return () => window.clearInterval(timer)
  }, [offsets, selectedId])

  if (!isOpen) return null

  function updateOffset(axis: Axis, value: number, floorId = selectedId) {
    if (floorId === null) return
    setOffsets((current) => ({
      ...current,
      [floorId]: {
        ...(current[floorId] ?? defaultOffset()),
        [axis]: axis === 'r' ? clamp(value, -180, 180) : clamp(value, -30, 30),
      },
    }))
  }

  function resetOffset() {
    if (selectedId === null) return
    setOffsets((current) => ({ ...current, [selectedId]: defaultOffset() }))
  }

  function resetRefPoint() {
    if (selectedId === null) return
    setRefPoints((current) => {
      const next = { ...current }
      delete next[selectedId]
      return next
    })
  }

  function handleNumericKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(event.key)) return
    const value = event.currentTarget.value
    if (event.key === '-' && !value.includes('-')) return
    if (event.key === '.' && !value.includes('.')) return
    if (/^[0-9]$/.test(event.key)) return
    event.preventDefault()
  }

  function startInputDrag(axis: Axis, event: ReactMouseEvent<HTMLInputElement>) {
    if (selectedId === null || event.button !== 0) return
    inputDragRef.current = {
      axis,
      floorId: selectedId,
      startY: event.clientY,
      startValue: currentOffset[axis],
      active: false,
    }
  }

  function handleWheel(axis: Axis, event: ReactWheelEvent) {
    event.preventDefault()
    const step = axis === 'r' ? 0.5 : 0.1
    updateOffset(axis, formatNumber(currentOffset[axis] + (event.deltaY > 0 ? -step : step)))
  }

  function handlePreviewClick(event: ReactMouseEvent<HTMLElement>) {
    if (!refPointPicking || selectedId === null || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const x = formatNumber(((event.clientX - rect.left) / rect.width - 0.5) * 60)
    const z = formatNumber(((event.clientY - rect.top) / rect.height - 0.5) * -60)
    setRefPoints((current) => ({ ...current, [selectedId]: { x, z } }))
    setRefPointPicking(false)
  }

  const renderAxisField = (axis: Axis, label: string) => (
    <label className={`floor-position-axis-field axis-${axis}`} onWheel={(event) => handleWheel(axis, event)}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={rawInputs[axis] ?? currentOffset[axis]}
        disabled={!selectedFloor || !adjustMode}
        onFocus={() => setRawInputs((current) => ({ ...current, [axis]: String(currentOffset[axis]) }))}
        onBlur={() => setRawInputs((current) => ({ ...current, [axis]: undefined }))}
        onKeyDown={handleNumericKeyDown}
        onMouseDown={(event) => startInputDrag(axis, event)}
        onChange={(event) => {
          const raw = event.target.value
          setRawInputs((current) => ({ ...current, [axis]: raw }))
          if (raw === '' || raw === '-' || raw === '.') return
          const next = Number(raw)
          if (!Number.isNaN(next)) updateOffset(axis, next)
        }}
      />
      <div className="floor-position-axis-arrows">
        <button
          type="button"
          disabled={!adjustMode}
          onMouseDown={(event) => {
            event.preventDefault()
            heldArrowRef.current = { axis, direction: 1 }
          }}
          onMouseUp={() => { heldArrowRef.current = null }}
          onMouseLeave={() => { heldArrowRef.current = null }}
        >
          ^
        </button>
        <button
          type="button"
          disabled={!adjustMode}
          onMouseDown={(event) => {
            event.preventDefault()
            heldArrowRef.current = { axis, direction: -1 }
          }}
          onMouseUp={() => { heldArrowRef.current = null }}
          onMouseLeave={() => { heldArrowRef.current = null }}
        >
          v
        </button>
      </div>
    </label>
  )

  return (
    <div className="floor-position-overlay" onClick={onClose}>
      <div
        className="floor-position-window reference-style"
        style={{ transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` }}
        onClick={(event) => event.stopPropagation()}
        onMouseMove={(event) => {
          if (!dragRef.current) return
          setPosition({
            x: dragRef.current.originX + event.clientX - dragRef.current.startX,
            y: dragRef.current.originY + event.clientY - dragRef.current.startY,
          })
        }}
        onMouseUp={() => { dragRef.current = null }}
        onMouseLeave={() => { dragRef.current = null }}
      >
        <header
          className="floor-position-titlebar"
          onMouseDown={(event) => {
            dragRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              originX: position.x,
              originY: position.y,
            }
          }}
        >
          <div>
            <strong>전층 보기 - Beta</strong>
            <span>층을 쌓아 올린 상태에서 위치, 회전, 기준점을 조정합니다.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">x</button>
        </header>

        <div className="floor-position-body">
          <aside className="floor-position-list-panel">
            <div className="floor-position-panel-header">
              <div>
                <strong>층 목록</strong>
                <span>총 {sortedFloors.length}개 층</span>
              </div>
              <button type="button" onClick={() => setExpanded((value) => !value)}>
                {expanded ? '접기' : '펼치기'}
              </button>
            </div>
            {expanded && (
              <div className="floor-position-list">
                {sortedFloors.map((floor, index) => {
                  const isSelected = floor.id === selectedFloor?.id
                  const offset = offsets[floor.id] ?? defaultOffset()
                  return (
                    <button
                      key={floor.id}
                      className={isSelected ? 'selected' : ''}
                      type="button"
                      onClick={() => onSelectFloor(floor.id)}
                    >
                      <i style={{ background: FLOOR_COLORS[index % FLOOR_COLORS.length] }} />
                      <span>
                        <strong>{floorLabel(floor)}</strong>
                        <small>X {offset.x.toFixed(2)} / Z {offset.z.toFixed(2)} / R {offset.r.toFixed(1)}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>

          <main
            ref={previewRef}
            className={'floor-position-preview' + (refPointPicking ? ' picking' : '')}
            onClick={(event) => {
              if (orbitDragRef.current?.moved) return
              handlePreviewClick(event)
            }}
            onPointerDown={(event) => {
              if (refPointPicking) return
              const target = event.target as HTMLElement
              if (target.closest('.floor-position-nudge-pad, .floor-position-pick-hint, .floor-position-empty')) return
              if (event.button === 0) {
                if (target.closest('.floor-position-stack button')) return
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                orbitDragRef.current = { type: 'rotate', sx: event.clientX, sy: event.clientY, rx: viewRot.x, ry: viewRot.y, px: viewPan.x, py: viewPan.y, moved: false }
              } else if (event.button === 2) {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                orbitDragRef.current = { type: 'pan', sx: event.clientX, sy: event.clientY, rx: viewRot.x, ry: viewRot.y, px: viewPan.x, py: viewPan.y, moved: false }
              }
            }}
            onPointerMove={(event) => {
              const d = orbitDragRef.current
              if (!d) return
              const dx = event.clientX - d.sx
              const dy = event.clientY - d.sy
              if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
              if (!d.moved) return
              if (d.type === 'rotate') {
                setViewRot({ x: d.rx + dy * 0.5, y: d.ry + dx * 0.5 })
              } else {
                setViewPan({ x: d.px + dx, y: d.py + dy })
              }
            }}
            onPointerUp={() => { orbitDragRef.current = null }}
            onPointerLeave={() => { orbitDragRef.current = null }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="floor-position-grid"
              style={{
                transform: 'perspective(700px) rotateX(62deg) scale(1.2) rotateX(' + viewRot.x + 'deg) rotateY(' + viewRot.y + 'deg) translate(' + viewPan.x + 'px, ' + viewPan.y + 'px)',
              }}
            />
            <div className="floor-position-axis-guide">
              <span className="x">X</span>
              <span className="z">Z</span>
            </div>
            <div
              className={'floor-position-stack' + (showBright ? ' bright' : '')}
              style={{
                transform: 'translate(-50%, -50%) perspective(900px) rotateX(58deg) rotateZ(-30deg) rotateX(' + viewRot.x + 'deg) rotateY(' + viewRot.y + 'deg) translate(' + viewPan.x + 'px, ' + viewPan.y + 'px)',
                transformStyle: 'preserve-3d' as any,
              }}
            >
              {sortedFloors.slice().reverse().map((floor, index) => {
                const offset = offsets[floor.id] ?? defaultOffset()
                const refPoint = refPoints[floor.id]
                const isSelected = floor.id === selectedFloor?.id
                return (
                  <button
                    key={floor.id}
                    className={isSelected ? 'selected' : ''}
                    type="button"
                    onClick={(event) => {
                      if (refPointPicking) return
                      event.stopPropagation()
                      onSelectFloor(floor.id)
                    }}
                    style={{
                      '--floor-color': FLOOR_COLORS[index % FLOOR_COLORS.length],
                      '--floor-y': index * -34 + 'px',
                      '--floor-x': offset.x * 10 + 'px',
                      '--floor-z': offset.z * -6 + 'px',
                      '--floor-rot': offset.r + 'deg',
                    } as CSSProperties}
                  >
                    <span>{floorLabel(floor)}</span>
                    {refPoint && (
                      <b
                        className="floor-position-ref-marker"
                        style={{
                          '--marker-size': markerSize,
                          left: 'calc(50% + ' + refPoint.x * 2.2 + 'px)',
                          top: 'calc(50% - ' + refPoint.z * 1.2 + 'px)',
                        } as CSSProperties}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            {adjustMode && selectedFloor && (
              <div className="floor-position-nudge-pad">
                <button type="button" onClick={() => updateOffset('z', formatNumber(currentOffset.z + 0.2))}>Z+</button>
                <button type="button" onClick={() => updateOffset('x', formatNumber(currentOffset.x - 0.2))}>X-</button>
                <button type="button" onClick={() => updateOffset('x', formatNumber(currentOffset.x + 0.2))}>X+</button>
                <button type="button" onClick={() => updateOffset('z', formatNumber(currentOffset.z - 0.2))}>Z-</button>
              </div>
            )}
            {refPointPicking && (
              <div className="floor-position-pick-hint">중앙 미리보기에서 기준점으로 사용할 위치를 클릭하세요.</div>
            )}
            {sortedFloors.length === 0 && (
              <div className="floor-position-empty">표시할 층이 없습니다. 좌측에서 층을 먼저 추가하세요.</div>
            )}
          </main>

          <aside className="floor-position-control-panel">
            <div className="floor-position-panel-header">
              <div>
                <strong>층 위치 맞춤</strong>
                <span>{selectedFloor ? floorLabel(selectedFloor) : '선택 없음'}</span>
              </div>
            </div>

            <button
              className={'floor-position-mode-btn' + (adjustMode ? ' active' : '')}
              type="button"
              disabled={!selectedFloor}
              onClick={() => {
                setAdjustMode((value) => !value)
                setRefPointPicking(false)
              }}
            >
              {adjustMode ? '조정 모드 종료' : '위치 조정'}
            </button>

            <button
              className={'floor-position-mode-btn secondary' + (refPointPicking ? ' active' : '')}
              type="button"
              disabled={!selectedFloor || adjustMode}
              onClick={() => setRefPointPicking((value) => !value)}
            >
              {refPointPicking ? '기준점 선택 종료' : '기준점 지정'}
            </button>

            <label className="floor-position-toggle">
              <input type="checkbox" checked={showBright} onChange={(event) => setShowBright(event.target.checked)} />
              전체 층 밝게 보기
            </label>

            <div className="floor-position-field-grid advanced">
              {renderAxisField('x', 'X')}
              {renderAxisField('z', 'Z')}
              {renderAxisField('r', 'R')}
            </div>

            <div className="floor-position-marker-control">
              <div>
                <strong>마커 크기</strong>
                <span>{markerSize.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={markerSize}
                onChange={(event) => setMarkerSize(Number(event.target.value))}
              />
            </div>

            {currentRefPoint && (
              <div className="floor-position-ref-info">
                <strong>사용자 기준점</strong>
                <span>X {currentRefPoint.x.toFixed(2)} / Z {currentRefPoint.z.toFixed(2)}</span>
                <button type="button" onClick={resetRefPoint}>기준점 초기화</button>
              </div>
            )}

            <button className="floor-position-reset-btn" type="button" onClick={resetOffset} disabled={!selectedFloor}>
              현재 층 위치 초기화
            </button>

            <ol className="floor-position-guide">
              <li>좌측 목록에서 조정할 층을 선택합니다.</li>
              <li>위치 조정을 켜고 X/Z/R 값을 입력하거나 입력창을 위아래로 드래그합니다.</li>
              <li>화살표 버튼은 누르고 있으면 값이 계속 증가/감소합니다.</li>
              <li>기준점 지정은 중앙 미리보기 클릭으로 피벗 위치를 잡습니다.</li>
            </ol>
          </aside>
        </div>
      </div>
    </div>
  )
}
