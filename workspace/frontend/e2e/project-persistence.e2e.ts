import { expect, test, type Page } from '@playwright/test'

const building = {
  id: 1001,
  name: 'E2E Tower',
  address: 'Persistence Avenue',
  total_floors: 1,
  origin_longitude: 127.037095,
  origin_latitude: 37.4624131,
}

const floor = {
  id: 2001,
  building_id: building.id,
  floor_number: 1,
  floor_name: '1F Operations',
  height_meters: 3,
  input_type: 'dxf',
}

const uploads = [
  {
    id: 3001,
    filename: 'floor-ops.dxf',
    source_type: 'dxf',
    building_id: building.id,
    floor_id: floor.id,
    status: 'ready',
    message: null,
    file_url: '/uploads/floor-ops.dxf',
    pointcloud_preview_url: null,
    created_at: '2026-07-13T00:00:00Z',
  },
  {
    id: 3002,
    filename: 'scan-ops.las',
    source_type: 'pointcloud',
    building_id: building.id,
    floor_id: floor.id,
    status: 'preview_ready',
    message: null,
    file_url: '/uploads/scan-ops.las',
    pointcloud_preview_url: '/api/pointcloud/preview/3002',
    created_at: '2026-07-13T00:00:00Z',
  },
]

const projectAssets = [
  {
    id: 4001,
    building_id: building.id,
    floor_id: floor.id,
    upload_asset_id: uploads[0].id,
    asset_type: 'dxf',
    name: 'Floor Ops DXF',
    status: 'ready',
    file_uri: '/uploads/floor-ops.dxf',
    metadata: { unit: 'meter' },
    created_at: '2026-07-13T00:00:00Z',
    updated_at: '2026-07-13T00:00:00Z',
  },
]

const objectPlacements = [
  {
    id: 5001,
    building_id: building.id,
    floor_id: floor.id,
    source_asset_id: null,
    object_type: 'security_device',
    name: 'Lobby Camera',
    position_x: 2,
    position_y: 0,
    position_z: 3,
    rotation_x: 0,
    rotation_y: 30,
    rotation_z: 0,
    scale_x: 1,
    scale_y: 1,
    scale_z: 1,
    status: 'active',
    metadata: { editor_source: 'editor-device', editor_id: 'camera-e2e', device_type: 'camera' },
    created_at: '2026-07-13T00:00:00Z',
    updated_at: '2026-07-13T00:00:00Z',
  },
]

const geometry = {
  floor_id: floor.id,
  walls: [
    { id: 6001, floor_id: floor.id, x1: 0, y1: 0, x2: 8, y2: 0 },
    { id: 6002, floor_id: floor.id, x1: 8, y1: 0, x2: 8, y2: 6 },
  ],
  rooms: [
    { id: 7001, floor_id: floor.id, name: 'Lobby', x: 0, y: 0, w: 8, h: 6 },
  ],
}

const snapshot = {
  building_id: building.id,
  version: 1,
  saved: true,
  updated_at: '2026-07-13T00:00:00Z',
  state: {
    alignment: {
      selectedFloorId: floor.id,
      alignmentMethod: 'osm',
      selectedPointCloudId: uploads[1].id,
      buildingOrigin: [37.4624131, 127.037095],
      alignmentMatrix: [[1, 0, 127.037095], [0, 1, 37.4624131]],
      alignmentRmse: 0.25,
      alignLocalPoints: {
        origin: [0, 0, 0],
        point1: [8, 0, 0],
        point2: [0, 0, 6],
        display: [2, 0, 2],
      },
      alignGpsInputs: {
        originLat: '37.4624131',
        originLng: '127.037095',
        point1Lat: '37.4624210',
        point1Lng: '127.037180',
        point2Lat: '37.462500',
        point2Lng: '127.037100',
      },
    },
  },
}

async function mockProjectApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/api/buildings') {
      await route.fulfill({ json: [building] })
      return
    }

    if (path === `/api/buildings/${building.id}/project-summary`) {
      await route.fulfill({
        json: {
          building_id: building.id,
          floor_count: 1,
          upload_count: uploads.length,
          source_count: 1,
          pointcloud_count: 1,
          project_asset_count: 1,
          object_count: objectPlacements.length,
          device_count: 1,
          wall_count: geometry.walls.length,
          room_count: geometry.rooms.length,
          geometry_count: geometry.walls.length + geometry.rooms.length,
          alignment_applied: true,
          anchor_count: 3,
          asset_counts: { dxf: 1, pointcloud: 1, object: 1, security_device: 1 },
        },
      })
      return
    }

    if (path === `/api/buildings/${building.id}/project-data`) {
      await route.fulfill({
        json: {
          building,
          floors: [floor],
          uploads,
          project_assets: projectAssets,
          object_placements: objectPlacements,
          security_devices: [],
          asset_counts: { dxf: 1, pointcloud: 1, object: 1, security_device: 1 },
        },
      })
      return
    }

    if (path === `/api/buildings/${building.id}/project-snapshot`) {
      await route.fulfill({ json: snapshot })
      return
    }

    if (path === `/api/buildings/${building.id}/floors`) {
      await route.fulfill({ json: [floor] })
      return
    }

    if (path === `/api/floors/${floor.id}/geometry`) {
      await route.fulfill({ json: geometry })
      return
    }

    if (path === `/api/uploads/by-building/${building.id}`) {
      await route.fulfill({ json: uploads })
      return
    }

    if (path === `/api/buildings/${building.id}/map-settings`) {
      await route.fulfill({
        json: {
          building_id: building.id,
          origin_latitude: 37.4624131,
          origin_longitude: 127.037095,
          osm_zoom: 18,
          osm_scale: 1,
          osm_opacity: 0.9,
          saved: true,
          updated_at: '2026-07-13T00:00:00Z',
        },
      })
      return
    }

    if (path === '/api/osm-tiles/status') {
      await route.fulfill({
        json: { provider: 'mock-osm', cache_enabled: true, fallback_enabled: true },
      })
      return
    }

    if (path === `/api/gps-alignment/buildings/${building.id}/audit-logs`) {
      await route.fulfill({ json: [] })
      return
    }

    if (path === '/api/exports/package') {
      await route.fulfill({
        json: {
          walls: geometry.walls,
          rooms: geometry.rooms,
          devices: objectPlacements,
          summary: { walls: geometry.walls.length, rooms: geometry.rooms.length, devices: 1 },
        },
      })
      return
    }

    await route.fulfill({ json: {} })
  })
}

test.describe('persisted spatial twin workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockProjectApi(page)
  })

  test('saved project data is visible across operations pages', async ({ page, context }) => {
    await page.goto('/dashboard')
    await expect(
      page.getByRole('link', { name: /E2E Tower.*geometry: 3.*devices: 1/ }),
    ).toBeVisible()

    await page.goto('/models')
    await expect(page.getByLabel('Select a building')).toHaveValue(String(building.id))
    await expect(page.getByRole('main').getByText('scan-ops.las').first()).toBeVisible()

    await page.goto('/devices')
    await expect(page.getByText('Lobby Camera')).toBeVisible()

    await page.goto('/export')
    await expect(page.getByLabel('Export project')).toHaveValue(String(building.id))
    await expect(page.getByText('2 walls')).toBeVisible()

    await page.goto('/alignment')
    await page.getByRole('button', { name: /Point Cloud \+ OSM/ }).click()
    await expect(page.getByRole('main').locator('strong').filter({ hasText: 'scan-ops.las' })).toBeVisible()
    await page.close()
    await context.close()
  })
})
