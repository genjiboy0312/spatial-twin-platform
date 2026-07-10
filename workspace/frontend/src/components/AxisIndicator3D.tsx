/**
 * AxisIndicator3D.tsx - 3D 축 인디케이터 (R3F 전용)
 *
 * React Three Fiber `<Canvas>` 내부에서 사용.
 * OrbitControls의 change 이벤트에만 반응하므로
 * 카메라 정지 시 드로우 오버헤드가 0입니다.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { renderOverlayAxis } from '../utils/drawAxisIndicator3D';

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

function isControlsLike(v: unknown): v is { addEventListener: (type: 'change', cb: () => void) => void; removeEventListener: (type: 'change', cb: () => void) => void } {
  return (
    v !== null &&
    typeof v === 'object' &&
    'addEventListener' in v &&
    'removeEventListener' in v
  );
}

export function AxisIndicator3D({ canvasRef }: Props) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);

  useEffect(() => {
    if (!isControlsLike(controls)) return;

    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderOverlayAxis(canvas, camera);
    };

    controls.addEventListener('change', redraw);
    redraw();

    return () => controls.removeEventListener('change', redraw);
  }, [camera, controls, canvasRef]);

  return null;
}
