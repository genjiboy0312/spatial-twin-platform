import { useState } from 'react'
import type { FormEvent } from 'react'
import { createBuilding } from '../api/buildings'
import type { BuildingCreate } from '../api/buildings'

type Props = {
  onClose: () => void
  onCreated: () => void | Promise<void>
}

export function CreateBuildingModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [totalFloors, setTotalFloors] = useState('1')
  const [longitude, setLongitude] = useState('')
  const [latitude, setLatitude] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsedFloors = Number(totalFloors)
    const parsedLongitude = longitude.trim() ? Number(longitude) : null
    const parsedLatitude = latitude.trim() ? Number(latitude) : null

    if (!name.trim()) {
      setError('건물 이름을 입력해주세요.')
      return
    }

    if (!Number.isInteger(parsedFloors) || parsedFloors < 1) {
      setError('층수는 1 이상의 정수로 입력해주세요.')
      return
    }

    if (parsedLongitude !== null && Number.isNaN(parsedLongitude)) {
      setError('경도는 숫자로 입력해주세요.')
      return
    }

    if (parsedLatitude !== null && Number.isNaN(parsedLatitude)) {
      setError('위도는 숫자로 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: BuildingCreate = {
        name: name.trim(),
        ...(address.trim() && { address: address.trim() }),
        total_floors: parsedFloors,
        ...(parsedLongitude !== null && { origin_longitude: parsedLongitude }),
        ...(parsedLatitude !== null && { origin_latitude: parsedLatitude }),
      }
      await createBuilding(payload)
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : '건물 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-building-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="create-building-title">새 건물 생성</h2>
        <form onSubmit={handleSubmit}>
          <label>
            이름 <span className="required">*</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="예: 서울사옥"
            />
          </label>
          <label>
            주소
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울특별시 강남구..."
            />
          </label>
          <label>
            전체 층수
            <input
              type="number"
              min={1}
              max={200}
              value={totalFloors}
              onChange={(e) => setTotalFloors(e.target.value)}
            />
          </label>
          <label>
            기준 경도 (WGS84)
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="예: 127.0276"
            />
          </label>
          <label>
            기준 위도 (WGS84)
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="예: 37.4979"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
