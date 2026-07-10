/**
 * drawAxisIndicator3D.ts - 3D 축 인디케이터 공용 드로잉 로직
 *
 * React Three Fiber / standalone Three.js 모두에서 카메라 회전에 따라
 * X(빨강), Y(초록), Z(파랑) 축을 2D 캔버스에 투영하여 그림.
 */
import * as THREE from 'three';

const AXIS_LEN = 18;
const CIRCLE_RADIUS = 24;

const AXES = [
  { dir: [1, 0, 0] as const, color: '#ff4444', dimColor: '#ff444440', label: 'X' },
  { dir: [0, 1, 0] as const, color: '#44cc44', dimColor: '#44cc4440', label: 'Y' },
  { dir: [0, 0, 1] as const, color: '#4488ff', dimColor: '#4488ff40', label: 'Z' },
];

/**
 * 주어진 카메라의 시점에 맞춰 3D 축 인디케이터를 canvas에 그림.
 */
export function drawAxisIndicator3D(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  camera: THREE.Camera,
): void {
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  // 배경 원 (shadow 포함)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(15,15,25,0.75)';
  ctx.beginPath();
  ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 테두리
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  for (const { dir, color, dimColor, label } of AXES) {
    // 월드 → 카메라 공간: 회전만 적용, 위치 무시, 자동 정규화
    const camDir = new THREE.Vector3(dir[0], dir[1], dir[2])
      .transformDirection(camera.matrixWorldInverse);
    const isBehind = camDir.z > 0; // Three.js camera는 -Z 방향
    const drawColor = isBehind ? dimColor : color;

    // 2D canvas 좌표 (Y 반전)
    const sx = cx + camDir.x * AXIS_LEN;
    const sy = cy - camDir.y * AXIS_LEN;

    // 선
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    // 화살촉
    const dx = sx - cx;
    const dy = sy - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 4) {
      const nx = dx / len;
      const ny = dy / len;
      ctx.fillStyle = drawColor;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - nx * 5 - ny * 3.5, sy - ny * 5 + nx * 3.5);
      ctx.lineTo(sx - nx * 5 + ny * 3.5, sy - ny * 5 - nx * 3.5);
      ctx.closePath();
      ctx.fill();
    }

    // 레이블
    ctx.fillStyle = isBehind ? dimColor : color;
    ctx.font = 'bold 11px Pretendard, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (len > 1) {
      const labelOfs = 8;
      ctx.fillText(label, sx + dx / len * labelOfs * 1.2, sy + dy / len * labelOfs * 1.2);
    }
  }

  // 중심점
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * overlay canvas를 주어진 크기로 초기화하고 devicePixelRatio를 설정한 뒤
 * drawAxisIndicator3D를 호출하는 편의 함수.
 */
export function renderOverlayAxis(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  widgetPx = 64,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = widgetPx * dpr;
  canvas.height = widgetPx * dpr;
  ctx.scale(dpr, dpr);

  camera.updateMatrixWorld(true);
  drawAxisIndicator3D(ctx, widgetPx, widgetPx, camera);
}
