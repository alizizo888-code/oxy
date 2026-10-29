import { useMemo } from 'react'
import { useLiveShared } from '../lib/useLive'
import { SHOWCASE } from '../serviceShowcase'
import { artFor } from '../lib/specialtyArt'

// Merge: owner-uploaded library (ac_media rows tagged with a specialty) → curated photos → built-in artwork.
export function useSpecialtyImages(id) {
  const { data: media } = useLiveShared('ac_media', { limit: 500 })
  return useMemo(() => {
    const own = (media || [])
      .filter((m) => (m.specialty || 'ac') === id && m.url)
      .sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99))
      .map((m) => ({ url: m.url, by: null }))
    const base = SHOWCASE[id]?.images || []
    return [...own, ...base, ...artFor(id)]
  }, [media, id])
}
