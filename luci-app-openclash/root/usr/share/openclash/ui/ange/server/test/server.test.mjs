import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ange-clashboard-test-'))
const dbPath = path.join(tempDir, 'zashboard.sqlite')

process.env.ZASHBOARD_DB_PATH = dbPath
delete process.env.ZASHBOARD_OPENWRT_SSH_HOST
delete process.env.ZASHBOARD_OPENWRT_SSH_PORT
delete process.env.ZASHBOARD_OPENWRT_SSH_USER
delete process.env.ZASHBOARD_OPENWRT_SSH_USERNAME
delete process.env.ZASHBOARD_OPENWRT_SSH_PASSWORD
delete process.env.ZASHBOARD_RULE_SOURCE_PLUGIN

const serverModuleUrl = new URL(`./../index.mjs?test=${Date.now()}`, import.meta.url)
const {
  createAccessSessionTokenForTesting,
  extractNikkiYamlConfigPathsFromProcessListForTesting,
  extractRemoteYamlConfigPathsFromTextForTesting,
  extractRemoteYamlConfigPathsFromUciForTesting,
  getRequestAccessAuthStatusForTesting,
  replaceSnapshot,
  resolveOpenClashConfigPathFromUciForTesting,
  searchRuleProviderCache,
  seedRuleProviderCacheForTesting,
  shutdownServer,
} = await import(serverModuleUrl.href)

after(async () => {
  await shutdownServer().catch(() => {})
  await fs.rm(tempDir, { recursive: true, force: true })
})

test('service auth state is enforced from persisted settings', () => {
  replaceSnapshot({
    'config/access-password-enabled': 'true',
    'config/access-password': 'test-secret',
  })

  assert.deepEqual(
    getRequestAccessAuthStatusForTesting({
      headers: {},
    }),
    {
      enabled: true,
      authenticated: false,
    },
  )

  assert.deepEqual(
    getRequestAccessAuthStatusForTesting({
      headers: {
        cookie: `ange_clashboard_access_session=${createAccessSessionTokenForTesting('test-secret')}`,
      },
    }),
    {
      enabled: true,
      authenticated: true,
    },
  )
})

test('rule provider search returns cached matches', async () => {
  seedRuleProviderCacheForTesting([
    {
      name: 'streaming',
      behavior: 'domain',
      format: 'text',
      url: 'https://example.test/streaming.txt',
      body: `DOMAIN-SUFFIX,netflix.com
DOMAIN,api.openai.com
`,
    },
  ])

  const payload = await searchRuleProviderCache('www.netflix.com')

  assert.equal(payload.totalProviders, 1)
  assert.equal(payload.cachedProviders, 1)
  assert.equal(payload.matches.length, 1)
  assert.equal(payload.matches[0].name, 'streaming')
  assert.equal(payload.matches[0].totalRules, 2)
  assert.deepEqual(payload.matches[0].matches[0], {
    line: 1,
    value: 'netflix.com',
    mode: 'suffix',
    raw: 'DOMAIN-SUFFIX,netflix.com',
  })
})

test('rule provider search does not require live OpenWrt SSH config', async () => {
  seedRuleProviderCacheForTesting([
    {
      name: 'streaming',
      behavior: 'domain',
      format: 'text',
      url: 'https://example.test/streaming.txt',
      body: `DOMAIN-SUFFIX,netflix.com
DOMAIN,api.openai.com
`,
    },
  ])

  const payload = await searchRuleProviderCache('www.netflix.com')

  assert.equal(payload.cachedProviders, 1)
  assert.equal(payload.matches.length, 1)
  assert.equal(payload.matches[0].name, 'streaming')
  assert.equal(payload.matches[0].url, 'https://example.test/streaming.txt')
})

test('OpenClash config_path is resolved from UCI config without guessing provider URLs', () => {
  assert.equal(
    resolveOpenClashConfigPathFromUciForTesting(
      `
config openclash 'config'
  option config_path '/etc/openclash/config/live.yaml'
`,
    ),
    '/etc/openclash/config/live.yaml',
  )

  assert.equal(
    resolveOpenClashConfigPathFromUciForTesting(
      `
config openclash 'config'
  option config_path 'active.yaml'
`,
      {
        configDir: '/tmp/openclash/config',
        uciConfigPath: '/tmp/openclash/uci',
      },
    ),
    '/tmp/openclash/config/active.yaml',
  )
})

test('Nikki YAML paths are extracted from remote process and UCI content', () => {
  assert.deepEqual(
    extractRemoteYamlConfigPathsFromTextForTesting(
      `1234 root /usr/bin/mihomo -d /etc/nikki/run -f /tmp/nikki/live/config.yaml
5678 root /usr/bin/other --config=/etc/example/ignored.json
`,
    ),
    ['/tmp/nikki/live/config.yaml'],
  )

  assert.deepEqual(
    extractRemoteYamlConfigPathsFromUciForTesting(
      `
config nikki 'config'
  option profile '/etc/nikki/profiles/home.yaml'
  list include "/tmp/nikki/rules/current.yml"
`,
    ),
    ['/etc/nikki/profiles/home.yaml', '/tmp/nikki/rules/current.yml'],
  )
})

test('Nikki process detection ignores OpenClash-owned YAML paths', () => {
  assert.deepEqual(
    extractNikkiYamlConfigPathsFromProcessListForTesting(
      `1234 root /usr/bin/mihomo -d /etc/openclash/core -f /etc/openclash/clash-fallback-std-cn-one.yaml
5678 root /usr/bin/mihomo -d /etc/nikki/run -f /tmp/nikki/live/config.yaml
9012 root /usr/bin/nikki --config=/tmp/custom-nikki.yaml
`,
    ),
    ['/tmp/nikki/live/config.yaml', '/tmp/custom-nikki.yaml'],
  )
})
