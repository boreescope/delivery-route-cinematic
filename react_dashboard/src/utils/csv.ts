import type { DeliveryRecord } from '../types'

// Column name patterns for auto-detection
const LAT_PATTERNS = ['lat', 'latitude', 'y']
const LON_PATTERNS = ['lon', 'lng', 'longitude', 'x']

function detectColumn(headers: string[], patterns: string[], prefix?: string): string | null {
  const candidates = headers.filter((h) => {
    const lower = h.toLowerCase()
    if (prefix && !lower.includes(prefix)) return false
    return patterns.some((p) => lower.includes(p))
  })
  return candidates[0] ?? null
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function parseCSV(text: string): DeliveryRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])

  // Auto-detect columns
  const shopLatCol = detectColumn(headers, LAT_PATTERNS, 'shop') ?? detectColumn(headers, ['shop_lat'])
  const shopLonCol = detectColumn(headers, LON_PATTERNS, 'shop') ?? detectColumn(headers, ['shop_lon'])
  const dlvryLatCol = detectColumn(headers, LAT_PATTERNS, 'dlvry') ?? detectColumn(headers, ['dlvry_lat'])
  const dlvryLonCol = detectColumn(headers, LON_PATTERNS, 'dlvry') ?? detectColumn(headers, ['dlvry_lon'])

  const ordCol = headers.find((h) => h.toLowerCase().includes('ord')) ?? headers[0]
  const pickUpCol = headers.find((h) => h.toLowerCase().includes('pick_up')) ?? null
  const handOverCol = headers.find((h) => h.toLowerCase().includes('hand_over')) ?? null

  if (!shopLatCol || !shopLonCol || !dlvryLatCol || !dlvryLonCol) {
    console.warn('Could not detect lat/lon columns. Headers:', headers)
    return []
  }

  const getIdx = (col: string | null) => (col ? headers.indexOf(col) : -1)
  const idxShopLat = getIdx(shopLatCol)
  const idxShopLon = getIdx(shopLonCol)
  const idxDlvryLat = getIdx(dlvryLatCol)
  const idxDlvryLon = getIdx(dlvryLonCol)
  const idxOrd = getIdx(ordCol)
  const idxPickUp = getIdx(pickUpCol)
  const idxHandOver = getIdx(handOverCol)

  const records: DeliveryRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length < headers.length) continue

    const shopLat = parseFloat(values[idxShopLat])
    const shopLon = parseFloat(values[idxShopLon])
    const dlvryLat = parseFloat(values[idxDlvryLat])
    const dlvryLon = parseFloat(values[idxDlvryLon])

    if (isNaN(shopLat) || isNaN(shopLon) || isNaN(dlvryLat) || isNaN(dlvryLon)) continue

    records.push({
      ord_no: values[idxOrd] ?? `ORD-${i}`,
      shop_lat: shopLat,
      shop_lon: shopLon,
      dlvry_lat: dlvryLat,
      dlvry_lon: dlvryLon,
      pick_up_date: idxPickUp >= 0 ? values[idxPickUp] : '',
      hand_over_date: idxHandOver >= 0 ? values[idxHandOver] : '',
    })
  }

  return records
}
