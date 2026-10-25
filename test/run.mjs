import { spawn } from 'node:child_process'
import { mkdtemp, rm, cp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = process.env.UNO_BACKEND_DIR || resolve(root, '../unour')
let directory, runtime
let adminPassword = process.env.UNO_TEST_ADMIN_PASSWORD || ''

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
  adminPassword = randomBytes(24).toString('base64url')
  const adminConfig = join(directory, 'admin.json')
  const configure = spawn(
    'go',
    ['run', '-buildvcs=false', './cmd/admin-config', '-out', adminConfig],
    { cwd: backend, stdio: ['pipe', 'ignore', 'inherit'] },
  )
  configure.stdin.end(adminPassword)
  if (await exited(configure))
    throw new Error('无法创建隔离的管理后台测试配置。')
  const rulesDirectory = join(directory, 'rules')
  await cp(join(backend, 'rules'), rulesDirectory, { recursive: true })
  await writeFile(
    join(rulesDirectory, 'test_extension.json'),
    JSON.stringify({
      name: 'extension_from_file',
      version: 1,
      order: 100,
      title: '配置扩展规则',
      group: '测试扩展',
      default_enabled: false,
      options: [
        {
          key: 'block_play',
          type: 'boolean',
          label: '暂停出牌',
          default: true,
        },
      ],
      steps: [
        {
          when: 'action == "play" && options.block_play',
          reject: '配置暂时禁止出牌。',
        },
      ],
      summary: [{ text: '由新增配置文件控制出牌。' }],
    }),
  )
  runtime = { binary, backend, adminConfig, rulesDirectory }
  return ''
}
try {
  const target = await origin()
  console.log(
    target
      ? `使用真实 Go 后端：${target}`
      : '每个测试文件使用独立真实 Go 后端与临时 SQLite。',
  )
  const tests = spawn(
    process.execPath,
    [
      join(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      ...process.argv.slice(2),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        UNO_TEST_ORIGIN: target,
        UNO_TEST_ADMIN_PASSWORD: adminPassword,
        UNO_TEST_RULE_EXTENSION: runtime ? '1' : '',
        UNO_TEST_SERVER_RUNTIME: runtime ? JSON.stringify(runtime) : '',
      },
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
  if (directory) await rm(directory, { recursive: true, force: true })
}
