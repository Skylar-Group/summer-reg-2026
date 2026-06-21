import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

// 暑期報名資料庫：每一筆報名都是一個獨立的 blob，鍵為伺服器產生的唯一 ID。
// 同一名學生重複報名亦各自獨立存放，永不互相覆蓋或合併，徹底取代舊有「同名覆蓋」的雲端試算表 +
// 瀏覽器本機備份做法。所有欄位（A/B 堂數、上課日期、特選課堂、Part C、折扣、備註）完整保存於伺服器，
// 老師在任何裝置開啟後台都能看到一致而完整的資料。
const STORE_NAME = 'summer-reg-2026'

function regStore() {
  // 強一致性：報名提交或老師修改後，下一次讀取即時反映，避免「入咗又唔見」。
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

function newId(): string {
  // 伺服器產生的唯一識別，確保每次提交都是一筆獨立紀錄。
  return 'reg_' + crypto.randomUUID()
}

export default async (req: Request, context: Context) => {
  const store = regStore()

  // 讀取全部報名紀錄（後台名冊、統計、點名日曆共用）。
  if (req.method === 'GET') {
    const { blobs } = await store.list()
    const records = await Promise.all(
      blobs.map(async (b) => {
        const rec = (await store.get(b.key, { type: 'json' })) as Record<string, unknown> | null
        return rec ? { ...rec, id: b.key } : null
      }),
    )
    return Response.json(records.filter(Boolean))
  }

  if (req.method === 'POST') {
    let body: any
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: '請求格式錯誤' }, { status: 400 })
    }

    const action = String(body.action || 'create')

    // 新增報名：每筆獨立留底，不與任何同名舊紀錄合併。
    if (action === 'create') {
      const id = newId()
      const record = {
        ...(body.record || {}),
        id,
        createdAt: new Date().toISOString(),
      }
      await store.setJSON(id, record)
      return Response.json({ ok: true, id })
    }

    // 修改單一報名（折扣／備註／特選／調堂）：只針對該 ID，不影響其他同名紀錄。
    if (action === 'update') {
      const id = String(body.id || '')
      if (!id) return Response.json({ error: '缺少紀錄 ID' }, { status: 400 })
      const existing = (await store.get(id, { type: 'json' })) as Record<string, unknown> | null
      if (!existing) return Response.json({ error: '找不到該筆紀錄' }, { status: 404 })
      const updated = { ...existing, ...(body.patch || {}), id }
      await store.setJSON(id, updated)
      return Response.json({ ok: true, id })
    }

    // 刪除單一報名：只刪該 ID 一筆，由老師決定保留或刪除哪一筆。
    if (action === 'delete') {
      const id = String(body.id || '')
      if (!id) return Response.json({ error: '缺少紀錄 ID' }, { status: 400 })
      await store.delete(id)
      return Response.json({ ok: true, id })
    }

    return Response.json({ error: '未知操作' }, { status: 400 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = {
  path: '/api/registrations',
}
