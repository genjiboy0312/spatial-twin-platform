import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from './Modal'

type FloorCreateModalLabels = {
  title: string
  description: string
  floorNumber: string
  floorName: string
  floorNamePlaceholder: string
  cancel: string
  create: string
  creating: string
  invalidNumber: string
  duplicateNumber: string
  preview: string
}

const copy: Record<'en' | 'ko', FloorCreateModalLabels> = {
  en: {
    title: 'Add floor',
    description: 'Enter the floor number and display name. The editor will load data by this floor number.',
    floorNumber: 'Floor number',
    floorName: 'Floor name',
    floorNamePlaceholder: 'Example: Lobby, 2F, Mechanical room',
    cancel: 'Cancel',
    create: 'Create floor',
    creating: 'Creating...',
    invalidNumber: 'Enter a floor number greater than or equal to 1.',
    duplicateNumber: 'A floor with this number already exists.',
    preview: 'Creation preview',
  },
  ko: {
    title: '층 추가',
    description: '생성할 층 번호와 표시 이름을 입력하세요. 에디터는 이 층 번호 기준으로 데이터를 불러옵니다.',
    floorNumber: '층 번호',
    floorName: '층 이름',
    floorNamePlaceholder: '예: 로비, 2층, 기계실',
    cancel: '취소',
    create: '층 생성',
    creating: '생성 중...',
    invalidNumber: '1 이상의 층 번호를 입력해주세요.',
    duplicateNumber: '이미 같은 층 번호가 있습니다.',
    preview: '생성 미리보기',
  },
}

type FloorCreateModalProps = {
  isOpen: boolean
  language: 'en' | 'ko'
  defaultFloorNumber: number
  existingFloorNumbers: number[]
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (payload: { floorNumber: number; floorName: string }) => Promise<void> | void
}

export function FloorCreateModal({
  isOpen,
  language,
  defaultFloorNumber,
  existingFloorNumbers,
  isSubmitting = false,
  onClose,
  onSubmit,
}: FloorCreateModalProps) {
  const labels = copy[language]
  const [floorNumberText, setFloorNumberText] = useState(String(defaultFloorNumber))
  const [floorName, setFloorName] = useState('')
  const floorNumber = Number(floorNumberText)
  const generatedName = language === 'ko' ? `${floorNumber || defaultFloorNumber}층` : `${floorNumber || defaultFloorNumber}F`

  useEffect(() => {
    if (!isOpen) return
    setFloorNumberText(String(defaultFloorNumber))
    setFloorName('')
  }, [defaultFloorNumber, isOpen])

  const validationError = useMemo(() => {
    if (!Number.isInteger(floorNumber) || floorNumber < 1) return labels.invalidNumber
    if (existingFloorNumbers.includes(floorNumber)) return labels.duplicateNumber
    return null
  }, [existingFloorNumbers, floorNumber, labels.duplicateNumber, labels.invalidNumber])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (validationError) return
    await onSubmit({
      floorNumber,
      floorName: floorName.trim() || generatedName,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={labels.title}>
      <form className="floor-create-modal" onSubmit={handleSubmit}>
        <p className="floor-create-modal-hint">{labels.description}</p>
        <label>
          <span>{labels.floorNumber}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={floorNumberText}
            onChange={(event) => setFloorNumberText(event.target.value)}
            autoFocus
          />
        </label>
        <label>
          <span>{labels.floorName}</span>
          <input
            type="text"
            value={floorName}
            onChange={(event) => setFloorName(event.target.value)}
            placeholder={labels.floorNamePlaceholder}
          />
        </label>
        <div className="floor-create-preview">
          <span>{labels.preview}</span>
          <strong>{validationError ? '-' : `${floorNumber}${language === 'ko' ? '층' : 'F'} / ${floorName.trim() || generatedName}`}</strong>
        </div>
        {validationError && <p className="form-error">{validationError}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            {labels.cancel}
          </button>
          <button className="btn btn-primary" type="submit" disabled={isSubmitting || Boolean(validationError)}>
            {isSubmitting ? labels.creating : labels.create}
          </button>
        </div>
      </form>
    </Modal>
  )
}
