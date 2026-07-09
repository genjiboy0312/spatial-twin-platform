import { create } from 'zustand'
import type { Wgs84Point } from '../utils/coordinateTransform'
import {
  computeHelmertTransformation,
  computeAlignmentQuality,
  localToWgs84Helmert,
  wgs84ToLocalHelmert,
  formatAlignmentParams,
  getBuildingOriginFromAnchors,
  type AnchorPoint,
  type HelmertParams,
  type AlignmentResult,
} from '../utils/alignmentUtils'

export type AlignmentStep = 'place' | 'coords' | 'review' | 'done'

type State = {
  // Step tracking
  step: AlignmentStep

  // Anchor points
  anchors: AnchorPoint[]

  // Computed parameters
  params: HelmertParams | null
  result: AlignmentResult | null

  // Validation
  isApplied: boolean

  // Map dialog
  mapOpen: boolean

  // Active anchor being placed or edited
  activeAnchorId: string | null
}

type Actions = {
  setStep: (step: AlignmentStep) => void

  // Anchor management
  startPlacingAnchor: (localX: number, localY: number) => void
  upsertAnchorAt: (index: number, localX: number, localY: number, longitude: number, latitude: number, label: string) => void
  setAnchorCoords: (id: string, longitude: number, latitude: number) => void
  setAnchorLabel: (id: string, label: string) => void
  removeAnchor: (id: string) => void
  clearAnchors: () => void

  // Map dialog
  openMap: (anchorId: string) => void
  closeMap: () => void

  // Transformation
  compute: () => void
  applyAlignment: () => void
  resetAlignment: () => void

  // Convert
  localToWgs84: (x: number, y: number) => Wgs84Point | null
  wgs84ToLocal: (lon: number, lat: number) => { x: number; y: number } | null

  // Summary
  getSummary: () => string
}

let nextId = 1
function genId() {
  return `ap_${nextId++}`
}

export const useAlignmentStore = create<State & Actions>((set, get) => ({
  step: 'place',
  anchors: [],
  params: null,
  result: null,
  isApplied: false,
  mapOpen: false,
  activeAnchorId: null,

  setStep: (step) => set({ step }),

  startPlacingAnchor: (localX, localY) => {
    const id = genId()
    set((s) => ({
      anchors: [...s.anchors, { id, localX, localY, longitude: 0, latitude: 0, label: `Anchor ${s.anchors.length + 1}` }],
      activeAnchorId: id,
      params: null,
      result: null,
    }))
  },

  upsertAnchorAt: (index, localX, localY, longitude, latitude, label) => {
    set((s) => {
      const nextAnchors = [...s.anchors]
      while (nextAnchors.length <= index) {
        nextAnchors.push({
          id: genId(),
          localX: 0,
          localY: 0,
          longitude: 0,
          latitude: 0,
          label: `Anchor ${nextAnchors.length + 1}`,
        })
      }
      nextAnchors[index] = {
        ...nextAnchors[index]!,
        localX,
        localY,
        longitude,
        latitude,
        label,
      }
      return {
        anchors: nextAnchors,
        activeAnchorId: nextAnchors[index]!.id,
        params: null,
        result: null,
        isApplied: false,
      }
    })
  },

  setAnchorCoords: (id, longitude, latitude) => {
    set((s) => ({
      anchors: s.anchors.map((a) => (a.id === id ? { ...a, longitude, latitude } : a)),
      params: null,
      result: null,
    }))
  },

  setAnchorLabel: (id, label) => {
    set((s) => ({
      anchors: s.anchors.map((a) => (a.id === id ? { ...a, label } : a)),
    }))
  },

  removeAnchor: (id) => {
    set((s) => ({
      anchors: s.anchors.filter((a) => a.id !== id),
      activeAnchorId: s.activeAnchorId === id ? null : s.activeAnchorId,
      params: null,
      result: null,
    }))
  },

  clearAnchors: () =>
    set({ anchors: [], params: null, result: null, isApplied: false, step: 'place', activeAnchorId: null }),

  openMap: (anchorId) => set({ mapOpen: true, activeAnchorId: anchorId }),
  closeMap: () => set({ mapOpen: false }),

  compute: () => {
    const { anchors } = get()
    if (anchors.length < 2) return
    const params = computeHelmertTransformation(anchors)
    if (!params) return
    const result = computeAlignmentQuality(anchors, params)
    set({ params, result, step: 'review' })
  },

  applyAlignment: () => {
    const { params } = get()
    if (!params) return
    set({ isApplied: true, step: 'done' })
  },

  resetAlignment: () =>
    set({ params: null, result: null, isApplied: false, step: 'place' }),

  localToWgs84: (x, y) => {
    const { params, anchors } = get()
    if (params) {
      return localToWgs84Helmert({ x, y }, params)
    }
    // Fallback: use simple origin from anchor centroids
    const origin = getBuildingOriginFromAnchors(anchors)
    if (!origin) return null
    return { longitude: origin.longitude + (x / 111_320) / Math.cos((origin.latitude * Math.PI) / 180), latitude: origin.latitude + y / 111_320 }
  },

  wgs84ToLocal: (lon, lat) => {
    const { params, anchors } = get()
    if (params) {
      return wgs84ToLocalHelmert({ longitude: lon, latitude: lat }, params)
    }
    const origin = getBuildingOriginFromAnchors(anchors)
    if (!origin) return null
    const latScale = Math.cos((origin.latitude * Math.PI) / 180)
    return { x: (lon - origin.longitude) * 111_320 * latScale, y: (lat - origin.latitude) * 111_320 }
  },

  getSummary: () => {
    const { result, params, anchors, step, isApplied } = get()
    const lines: string[] = [`Anchors: ${anchors.length}`]
    if (params) lines.push(formatAlignmentParams(params))
    if (result) {
      lines.push(`RMS Error: ${result.rmsErrorMeters.toFixed(3)} m`)
      if (result.residuals.length > 0) {
        const maxResidual = Math.max(...result.residuals.map((r) => r.residualMeters))
        lines.push(`Max Residual: ${maxResidual.toFixed(3)} m`)
      }
    }
    lines.push(`Step: ${step} | ${isApplied ? 'Applied' : 'Not applied'}`)
    return lines.join('\n')
  },
}))
