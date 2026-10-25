import { afterAll, beforeAll } from 'vitest'
import process from 'node:process'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

let server: ChildProcess | undefined, directory: string | undefined
const stopOnExit = () => {
  server?.kill('SIGTERM')
}
async function cleanup() {
  process.removeListener('exit', stopOnExit)
  if (server && server.exitCode === null && server.signalCode === null) {
    const done = new Promise<void>((resolve) =>
      server!.once('exit', () => resolve()),
    )
    server.kill('SIGTERM')
    const force = setTimeout(() => server?.kill('SIGKILL'), 5000)
    await done
    clearTimeout(force)
  }
  if (directory) await rm(directory, { recursive: true, force: true })
}
afterAll(cleanup)

// The production rate limiter remains enabled. Isolate files instead of sharing
// authentication budgets, room data, bot jobs or administrator sessions.
if (process.env.UNO_TEST_SERVER_RUNTIME) {
  const runtime = JSON.parse(process.env.UNO_TEST_SERVER_RUNTIME) as {
    binary: string
    backend: string
    adminConfig: string
    rulesDirectory: string
  }
  directory = await mkdtemp(join(tmpdir(), 'unour-web-case-'))
  process.once('exit', stopOnExit)
  server = spawn(runtime.binary, [], {
    cwd: runtime.backend,
    env: {
      ...process.env,
      UNO_ADDR: '127.0.0.1:0',
      UNO_DB_PATH: join(directory, 'test.db'),
      UNO_ALLOWED_ORIGINS: 'http://localhost:5173',
      UNO_SECURE_COOKIES: 'false',
      UNO_ADMIN_CONFIG: runtime.adminConfig,
      UNO_RULES_DIR: runtime.rulesDirectory,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    process.env.UNO_TEST_ORIGIN = await new Promise<string>(
      (resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('真实后端启动超时。')),
          10000,
        )
        const fail = (error: Error) => {
          clearTimeout(timeout)
          reject(error)
        }
        server!.once('error', fail)
        server!.once('exit', (code) =>
          fail(new Error(`真实后端提前退出：${code}`)),
        )
        server!.stderr!.on('data', (bytes) => process.stderr.write(bytes))
        const lines = createInterface({ input: server!.stdout! })
        lines.on('line', (line) => {
          try {
            const entry = JSON.parse(line)
            if (entry.msg === 'UNO server listening' && entry.address) {
              clearTimeout(timeout)
              resolve(`http://${entry.address}`)
            }
          } catch {
            /* Server diagnostics are not test fixtures. */
          }
        })
      },
    )
  } catch (error) {
    await cleanup()
    throw error
  }
}

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
