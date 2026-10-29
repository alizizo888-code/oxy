import { upload } from './_api'
export const storage = {
  async upload(file, name) {
    const f = new FormData()
    f.append('file', file, name || file.name || 'file')
    const r = await upload('/upload', f)
    return { url: r.url }
  },
}
