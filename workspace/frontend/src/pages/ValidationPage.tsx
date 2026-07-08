import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { usePreferences } from '../app/preferences'
import type { Room2D, Wall2D } from '../components/Canvas2DViewer'
import { useAlignmentStore } from '../stores/alignmentStore'
import { useEditorStore, type SecurityDevice, type SecurityDeviceType } from '../stores/editorStore'
import type { AnchorPoint } from '../utils/alignmentUtils'
import { PageHeader } from './PageHeader'

type ValidationStatus = 'pass' | 'warning' | 'error'
type ValidationCategoryId = 'geometry' | 'space' | 'security' | 'alignment'
type ValidationIssueSeverity = Exclude<ValidationStatus, 'pass'>

type ValidationIssueText = {
  title: string
  detail: string
}

type ValidationIssue = ValidationIssueText & {
  id: string
  severity: ValidationIssueSeverity
}

type ValidationMetric = {
  label: string
  value: string
  tone?: ValidationStatus
}

type ValidationCategory = {
  id: ValidationCategoryId
  title: string
  status: ValidationStatus
  score: number
  summary: string
  checks: number
  issues: ValidationIssue[]
  metrics: ValidationMetric[]
}

type ValidationResult = {
  categories: ValidationCategory[]
  score: number
  status: ValidationStatus
  checkCount: number
  passedCount: number
  issueCount: number
  errorCount: number
  warningCount: number
}

type ValidationIssueCopy = {
  noGeometry: ValidationIssueText
  wallsWithoutRooms: (count: number) => ValidationIssueText
  detachedWalls: (items: string) => ValidationIssueText
  overlappingWalls: (items: string) => ValidationIssueText
  noRooms: ValidationIssueText
  invalidRooms: (items: string) => ValidationIssueText
  openRooms: (items: string) => ValidationIssueText
  noDevices: ValidationIssueText
  missingDeviceNames: (items: string) => ValidationIssueText
  invalidDeviceCoordinates: (items: string) => ValidationIssueText
  overlappingDevices: (items: string) => ValidationIssueText
  noCoverageDevices: ValidationIssueText
  coverageNeedsRooms: ValidationIssueText
  uncoveredRooms: (items: string, coverage: number) => ValidationIssueText
  noAnchors: ValidationIssueText
  incompleteAnchors: (items: string) => ValidationIssueText
  unstableAnchors: (localDistance: string, gpsDistance: string) => ValidationIssueText
  alignmentNotComputed: ValidationIssueText
  elevatedRms: (rms: string) => ValidationIssueText
  highRms: (rms: string) => ValidationIssueText
  alignmentNotApplied: ValidationIssueText
}

type ValidationLabels = {
  eyebrow: string
  title: string
  description: string
  dashboard: string
  score: string
  overall: string
  liveAudit: string
  detail: string
  checks: string
  issues: string
  warnings: string
  errors: string
  passed: string
  review: string
  openEditor: string
  openDashboard: string
  noIssues: string
  issueIntro: string
  issueCount: string
  yes: string
  no: string
  notAvailable: string
  statuses: Record<ValidationStatus, string>
  categoryTitles: Record<ValidationCategoryId, string>
  summaries: Record<ValidationCategoryId, Record<ValidationStatus, string>>
  metrics: {
    walls: string
    rooms: string
    detached: string
    overlaps: string
    totalArea: string
    openRooms: string
    positiveRooms: string
    devices: string
    named: string
    coverage: string
    anchors: string
    gpsPairs: string
    rms: string
    applied: string
  }
  deviceTypes: Record<SecurityDeviceType, string>
  issuesCopy: ValidationIssueCopy
}

const copy: Record<'en' | 'ko', ValidationLabels> = {
  en: {
    eyebrow: 'Step 6',
    title: 'Validation',
    description: 'Audit geometry, rooms, security coverage, and GPS alignment before operations handoff.',
    dashboard: 'Dashboard',
    score: 'Audit Score',
    overall: 'Overall readiness',
    liveAudit: 'Live checks run against the current editor and alignment stores.',
    detail: 'Detail',
    checks: 'Checks',
    issues: 'Issues',
    warnings: 'Warnings',
    errors: 'Errors',
    passed: 'Passed',
    review: 'Review required',
    openEditor: 'Open 3D Editor',
    openDashboard: 'Open Dashboard',
    noIssues: 'No issues detected. This category is ready for handoff.',
    issueIntro: 'Specific findings from the current model state.',
    issueCount: 'Issue count',
    yes: 'Yes',
    no: 'No',
    notAvailable: 'N/A',
    statuses: {
      pass: 'Emerald / Pass',
      warning: 'Amber / Warning',
      error: 'Ruby / Error',
    },
    categoryTitles: {
      geometry: 'Geometry',
      space: 'Space',
      security: 'Security',
      alignment: 'Alignment',
    },
    summaries: {
      geometry: {
        pass: 'Walls are associated with rooms and no segment overlaps were found.',
        warning: 'Geometry is usable, but disconnected wall relationships need review.',
        error: 'Geometry has structural issues that can block reliable downstream analysis.',
      },
      space: {
        pass: 'All rooms have positive area and complete wall enclosure.',
        warning: 'Room data is present, but enclosure quality needs review.',
        error: 'Space validation found invalid room geometry or open rooms.',
      },
      security: {
        pass: 'Security devices are named, separated, and provide basic room coverage.',
        warning: 'Security layout can proceed after reviewing device coverage or spacing.',
        error: 'Security device data is incomplete for operational handoff.',
      },
      alignment: {
        pass: 'GPS anchors are stable and the computed alignment is applied.',
        warning: 'Alignment data exists, but stability or application status needs review.',
        error: 'GPS alignment is not ready for reliable coordinate handoff.',
      },
    },
    metrics: {
      walls: 'Walls',
      rooms: 'Rooms',
      detached: 'Detached',
      overlaps: 'Overlaps',
      totalArea: 'Total area',
      openRooms: 'Open rooms',
      positiveRooms: 'Positive rooms',
      devices: 'Devices',
      named: 'Named',
      coverage: 'Coverage',
      anchors: 'Anchors',
      gpsPairs: 'GPS-ready',
      rms: 'RMS error',
      applied: 'Applied',
    },
    deviceTypes: {
      camera: 'Camera',
      sensor: 'Sensor',
      alarm: 'Alarm',
      access: 'Access',
    },
    issuesCopy: {
      noGeometry: {
        title: 'No geometry available',
        detail: 'Draw at least one wall or room before running the final validation audit.',
      },
      wallsWithoutRooms: (count) => ({
        title: `${count} wall segment${count === 1 ? '' : 's'} without rooms`,
        detail: 'Walls are present, but no room records are available to associate them with occupiable space.',
      }),
      detachedWalls: (items) => ({
        title: 'Walls not associated with room boundaries',
        detail: `${items} do not touch or cross a registered room boundary.`,
      }),
      overlappingWalls: (items) => ({
        title: 'Overlapping wall segments',
        detail: `${items} share the same line and overlap beyond a shared endpoint.`,
      }),
      noRooms: {
        title: 'No rooms registered',
        detail: 'Add room polygons or rectangles so space, coverage, and handoff checks can run.',
      },
      invalidRooms: (items) => ({
        title: 'Rooms with non-positive area',
        detail: `${items} have zero, negative, or non-finite dimensions.`,
      }),
      openRooms: (items) => ({
        title: 'Rooms are not enclosed',
        detail: `${items} are missing wall coverage along one or more room edges.`,
      }),
      noDevices: {
        title: 'No security devices placed',
        detail: 'Place cameras, sensors, alarms, or access devices before operational validation.',
      },
      missingDeviceNames: (items) => ({
        title: 'Devices missing names',
        detail: `${items} need explicit names for monitoring and incident workflows.`,
      }),
      invalidDeviceCoordinates: (items) => ({
        title: 'Devices with invalid coordinates',
        detail: `${items} have non-finite x or y positions.`,
      }),
      overlappingDevices: (items) => ({
        title: 'Overlapping device placements',
        detail: `${items} are closer than the minimum placement separation.`,
      }),
      noCoverageDevices: {
        title: 'No coverage-capable devices',
        detail: 'Add at least one camera or sensor to evaluate basic room coverage.',
      },
      coverageNeedsRooms: {
        title: 'Coverage cannot be evaluated',
        detail: 'Room data is required before camera and sensor coverage can be measured.',
      },
      uncoveredRooms: (items, coverage) => ({
        title: `Basic coverage at ${coverage}%`,
        detail: `${items} are outside the basic camera or sensor radius.`,
      }),
      noAnchors: {
        title: 'Not enough GPS anchors',
        detail: 'Place at least two anchor points with GPS coordinates before alignment validation.',
      },
      incompleteAnchors: (items) => ({
        title: 'Anchors missing GPS coordinates',
        detail: `${items} need longitude and latitude before computing alignment.`,
      }),
      unstableAnchors: (localDistance, gpsDistance) => ({
        title: 'Anchor pair is too close for stable alignment',
        detail: `Closest local pair is ${localDistance}; closest GPS pair is ${gpsDistance}. Increase separation between anchors.`,
      }),
      alignmentNotComputed: {
        title: 'Alignment has not been computed',
        detail: 'Compute the anchor transformation before validating coordinate handoff quality.',
      },
      elevatedRms: (rms) => ({
        title: 'Alignment residual needs review',
        detail: `Current RMS error is ${rms}. Review anchor placement before handoff.`,
      }),
      highRms: (rms) => ({
        title: 'Alignment residual is too high',
        detail: `Current RMS error is ${rms}. Recompute with better-distributed anchor pairs.`,
      }),
      alignmentNotApplied: {
        title: 'Alignment not applied',
        detail: 'Apply the computed GPS alignment before exporting or handing off operations data.',
      },
    },
  },
  ko: {
    eyebrow: 'Step 6',
    title: '검증',
    description: '운영 인계 전에 형상, 공간, 보안 커버리지, GPS 정합 상태를 감사합니다.',
    dashboard: '대시보드',
    score: '감사 점수',
    overall: '전체 준비도',
    liveAudit: '현재 에디터와 GPS 정합 스토어 기준으로 실시간 검증합니다.',
    detail: '상세',
    checks: '검증',
    issues: '이슈',
    warnings: '주의',
    errors: '오류',
    passed: '통과',
    review: '검토 필요',
    openEditor: '3D 편집 열기',
    openDashboard: '대시보드 열기',
    noIssues: '감지된 이슈가 없습니다. 이 범주는 인계 준비가 완료되었습니다.',
    issueIntro: '현재 모델 상태에서 발견된 세부 항목입니다.',
    issueCount: '이슈 수',
    yes: '예',
    no: '아니오',
    notAvailable: 'N/A',
    statuses: {
      pass: 'Emerald / 통과',
      warning: 'Amber / 주의',
      error: 'Ruby / 오류',
    },
    categoryTitles: {
      geometry: '형상',
      space: '공간',
      security: '보안',
      alignment: '정합',
    },
    summaries: {
      geometry: {
        pass: '벽이 공간과 연결되어 있고 겹치는 선분이 없습니다.',
        warning: '형상은 사용할 수 있지만 연결되지 않은 벽 관계를 검토해야 합니다.',
        error: '후속 분석을 막을 수 있는 형상 문제가 있습니다.',
      },
      space: {
        pass: '모든 공간의 면적이 양수이고 벽으로 닫혀 있습니다.',
        warning: '공간 데이터가 있지만 폐합 품질을 검토해야 합니다.',
        error: '공간 검증에서 잘못된 면적 또는 열린 공간을 발견했습니다.',
      },
      security: {
        pass: '보안 장치 이름, 간격, 기본 커버리지가 준비되었습니다.',
        warning: '장치 커버리지나 간격을 검토하면 보안 배치를 진행할 수 있습니다.',
        error: '운영 인계에 필요한 보안 장치 데이터가 부족합니다.',
      },
      alignment: {
        pass: 'GPS 앵커가 안정적이고 계산된 정합이 적용되었습니다.',
        warning: '정합 데이터가 있지만 안정성 또는 적용 상태 검토가 필요합니다.',
        error: '신뢰할 수 있는 좌표 인계를 위한 GPS 정합이 준비되지 않았습니다.',
      },
    },
    metrics: {
      walls: '벽',
      rooms: '공간',
      detached: '분리',
      overlaps: '겹침',
      totalArea: '총 면적',
      openRooms: '열린 공간',
      positiveRooms: '정상 공간',
      devices: '장치',
      named: '이름 지정',
      coverage: '커버리지',
      anchors: '앵커',
      gpsPairs: 'GPS 준비',
      rms: 'RMS 오차',
      applied: '적용',
    },
    deviceTypes: {
      camera: '카메라',
      sensor: '센서',
      alarm: '알람',
      access: '출입',
    },
    issuesCopy: {
      noGeometry: {
        title: '형상 데이터 없음',
        detail: '최종 검증을 실행하기 전에 벽 또는 공간을 하나 이상 작성하세요.',
      },
      wallsWithoutRooms: (count) => ({
        title: `공간 없는 벽 ${count}개`,
        detail: '벽은 있지만 점유 공간과 연결할 공간 레코드가 없습니다.',
      }),
      detachedWalls: (items) => ({
        title: '공간 경계와 연결되지 않은 벽',
        detail: `${items} 항목이 등록된 공간 경계와 닿거나 교차하지 않습니다.`,
      }),
      overlappingWalls: (items) => ({
        title: '겹치는 벽 선분',
        detail: `${items} 항목이 같은 선 위에서 끝점 이상으로 겹칩니다.`,
      }),
      noRooms: {
        title: '등록된 공간 없음',
        detail: '공간, 커버리지, 인계 검증을 위해 공간 사각형을 추가하세요.',
      },
      invalidRooms: (items) => ({
        title: '면적이 양수가 아닌 공간',
        detail: `${items} 항목의 치수가 0, 음수 또는 유한하지 않습니다.`,
      }),
      openRooms: (items) => ({
        title: '닫히지 않은 공간',
        detail: `${items} 항목은 하나 이상의 모서리에 벽 커버리지가 없습니다.`,
      }),
      noDevices: {
        title: '배치된 보안 장치 없음',
        detail: '운영 검증 전에 카메라, 센서, 알람 또는 출입 장치를 배치하세요.',
      },
      missingDeviceNames: (items) => ({
        title: '이름이 없는 장치',
        detail: `${items} 항목은 모니터링과 사고 대응을 위한 명시적 이름이 필요합니다.`,
      }),
      invalidDeviceCoordinates: (items) => ({
        title: '좌표가 잘못된 장치',
        detail: `${items} 항목의 x 또는 y 위치가 유한하지 않습니다.`,
      }),
      overlappingDevices: (items) => ({
        title: '겹친 장치 배치',
        detail: `${items} 항목이 최소 배치 간격보다 가깝습니다.`,
      }),
      noCoverageDevices: {
        title: '커버리지 장치 없음',
        detail: '기본 공간 커버리지를 평가하려면 카메라 또는 센서를 하나 이상 추가하세요.',
      },
      coverageNeedsRooms: {
        title: '커버리지 평가 불가',
        detail: '카메라와 센서 커버리지를 계산하려면 공간 데이터가 필요합니다.',
      },
      uncoveredRooms: (items, coverage) => ({
        title: `기본 커버리지 ${coverage}%`,
        detail: `${items} 항목은 기본 카메라 또는 센서 반경 밖에 있습니다.`,
      }),
      noAnchors: {
        title: 'GPS 앵커 부족',
        detail: '정합 검증 전에 GPS 좌표가 있는 앵커를 최소 두 개 배치하세요.',
      },
      incompleteAnchors: (items) => ({
        title: 'GPS 좌표가 없는 앵커',
        detail: `${items} 항목은 정합 계산 전에 경도와 위도가 필요합니다.`,
      }),
      unstableAnchors: (localDistance, gpsDistance) => ({
        title: '안정적인 정합에 앵커 쌍이 너무 가까움',
        detail: `가장 가까운 로컬 쌍은 ${localDistance}, GPS 쌍은 ${gpsDistance}입니다. 앵커 간격을 넓히세요.`,
      }),
      alignmentNotComputed: {
        title: '정합 미계산',
        detail: '좌표 인계 품질을 검증하기 전에 앵커 변환을 계산하세요.',
      },
      elevatedRms: (rms) => ({
        title: '정합 잔차 검토 필요',
        detail: `현재 RMS 오차는 ${rms}입니다. 인계 전에 앵커 배치를 검토하세요.`,
      }),
      highRms: (rms) => ({
        title: '정합 잔차가 너무 큼',
        detail: `현재 RMS 오차는 ${rms}입니다. 더 넓게 분산된 앵커 쌍으로 다시 계산하세요.`,
      }),
      alignmentNotApplied: {
        title: '정합 미적용',
        detail: '내보내기 또는 운영 인계 전에 계산된 GPS 정합을 적용하세요.',
      },
    },
  },
}

const GEOMETRY_TOLERANCE = 0.05
const MIN_SEGMENT_OVERLAP = 0.1
const DEVICE_OVERLAP_DISTANCE = 1
const COVERAGE_RADIUS = 6
const MIN_LOCAL_ANCHOR_DISTANCE = 2
const MIN_GPS_ANCHOR_DISTANCE_METERS = 1
const ALIGNMENT_RMS_WARNING_METERS = 1
const ALIGNMENT_RMS_ERROR_METERS = 3

function useValidation(labels: ValidationLabels): ValidationResult {
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)
  const anchors = useAlignmentStore((state) => state.anchors)
  const result = useAlignmentStore((state) => state.result)
  const isApplied = useAlignmentStore((state) => state.isApplied)

  return useMemo(
    () => buildValidation({ labels, walls, rooms, devices, anchors, result, isApplied }),
    [anchors, devices, isApplied, labels, result, rooms, walls],
  )
}

function buildValidation({
  labels,
  walls,
  rooms,
  devices,
  anchors,
  result,
  isApplied,
}: {
  labels: ValidationLabels
  walls: Wall2D[]
  rooms: Room2D[]
  devices: SecurityDevice[]
  anchors: AnchorPoint[]
  result: ReturnType<typeof useAlignmentStore.getState>['result']
  isApplied: boolean
}): ValidationResult {
  const geometry = buildGeometryCategory(labels, walls, rooms)
  const space = buildSpaceCategory(labels, rooms, walls)
  const security = buildSecurityCategory(labels, devices, rooms)
  const alignment = buildAlignmentCategory(labels, anchors, result, isApplied)
  const categories = [geometry, space, security, alignment]
  const checkCount = categories.reduce((sum, category) => sum + category.checks, 0)
  const errorCount = categories.reduce((sum, category) => sum + category.issues.filter((issue) => issue.severity === 'error').length, 0)
  const warningCount = categories.reduce((sum, category) => sum + category.issues.filter((issue) => issue.severity === 'warning').length, 0)
  const issueCount = errorCount + warningCount
  const passedCount = categories.filter((category) => category.status === 'pass').length
  const score = Math.round(categories.reduce((sum, category) => sum + category.score, 0) / categories.length)
  const status = categories.some((category) => category.status === 'error')
    ? 'error'
    : categories.some((category) => category.status === 'warning')
      ? 'warning'
      : 'pass'

  return { categories, score, status, checkCount, passedCount, issueCount, errorCount, warningCount }
}

function buildGeometryCategory(labels: ValidationLabels, walls: Wall2D[], rooms: Room2D[]): ValidationCategory {
  const issues: ValidationIssue[] = []
  const overlappingPairs = findOverlappingWallPairs(walls)
  const detachedWallIndexes = rooms.length === 0 ? [] : walls
    .map((wall, index) => (wallTouchesAnyRoom(wall, rooms) ? null : index))
    .filter((index): index is number => index !== null)

  if (walls.length === 0 && rooms.length === 0) {
    issues.push(createIssue('geometry-empty', 'error', labels.issuesCopy.noGeometry))
  }

  if (walls.length > 0 && rooms.length === 0) {
    issues.push(createIssue('geometry-walls-without-rooms', 'error', labels.issuesCopy.wallsWithoutRooms(walls.length)))
  }

  if (detachedWallIndexes.length > 0) {
    issues.push(createIssue('geometry-detached-walls', 'warning', labels.issuesCopy.detachedWalls(formatIndexList(detachedWallIndexes, 'W'))))
  }

  if (overlappingPairs.length > 0) {
    issues.push(createIssue('geometry-overlapping-walls', 'error', labels.issuesCopy.overlappingWalls(formatPairList(overlappingPairs, 'W'))))
  }

  return createCategory(labels, 'geometry', 2, issues, [
    { label: labels.metrics.walls, value: String(walls.length) },
    { label: labels.metrics.rooms, value: String(rooms.length) },
    { label: labels.metrics.detached, value: String(detachedWallIndexes.length), tone: detachedWallIndexes.length > 0 ? 'warning' : 'pass' },
    { label: labels.metrics.overlaps, value: String(overlappingPairs.length), tone: overlappingPairs.length > 0 ? 'error' : 'pass' },
  ])
}

function buildSpaceCategory(labels: ValidationLabels, rooms: Room2D[], walls: Wall2D[]): ValidationCategory {
  const issues: ValidationIssue[] = []
  const invalidRoomIndexes = rooms
    .map((room, index) => (hasPositiveRoomArea(room) ? null : index))
    .filter((index): index is number => index !== null)
  const validRooms = rooms.filter(hasPositiveRoomArea)
  const openRoomIndexes = rooms
    .map((room, index) => (hasPositiveRoomArea(room) && !isRoomEnclosed(room, walls) ? index : null))
    .filter((index): index is number => index !== null)
  const totalArea = validRooms.reduce((sum, room) => sum + room.w * room.h, 0)

  if (rooms.length === 0) {
    issues.push(createIssue('space-empty', 'error', labels.issuesCopy.noRooms))
  }

  if (invalidRoomIndexes.length > 0) {
    issues.push(createIssue('space-invalid-area', 'error', labels.issuesCopy.invalidRooms(formatRoomList(rooms, invalidRoomIndexes))))
  }

  if (openRoomIndexes.length > 0) {
    issues.push(createIssue('space-open-rooms', 'error', labels.issuesCopy.openRooms(formatRoomList(rooms, openRoomIndexes))))
  }

  return createCategory(labels, 'space', 2, issues, [
    { label: labels.metrics.rooms, value: String(rooms.length) },
    { label: labels.metrics.positiveRooms, value: `${validRooms.length}/${rooms.length}` },
    { label: labels.metrics.openRooms, value: String(openRoomIndexes.length), tone: openRoomIndexes.length > 0 ? 'error' : 'pass' },
    { label: labels.metrics.totalArea, value: `${formatNumber(totalArea)} m2` },
  ])
}

function buildSecurityCategory(labels: ValidationLabels, devices: SecurityDevice[], rooms: Room2D[]): ValidationCategory {
  const issues: ValidationIssue[] = []
  const missingNameIndexes = devices
    .map((device, index) => (device.name.trim().length === 0 ? index : null))
    .filter((index): index is number => index !== null)
  const invalidCoordinateIndexes = devices
    .map((device, index) => (hasFiniteDevicePosition(device) ? null : index))
    .filter((index): index is number => index !== null)
  const overlappingPairs = findOverlappingDevicePairs(devices)
  const validRooms = rooms.filter(hasPositiveRoomArea)
  const coverageDevices = devices.filter((device) => hasFiniteDevicePosition(device) && (device.device_type === 'camera' || device.device_type === 'sensor'))
  const uncoveredRoomIndexes = validRooms
    .map((room, index) => (isRoomCovered(room, coverageDevices) ? null : rooms.indexOf(room)))
    .filter((index): index is number => index !== null)
  const coverage = validRooms.length === 0 ? 0 : Math.round(((validRooms.length - uncoveredRoomIndexes.length) / validRooms.length) * 100)

  if (devices.length === 0) {
    issues.push(createIssue('security-no-devices', 'error', labels.issuesCopy.noDevices))
  }

  if (missingNameIndexes.length > 0) {
    issues.push(createIssue('security-missing-names', 'error', labels.issuesCopy.missingDeviceNames(formatDeviceList(labels, devices, missingNameIndexes))))
  }

  if (invalidCoordinateIndexes.length > 0) {
    issues.push(createIssue('security-invalid-coordinates', 'error', labels.issuesCopy.invalidDeviceCoordinates(formatDeviceList(labels, devices, invalidCoordinateIndexes))))
  }

  if (overlappingPairs.length > 0) {
    issues.push(createIssue('security-overlapping-devices', 'error', labels.issuesCopy.overlappingDevices(formatDevicePairList(labels, devices, overlappingPairs))))
  }

  if (rooms.length === 0) {
    issues.push(createIssue('security-coverage-needs-rooms', 'warning', labels.issuesCopy.coverageNeedsRooms))
  } else if (devices.length > 0 && coverageDevices.length === 0) {
    issues.push(createIssue('security-no-coverage-devices', 'error', labels.issuesCopy.noCoverageDevices))
  } else if (uncoveredRoomIndexes.length > 0) {
    issues.push(createIssue('security-uncovered-rooms', 'warning', labels.issuesCopy.uncoveredRooms(formatRoomList(rooms, uncoveredRoomIndexes), coverage)))
  }

  return createCategory(labels, 'security', 3, issues, [
    { label: labels.metrics.devices, value: String(devices.length) },
    { label: labels.metrics.named, value: `${devices.length - missingNameIndexes.length}/${devices.length}` },
    { label: labels.metrics.coverage, value: validRooms.length === 0 ? labels.notAvailable : `${coverage}%`, tone: coverage < 70 && validRooms.length > 0 ? 'warning' : 'pass' },
    { label: labels.metrics.overlaps, value: String(overlappingPairs.length), tone: overlappingPairs.length > 0 ? 'error' : 'pass' },
  ])
}

function buildAlignmentCategory(
  labels: ValidationLabels,
  anchors: AnchorPoint[],
  result: ReturnType<typeof useAlignmentStore.getState>['result'],
  isApplied: boolean,
): ValidationCategory {
  const issues: ValidationIssue[] = []
  const completeAnchors = anchors.filter(hasGpsCoords)
  const incompleteAnchorIndexes = anchors
    .map((anchor, index) => (hasGpsCoords(anchor) ? null : index))
    .filter((index): index is number => index !== null)
  const closestPair = findClosestAnchorDistances(completeAnchors)
  const rms = result?.rmsErrorMeters ?? null

  if (anchors.length < 2 || completeAnchors.length < 2) {
    issues.push(createIssue('alignment-not-enough-anchors', 'error', labels.issuesCopy.noAnchors))
  }

  if (incompleteAnchorIndexes.length > 0) {
    issues.push(createIssue('alignment-incomplete-anchors', 'warning', labels.issuesCopy.incompleteAnchors(formatAnchorList(anchors, incompleteAnchorIndexes))))
  }

  if (closestPair && (closestPair.localDistance < MIN_LOCAL_ANCHOR_DISTANCE || closestPair.gpsDistance < MIN_GPS_ANCHOR_DISTANCE_METERS)) {
    issues.push(createIssue(
      'alignment-unstable-pair',
      'error',
      labels.issuesCopy.unstableAnchors(formatMeters(closestPair.localDistance), formatMeters(closestPair.gpsDistance)),
    ))
  }

  if (completeAnchors.length >= 2 && !result) {
    issues.push(createIssue('alignment-not-computed', 'warning', labels.issuesCopy.alignmentNotComputed))
  }

  if (rms !== null && rms > ALIGNMENT_RMS_ERROR_METERS) {
    issues.push(createIssue('alignment-high-rms', 'error', labels.issuesCopy.highRms(formatMeters(rms))))
  } else if (rms !== null && rms > ALIGNMENT_RMS_WARNING_METERS) {
    issues.push(createIssue('alignment-elevated-rms', 'warning', labels.issuesCopy.elevatedRms(formatMeters(rms))))
  }

  if (!isApplied) {
    issues.push(createIssue('alignment-not-applied', 'warning', labels.issuesCopy.alignmentNotApplied))
  }

  return createCategory(labels, 'alignment', 2, issues, [
    { label: labels.metrics.anchors, value: String(anchors.length) },
    { label: labels.metrics.gpsPairs, value: `${completeAnchors.length}/${anchors.length}` },
    { label: labels.metrics.rms, value: rms === null ? labels.notAvailable : formatMeters(rms), tone: rms !== null && rms > ALIGNMENT_RMS_WARNING_METERS ? 'warning' : 'pass' },
    { label: labels.metrics.applied, value: isApplied ? labels.yes : labels.no, tone: isApplied ? 'pass' : 'warning' },
  ])
}

function createCategory(
  labels: ValidationLabels,
  id: ValidationCategoryId,
  checks: number,
  issues: ValidationIssue[],
  metrics: ValidationMetric[],
): ValidationCategory {
  const status = getStatusFromIssues(issues)

  return {
    id,
    title: labels.categoryTitles[id],
    status,
    score: getScoreFromIssues(issues),
    summary: labels.summaries[id][status],
    checks,
    issues,
    metrics,
  }
}

function createIssue(id: string, severity: ValidationIssueSeverity, text: ValidationIssueText): ValidationIssue {
  return { id, severity, title: text.title, detail: text.detail }
}

function getStatusFromIssues(issues: ValidationIssue[]): ValidationStatus {
  if (issues.some((issue) => issue.severity === 'error')) return 'error'
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'pass'
}

function getScoreFromIssues(issues: ValidationIssue[]): number {
  const errorPenalty = issues.filter((issue) => issue.severity === 'error').length * 28
  const warningPenalty = issues.filter((issue) => issue.severity === 'warning').length * 12
  return Math.max(0, 100 - errorPenalty - warningPenalty)
}

function hasPositiveRoomArea(room: Room2D): boolean {
  return Number.isFinite(room.x) && Number.isFinite(room.y) && Number.isFinite(room.w) && Number.isFinite(room.h) && room.w > 0 && room.h > 0
}

function hasFiniteDevicePosition(device: SecurityDevice): boolean {
  return Number.isFinite(device.x) && Number.isFinite(device.y)
}

function hasGpsCoords(anchor: AnchorPoint): boolean {
  return Number.isFinite(anchor.longitude) && Number.isFinite(anchor.latitude) && (anchor.longitude !== 0 || anchor.latitude !== 0)
}

function wallLength(wall: Wall2D): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
}

function getRoomEdges(room: Room2D): Wall2D[] {
  const x2 = room.x + room.w
  const y2 = room.y + room.h
  return [
    { x1: room.x, y1: room.y, x2, y2: room.y },
    { x1: x2, y1: room.y, x2, y2 },
    { x1: x2, y1: y2, x2: room.x, y2 },
    { x1: room.x, y1: y2, x2: room.x, y2: room.y },
  ]
}

function wallTouchesAnyRoom(wall: Wall2D, rooms: Room2D[]): boolean {
  return rooms.some((room) => hasPositiveRoomArea(room) && wallTouchesRoom(wall, room))
}

function wallTouchesRoom(wall: Wall2D, room: Room2D): boolean {
  const mid = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 }
  if (pointInsideRoom(mid.x, mid.y, room)) return true
  return getRoomEdges(room).some((edge) => segmentsIntersect(wall, edge) || segmentsOverlap(wall, edge))
}

function pointInsideRoom(x: number, y: number, room: Room2D): boolean {
  return x >= room.x - GEOMETRY_TOLERANCE
    && x <= room.x + room.w + GEOMETRY_TOLERANCE
    && y >= room.y - GEOMETRY_TOLERANCE
    && y <= room.y + room.h + GEOMETRY_TOLERANCE
}

function isRoomEnclosed(room: Room2D, walls: Wall2D[]): boolean {
  if (!hasPositiveRoomArea(room)) return false
  return getRoomEdges(room).every((edge) => isRoomEdgeCovered(edge, walls))
}

function isRoomEdgeCovered(edge: Wall2D, walls: Wall2D[]): boolean {
  const edgeHorizontal = approximatelyEqual(edge.y1, edge.y2)
  const edgeVertical = approximatelyEqual(edge.x1, edge.x2)
  const edgeStart = edgeHorizontal ? Math.min(edge.x1, edge.x2) : Math.min(edge.y1, edge.y2)
  const edgeEnd = edgeHorizontal ? Math.max(edge.x1, edge.x2) : Math.max(edge.y1, edge.y2)
  const intervals = walls
    .map((wall) => getAxisAlignedOverlap(edge, wall, edgeHorizontal, edgeVertical))
    .filter((interval): interval is [number, number] => interval !== null)
    .sort((a, b) => a[0] - b[0])

  let coveredUntil = edgeStart
  for (const [start, end] of intervals) {
    if (start > coveredUntil + GEOMETRY_TOLERANCE) return false
    coveredUntil = Math.max(coveredUntil, end)
    if (coveredUntil >= edgeEnd - GEOMETRY_TOLERANCE) return true
  }
  return false
}

function getAxisAlignedOverlap(
  edge: Wall2D,
  wall: Wall2D,
  edgeHorizontal: boolean,
  edgeVertical: boolean,
): [number, number] | null {
  if (edgeHorizontal) {
    if (!approximatelyEqual(wall.y1, edge.y1) || !approximatelyEqual(wall.y2, edge.y1) || !approximatelyEqual(wall.y1, wall.y2)) return null
    return overlapRange(edge.x1, edge.x2, wall.x1, wall.x2)
  }

  if (edgeVertical) {
    if (!approximatelyEqual(wall.x1, edge.x1) || !approximatelyEqual(wall.x2, edge.x1) || !approximatelyEqual(wall.x1, wall.x2)) return null
    return overlapRange(edge.y1, edge.y2, wall.y1, wall.y2)
  }

  return null
}

function overlapRange(a1: number, a2: number, b1: number, b2: number): [number, number] | null {
  const start = Math.max(Math.min(a1, a2), Math.min(b1, b2))
  const end = Math.min(Math.max(a1, a2), Math.max(b1, b2))
  return end - start > MIN_SEGMENT_OVERLAP ? [start, end] : null
}

function findOverlappingWallPairs(walls: Wall2D[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const first = walls[i]
      const second = walls[j]
      if (first && second && segmentsOverlap(first, second)) pairs.push([i, j])
    }
  }
  return pairs
}

function findOverlappingDevicePairs(devices: SecurityDevice[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < devices.length; i += 1) {
    for (let j = i + 1; j < devices.length; j += 1) {
      const first = devices[i]
      const second = devices[j]
      if (first && second && hasFiniteDevicePosition(first) && hasFiniteDevicePosition(second)) {
        const distance = Math.hypot(first.x - second.x, first.y - second.y)
        if (distance < DEVICE_OVERLAP_DISTANCE) pairs.push([i, j])
      }
    }
  }
  return pairs
}

function segmentsOverlap(first: Wall2D, second: Wall2D): boolean {
  if (wallLength(first) <= GEOMETRY_TOLERANCE || wallLength(second) <= GEOMETRY_TOLERANCE) return false
  if (!segmentsAreCollinear(first, second)) return false

  const useX = Math.abs(first.x2 - first.x1) >= Math.abs(first.y2 - first.y1)
  const firstStart = useX ? first.x1 : first.y1
  const firstEnd = useX ? first.x2 : first.y2
  const secondStart = useX ? second.x1 : second.y1
  const secondEnd = useX ? second.x2 : second.y2
  return overlapRange(firstStart, firstEnd, secondStart, secondEnd) !== null
}

function segmentsAreCollinear(first: Wall2D, second: Wall2D): boolean {
  return pointLineDistance(second.x1, second.y1, first) <= GEOMETRY_TOLERANCE
    && pointLineDistance(second.x2, second.y2, first) <= GEOMETRY_TOLERANCE
}

function pointLineDistance(x: number, y: number, line: Wall2D): number {
  const length = wallLength(line)
  if (length <= GEOMETRY_TOLERANCE) return Math.hypot(x - line.x1, y - line.y1)
  return Math.abs((line.y2 - line.y1) * x - (line.x2 - line.x1) * y + line.x2 * line.y1 - line.y2 * line.x1) / length
}

function segmentsIntersect(first: Wall2D, second: Wall2D): boolean {
  const d1 = direction(first, second.x1, second.y1)
  const d2 = direction(first, second.x2, second.y2)
  const d3 = direction(second, first.x1, first.y1)
  const d4 = direction(second, first.x2, first.y2)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  if (approximatelyEqual(d1, 0) && pointOnSegment(second.x1, second.y1, first)) return true
  if (approximatelyEqual(d2, 0) && pointOnSegment(second.x2, second.y2, first)) return true
  if (approximatelyEqual(d3, 0) && pointOnSegment(first.x1, first.y1, second)) return true
  if (approximatelyEqual(d4, 0) && pointOnSegment(first.x2, first.y2, second)) return true
  return false
}

function direction(segment: Wall2D, x: number, y: number): number {
  return (x - segment.x1) * (segment.y2 - segment.y1) - (y - segment.y1) * (segment.x2 - segment.x1)
}

function pointOnSegment(x: number, y: number, segment: Wall2D): boolean {
  return x >= Math.min(segment.x1, segment.x2) - GEOMETRY_TOLERANCE
    && x <= Math.max(segment.x1, segment.x2) + GEOMETRY_TOLERANCE
    && y >= Math.min(segment.y1, segment.y2) - GEOMETRY_TOLERANCE
    && y <= Math.max(segment.y1, segment.y2) + GEOMETRY_TOLERANCE
}

function isRoomCovered(room: Room2D, devices: SecurityDevice[]): boolean {
  const center = { x: room.x + room.w / 2, y: room.y + room.h / 2 }
  return devices.some((device) => Math.hypot(device.x - center.x, device.y - center.y) <= COVERAGE_RADIUS)
}

function findClosestAnchorDistances(anchors: AnchorPoint[]): { localDistance: number; gpsDistance: number } | null {
  let localDistance = Infinity
  let gpsDistance = Infinity
  for (let i = 0; i < anchors.length; i += 1) {
    for (let j = i + 1; j < anchors.length; j += 1) {
      const first = anchors[i]
      const second = anchors[j]
      if (!first || !second) continue
      localDistance = Math.min(localDistance, Math.hypot(first.localX - second.localX, first.localY - second.localY))
      gpsDistance = Math.min(gpsDistance, getGpsDistanceMeters(first, second))
    }
  }
  return Number.isFinite(localDistance) && Number.isFinite(gpsDistance) ? { localDistance, gpsDistance } : null
}

function getGpsDistanceMeters(first: AnchorPoint, second: AnchorPoint): number {
  const avgLatitude = ((first.latitude + second.latitude) / 2) * (Math.PI / 180)
  const dx = (first.longitude - second.longitude) * Math.cos(avgLatitude) * 111_320
  const dy = (first.latitude - second.latitude) * 111_320
  return Math.hypot(dx, dy)
}

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= GEOMETRY_TOLERANCE
}

function formatIndexList(indexes: number[], prefix: string): string {
  return formatLimitedList(indexes.map((index) => `${prefix}${index + 1}`))
}

function formatPairList(pairs: Array<[number, number]>, prefix: string): string {
  return formatLimitedList(pairs.map(([first, second]) => `${prefix}${first + 1}-${prefix}${second + 1}`))
}

function formatRoomList(rooms: Room2D[], indexes: number[]): string {
  return formatLimitedList(indexes.map((index) => {
    const room = rooms[index]
    return room?.label?.trim() || `Room ${index + 1}`
  }))
}

function formatDeviceList(labels: ValidationLabels, devices: SecurityDevice[], indexes: number[]): string {
  return formatLimitedList(indexes.map((index) => getDeviceDisplayName(labels, devices[index], index)))
}

function formatDevicePairList(labels: ValidationLabels, devices: SecurityDevice[], pairs: Array<[number, number]>): string {
  return formatLimitedList(pairs.map(([first, second]) => `${getDeviceDisplayName(labels, devices[first], first)} / ${getDeviceDisplayName(labels, devices[second], second)}`))
}

function getDeviceDisplayName(labels: ValidationLabels, device: SecurityDevice | undefined, index: number): string {
  if (!device) return `Device ${index + 1}`
  const name = device.name.trim()
  return name.length > 0 ? name : `${labels.deviceTypes[device.device_type]} ${index + 1}`
}

function formatAnchorList(anchors: AnchorPoint[], indexes: number[]): string {
  return formatLimitedList(indexes.map((index) => anchors[index]?.label || `Anchor ${index + 1}`))
}

function formatLimitedList(items: string[], limit = 4): string {
  const visible = items.slice(0, limit).join(', ')
  const hidden = items.length - limit
  return hidden > 0 ? `${visible} +${hidden}` : visible
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatMeters(value: number): string {
  return `${value.toFixed(value < 10 ? 2 : 1)} m`
}

export function ValidationPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const validation = useValidation(labels)
  const [selectedCategoryId, setSelectedCategoryId] = useState<ValidationCategoryId>('geometry')
  const selectedCategory = validation.categories.find((category) => category.id === selectedCategoryId) ?? validation.categories[0]!

  return (
    <section className="page-grid spatial-page validation-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <section className={`validation-hero ${validation.status}`}>
        <div className="validation-hero-copy">
          <span className="eyebrow-muted">{labels.dashboard}</span>
          <h2>{labels.overall}</h2>
          <p>{labels.liveAudit}</p>
          <div className="validation-status-legend" aria-label={labels.score}>
            <span className="pass">Emerald</span>
            <span className="warning">Amber</span>
            <span className="error">Ruby</span>
          </div>
        </div>

        <div className="validation-gauge-shell">
          <div
            aria-label={`${labels.score}: ${validation.score}%`}
            className={`validation-gauge ${validation.status}`}
            role="img"
            style={{ ['--score' as string]: `${validation.score}%` }}
          >
            <div className="validation-gauge-core">
              <strong>{validation.score}%</strong>
              <span>{labels.statuses[validation.status]}</span>
            </div>
          </div>
        </div>

        <div className="validation-hero-actions">
          <Link className="btn btn-primary" to="/editor">{labels.openEditor}</Link>
          <Link className="btn btn-secondary" to="/dashboard">{labels.openDashboard}</Link>
        </div>
      </section>

      <section className="validation-stat-grid" aria-label={labels.overall}>
        <article className="validation-stat-card">
          <span>{labels.checks}</span>
          <strong>{validation.checkCount}</strong>
          <small>{validation.passedCount}/{validation.categories.length} {labels.passed}</small>
        </article>
        <article className="validation-stat-card">
          <span>{labels.issueCount}</span>
          <strong>{validation.issueCount}</strong>
          <small>{validation.issueCount === 0 ? labels.passed : labels.review}</small>
        </article>
        <article className="validation-stat-card warning">
          <span>{labels.warnings}</span>
          <strong>{validation.warningCount}</strong>
          <small>{labels.statuses.warning}</small>
        </article>
        <article className="validation-stat-card error">
          <span>{labels.errors}</span>
          <strong>{validation.errorCount}</strong>
          <small>{labels.statuses.error}</small>
        </article>
      </section>

      <div className="validation-dashboard-layout">
        <section className="validation-category-grid" aria-label={labels.dashboard}>
          {validation.categories.map((category) => (
            <button
              key={category.id}
              aria-pressed={selectedCategory.id === category.id}
              className={`validation-category-card ${category.status} ${selectedCategory.id === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategoryId(category.id)}
              type="button"
            >
              <span className="validation-card-kicker">{category.title}</span>
              <strong>{category.score}%</strong>
              <em>{labels.statuses[category.status]}</em>
              <p>{category.summary}</p>
              <span className="validation-card-footer">
                <span>{category.checks} {labels.checks}</span>
                <span>{category.issues.length} {labels.issues}</span>
              </span>
            </button>
          ))}
        </section>

        <aside className={`validation-detail-panel ${selectedCategory.status}`}>
          <div className="validation-detail-header">
            <div>
              <span className="eyebrow-muted">{labels.detail}</span>
              <h3>{selectedCategory.title}</h3>
            </div>
            <span className={`validation-status-pill ${selectedCategory.status}`}>{labels.statuses[selectedCategory.status]}</span>
          </div>

          <p className="validation-detail-summary">{selectedCategory.summary}</p>

          <div className="validation-metric-grid">
            {selectedCategory.metrics.map((metric) => (
              <div key={`${selectedCategory.id}-${metric.label}`} className={metric.tone ? `validation-metric ${metric.tone}` : 'validation-metric'}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <div className="validation-issue-header">
            <span>{labels.issues}</span>
            <small>{labels.issueIntro}</small>
          </div>

          {selectedCategory.issues.length === 0 ? (
            <div className="validation-empty-detail">
              <strong>{labels.statuses.pass}</strong>
              <p>{labels.noIssues}</p>
            </div>
          ) : (
            <div className="validation-issue-list">
              {selectedCategory.issues.map((issue) => (
                <article key={issue.id} className={`validation-issue ${issue.severity}`}>
                  <span>{issue.severity === 'error' ? 'ERR' : 'WARN'}</span>
                  <div>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
