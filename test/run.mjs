import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = process.env.UNO_BACKEND_DIR || resolve(root, '../unour')
let directory, server

function exited(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
}
async function origin() {
  if (process.env.UNO_TEST_ORIGIN) return process.env.UNO_TEST_ORIGIN
  directory = await mkdtemp(join(tmpdir(), 'unour-web-test-'))
  const binary = join(directory, 'uno-server')
  const build = spawn(
    'go',
    ['build', '-buildvcs=false', '-o', binary, './cmd/server'],
    { cwd: backend, stdio: 'inherit' },
  )
  if (await exited(build))
    throw new Error(
      '无法构建真实 Go 后端；可通过 UNO_BACKEND_DIR 指定后端目录。',
    )
  server = spawn(binary, [], {
    cwd: backend,
    env: {
      ...process.env,
      UNO_ADDR: '127.0.0.1:0',
      UNO_DB_PATH: join(directory, 'test.db'),
      UNO_ALLOWED_ORIGINS: 'http://localhost:5173',
      UNO_SECURE_COOKIES: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    const lines = createInterface({ input: server.stdout })
    const timeout = setTimeout(
      () => reject(new Error('真实后端启动超时。')),
      10000,
    )
    server.once('error', reject)
    server.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`真实后端提前退出：${code}`))
    })
    server.stderr.on('data', (bytes) => process.stderr.write(bytes))
    lines.on('line', (line) => {
      try {
        const entry = JSON.parse(line)
        if (entry.msg === 'UNO server listening' && entry.address) {
          clearTimeout(timeout)
          resolve(`http://${entry.address}`)
        }
      } catch {
        /* Ignore non-JSON startup output. */
      }
    })
  })
}
try {
  const target = await origin()
  console.log(`使用真实 Go 后端：${target}`)
  const tests = spawn(
    process.execPath,
    [
      join(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      ...process.argv.slice(2),
    ],
    {
      cwd: root,
      env: { ...process.env, UNO_TEST_ORIGIN: target },
      stdio: 'inherit',
    },
  )
  const forward = () => tests.kill('SIGTERM')
  process.once('SIGINT', forward)
  process.once('SIGTERM', forward)
  process.exitCode = await exited(tests)
  process.removeListener('SIGINT', forward)
  process.removeListener('SIGTERM', forward)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (server && server.exitCode === null) {
    const done = exited(server)
    server.kill('SIGTERM')
    const force = setTimeout(() => server.kill('SIGKILL'), 5000)
    await done
    clearTimeout(force)
  }
  if (directory) await rm(directory, { recursive: true, force: true })
}
