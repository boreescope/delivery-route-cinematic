import polyline from '@mapbox/polyline'

const OSRM_BASE = 'http://localhost:5001/route/v1/driving'

export interface RouteResult {
  coords: [number, number][] // [lat, lon][]
  dist: number // meters
}

// Route cache (key = "slat,slon,dlat,dlon")
const routeCache: Record<string, RouteResult> = {}

/**
 * OSRM 라우팅 API 호출 + 캐시 + 3회 재시도
 * delivery_viewer.html의 getRoute 패턴 포팅
 */
export async function getRoute(
  shopLat: number,
  shopLon: number,
  dlvryLat: number,
  dlvryLon: number
): Promise<RouteResult | null> {
  const key = `${shopLat},${shopLon},${dlvryLat},${dlvryLon}`
  if (routeCache[key]) {
    return JSON.parse(JSON.stringify(routeCache[key]))
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = `${OSRM_BASE}/${shopLon},${shopLat};${dlvryLon},${dlvryLat}?overview=full&geometries=polyline`
      const r = await fetch(url)
      const j = await r.json()
      if (j.code === 'Ok') {
        const decoded = polyline.decode(j.routes[0].geometry)
        const result: RouteResult = {
          coords: decoded.map((c: number[]) => [c[0], c[1]] as [number, number]),
          dist: j.routes[0].distance,
        }
        routeCache[key] = result
        return JSON.parse(JSON.stringify(result))
      }
    } catch (e) {
      console.warn(`OSRM retry ${attempt + 1}/3:`, e)
    }
    await new Promise((ok) => setTimeout(ok, 500 * (attempt + 1)))
  }
  return null
}

/** 캐시 초기화 */
export function clearRouteCache(): void {
  Object.keys(routeCache).forEach((k) => delete routeCache[k])
}
