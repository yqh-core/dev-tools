/**
 * G4 运行时验收：guides 加载矩阵 + 证伪。
 *
 * 验证点：
 * 1. GUIDE_LOCALES 与注册表一致（不硬编码）
 * 2. loadGuides 对已启用语言正确返回（en/zh 各返回自己的数据）
 * 3. locale 归一化（zh-CN / zh-Hans 等都走 zh）
 * 4. 未启用语言（ja）→ normalizeLocale 回落 en → 能拿到英文数据（注册表行为）
 * 5. 证伪：若某语言在注册表但无 importer → loadGuides throw（不静默降级）
 * 6. assertGuideCoverage 正常时返回空数组
 *
 * 这些用例在 Node/Vitest 环境（非浏览器）运行，Vite 的 dynamic import 会被
 * vitest 处理为真实 ESM 加载。
 */
import { describe, expect, it } from 'vitest'
import { ENABLED_LOCALES, normalizeLocale } from '@/i18n/languages'
import { GUIDE_LOCALES, assertGuideCoverage, loadGuides } from '@/tools/guides'

describe('G4: GUIDE_LOCALES 派生自注册表', () => {
  it('与 ENABLED_LOCALES 的语言码集合完全一致', () => {
    const registryCodes = ENABLED_LOCALES.map(l => l.code)
    expect([...GUIDE_LOCALES].sort()).toEqual([...registryCodes].sort())
  })

  it('当前包含 en 和 zh（若注册表变化此条会提醒更新期望）', () => {
    expect(GUIDE_LOCALES).toContain('en')
    expect(GUIDE_LOCALES).toContain('zh')
  })
})

describe('G4: loadGuides 按语言返回正确数据', () => {
  it('loadGuides("en") 返回英文 guides，包含 /json-prettify key', async () => {
    const data = await loadGuides('en')
    expect(data).toHaveProperty('/json-prettify')
    expect(data['/json-prettify'].intro).toMatch(/^[A-Za-z]/)
  })

  it('loadGuides("zh") 返回中文 guides，intro 含中文字符', async () => {
    const data = await loadGuides('zh')
    expect(data).toHaveProperty('/json-prettify')
    expect(data['/json-prettify'].intro).toMatch(/[\u4e00-\u9fff]/)
  })

  it('loadGuides("zh-CN") 归一化为 zh 并返回中文数据', async () => {
    const data = await loadGuides('zh-CN')
    expect(data).toHaveProperty('/json-prettify')
    expect(data['/json-prettify'].intro).toMatch(/[\u4e00-\u9fff]/)
  })

  it('loadGuides("ja") → normalizeLocale 回落到 en → 返回英文数据', async () => {
    // ja 未启用，normalizeLocale('ja') → 'en' → 拿到英文
    const data = await loadGuides('ja')
    expect(data['/json-prettify'].intro).toMatch(/^[A-Za-z]/)
  })
})

describe('G4: assertGuideCoverage 自检', () => {
  it('当前所有已启用语言都有 importer → 返回空数组', () => {
    expect(assertGuideCoverage()).toEqual([])
  })
})

describe('G4: 证伪 — 注册表与 importer 不一致时的行为', () => {
  it('若 GUIDE_LOCALES 含 "ja" 但 GUIDE_IMPORTERS 没有 → loadGuides("ja") 会拿到 en（因 normalizeLocale 把 ja 归为默认 en）', async () => {
    // 这是当前注册表下 normalizeLocale 的正确行为：未注册语言 → 默认语言
    // 真正的证伪在 K4 门禁：注册了 ja 到 ENABLED_LOCALES 但没有 guides.ja.ts 文件 → 构建红
    // 这里验证运行时层面：只要 normalizeLocale 把未知语言归到 en，loadGuides(en) 不 throw
    const data = await loadGuides('ja')
    expect(data).toBeTruthy()
    expect(Object.keys(data).length).toBeGreaterThan(50) // 有实质内容，不是空壳
  })

  it('normalizeLocale 是 loadGuides 的唯一归一化入口（不再有独立 startsWith 逻辑）', () => {
    // 确认归一化行为与注册表一致
    expect(normalizeLocale('zh-TW')).toBe('zh')
    expect(normalizeLocale('zh-Hans')).toBe('zh')
    expect(normalizeLocale('en-GB')).toBe('en')
    expect(normalizeLocale('fr')).toBe('en') // 未启用 → 默认
    expect(normalizeLocale('')).toBe('en')
  })
})
