/**
 * CompassIndicator2D.tsx - 2D 나침반 + X/Y 축 인디케이터
 *
 * 상단 고정 방향(North)을 표시하며, 3D AxisIndicator3D와 동일한
 * 디자인 언어(원형 다크 배경, 화살촉, Pretendard 폰트)로 X(빨강)/Y(초록) 축을 그림.
 */
import { useEffect, useRef } from 'react'

const CIRCLE_RADIUS = 24
const AXIS_LEN = 18

export function CompassIndicator2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const size = 64
    canvas.width = size * dpr
    canvas.height = size * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2

    // 배경 원 (shadow 포함)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    ctx.fillStyle = 'rgba(15,15,25,0.75)'
    ctx.beginPath()
    ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 테두리
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    // 축 끝점 좌표
    const tipYy = cy - AXIS_LEN
    const tipXx = cx + AXIS_LEN

    // Y 축 (위 → North, 초록) — 3D dim 버전과 유사한 알파
    drawAxis(ctx, cx, cy, 0, -1, 'rgba(68,204,68,0.5)')

    // X 축 (오른쪽 → East, 빨강) — 3D dim 버전과 유사한 알파
    drawAxis(ctx, cx, cy, 1, 0, 'rgba(255,68,68,0.5)')

    // X/Y 레이블 — 화살촉 끝에서 약간 더 나간 위치 (3D 버전과 동일한 방식)
    ctx.font = 'bold 11px Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = 'rgba(68,204,68,0.5)'
    ctx.fillText('Y', cx, tipYy - 8)

    ctx.fillStyle = 'rgba(255,68,68,0.5)'
    ctx.fillText('X', tipXx + 8, cy)

    // "N" 레이블 — Y 축 위쪽에 보조 표시 (작고 연하게)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = 'bold 7px Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'bottom'
    ctx.fillText('N', cx, cy - CIRCLE_RADIUS - 1)

    // 중심점
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 64,
        height: 64,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    />
  )
}

function drawAxis(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  color: string,
) {
  const sx = cx + dx * AXIS_LEN
  const sy = cy + dy * AXIS_LEN

  // 선
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(sx, sy)
  ctx.stroke()

  // 화살촉
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len > 0) {
    const nx = dx / len
    const ny = dy / len
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx - nx * 5 - ny * 3.5, sy - ny * 5 + nx * 3.5)
    ctx.lineTo(sx - nx * 5 + ny * 3.5, sy - ny * 5 - nx * 3.5)
    ctx.closePath()
    ctx.fill()
  }
}
