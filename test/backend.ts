import { beforeAll } from 'vitest'
import process from 'node:process'

beforeAll(async () => {
  const origin = process.env.UNO_TEST_ORIGIN || 'http://127.0.0.1:8088'
  try {
    const response = await fetch(`${origin}/healthz`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch {
    throw new Error(
      `测试必须连接真实后端。请先在 Go 项目执行 make run（${origin}），再运行 npm test。`,
    )
  }
})
