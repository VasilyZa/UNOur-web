import { describe, expect, it } from 'vitest'
import { validateCredentials } from './validation'

describe('账户输入边界', () => {
  it('密码限定 8–14 个字符，按 Unicode 字符计数', () => {
    expect(validateCredentials('Alice', '1234567', true)).toBeTruthy()
    expect(validateCredentials('Alice', '12345678', true)).toBe('')
    expect(validateCredentials('Alice', '12345678901234', true)).toBe('')
    expect(validateCredentials('Alice', '123456789012345', true)).toBeTruthy()
    expect(validateCredentials('Alice', '😀😀😀😀😀', true)).toBeTruthy()
    expect(validateCredentials('头像用户', '😀😀😀😀😀😀😀😀', true)).toBe('')
  })
  it('拒绝不支持的用户名与过长密码，登录保留原始密码', () => {
    expect(validateCredentials('<script>', '123456789', true)).toBeTruthy()
    expect(validateCredentials('Alice', 'x'.repeat(15), true)).toBeTruthy()
    expect(validateCredentials(' Alice ', ' password ', false)).toBe('')
  })
})
