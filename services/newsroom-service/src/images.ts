// Chọn ảnh bìa cho bài do Toà soạn Agent AI tự viết.
//
// Nguồn ảnh gắn với CHI PHÍ 0: Pexels API miễn phí (cần một API key miễn phí).
// KHÔNG có key ⇒ no-op (trả null) - Toà soạn vẫn xuất bản bình thường, chỉ không
// có ảnh bìa. Đây là chọn CÓ CHỦ ĐÍCH: không để việc thiếu ảnh chặn dây chuyền
// xuất bản, và không nhúng nguồn ảnh trả phí.
//
// Pexels ĐÒI ghi công tác giả; ta đưa dòng ghi công vào "Nguồn tham khảo" của bài.

export type PickedImage = { url: string; credit: string; sourceUrl: string } | null

interface PexelsPhoto {
  url?: string
  photographer?: string
  src?: { large?: string; landscape?: string; original?: string }
}

/**
 * Trả ảnh bìa hợp chủ đề `query` (thường là tiêu đề + vài thẻ), hoặc null nếu
 * chưa cấu hình nguồn ảnh / không tìm được / lỗi mạng. FAIL-OPEN: mọi lỗi đều
 * nuốt về null để không làm hỏng lượt xuất bản.
 */
export async function pickCoverImage(query: string): Promise<PickedImage> {
  const key = process.env.PEXELS_API_KEY
  const q = query.trim()
  if (!key || !q) return null
  try {
    const url =
      `https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=` +
      encodeURIComponent(q)
    const res = await fetch(url, { headers: { Authorization: key } })
    if (!res.ok) return null
    const data = (await res.json()) as { photos?: PexelsPhoto[] }
    const photo = data?.photos?.[0]
    const src = photo?.src?.landscape || photo?.src?.large || photo?.src?.original
    if (!photo || !src) return null
    return {
      url: src,
      credit: `Ảnh: ${photo.photographer || 'Pexels'} (Pexels)`,
      sourceUrl: photo.url || 'https://www.pexels.com',
    }
  } catch {
    return null
  }
}
