export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES = 2 * 1024 * 1024

// Kiểm tra loại/dung lượng rồi thu nhỏ ảnh (mock lưu trong trình duyệt nên cần nhẹ).
// Backend thật nhận file gốc (multipart) và lưu object storage.
export async function prepareImage(file, maxSide = 800, quality = 0.7) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`"${file.name}": chỉ nhận ảnh JPG, PNG hoặc WEBP.`)
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" vượt quá 2 MB.`)
  let bitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error(`Không đọc được ảnh "${file.name}".`) }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { name: file.name, mime: 'image/jpeg', size: file.size, dataUrl: canvas.toDataURL('image/jpeg', quality) }
}
