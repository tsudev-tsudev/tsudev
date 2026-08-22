'use strict'
/**
 * Chốt chống SSRF của domainVerify.
 *
 * Hai lỗ từng mở: (1) `assertPublicHost` chỉ kiểm host GỐC còn `fetch` theo
 * redirect sang địa chỉ nội bộ; (2) khe TOCTOU giữa lúc phân giải và lúc nối
 * (DNS rebinding). Cả hai đóng ở một điểm: mọi lần connect đi qua `guardedLookup`
 * - kiểm rồi GHIM IP - và `safeGet` chỉ theo redirect https, mỗi chặng kiểm lại.
 *
 * Không chạm mạng thật: `dns` và `https` đều là bộ giả.
 */

jest.mock('https', () => ({ get: jest.fn() }))
jest.mock('dns', () => {
  const actual = jest.requireActual('dns')
  return { ...actual, lookup: jest.fn(), promises: { ...actual.promises } }
})

import https from 'https'
import { lookup as dnsLookup } from 'dns'
import { EventEmitter } from 'events'
import { guardedLookup, safeGet, isPrivateAddress } from '../src/domainVerify'

const mockedGet = https.get as unknown as jest.Mock
const mockedDns = dnsLookup as unknown as jest.Mock

beforeEach(() => {
  mockedGet.mockReset()
  mockedDns.mockReset()
})

describe('isPrivateAddress - dải phải chặn', () => {
  const internal = [
    '127.0.0.1',
    '0.0.0.0',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // metadata cloud
    '100.64.0.1', // CGNAT
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12::3',
    '::ffff:127.0.0.1', // IPv4 loopback ánh xạ IPv6
    '::ffff:10.0.0.1',
  ]
  it.each(internal)('chặn %s', (ip) => expect(isPrivateAddress(ip)).toBe(true))
})

describe('isPrivateAddress - địa chỉ công cộng phải cho qua', () => {
  const external = [
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1', // ngay dưới dải 172.16
    '172.32.0.1', // ngay trên dải 172.31
    '93.184.216.34',
    '2606:4700::1111',
    '::ffff:8.8.8.8',
  ]
  it.each(external)('cho qua %s', (ip) => expect(isPrivateAddress(ip)).toBe(false))
})

// Gọi guardedLookup và thu kết quả callback về Promise cho dễ assert.
function runGuard(): Promise<{ err: Error | null; address: unknown; family: unknown }> {
  return new Promise((resolve) => {
    guardedLookup('bên-thứ-ba.example', {} as never, (err, address, family) =>
      resolve({ err: err as Error | null, address, family })
    )
  })
}

describe('guardedLookup', () => {
  it('cho qua và GHIM địa chỉ công cộng đã phân giải', async () => {
    mockedDns.mockImplementation((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: '93.184.216.34', family: 4 }])
    )
    const r = await runGuard()
    expect(r.err).toBeNull()
    expect(r.address).toBe('93.184.216.34')
    expect(r.family).toBe(4)
  })

  it('chặn khi phân giải ra địa chỉ nội bộ (rebinding)', async () => {
    mockedDns.mockImplementation((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [{ address: '169.254.169.254', family: 4 }])
    )
    const r = await runGuard()
    expect(r.err).toBeInstanceOf(Error)
    expect(String(r.err?.message)).toContain('nội bộ')
  })

  it('chặn khi CÓ MỘT địa chỉ nội bộ lẫn trong danh sách (DNS đa bản ghi)', async () => {
    mockedDns.mockImplementation((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.7', family: 4 },
      ])
    )
    const r = await runGuard()
    expect(r.err).toBeInstanceOf(Error)
  })

  it('trả lỗi khi không có bản ghi địa chỉ', async () => {
    mockedDns.mockImplementation((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(null, [])
    )
    const r = await runGuard()
    expect(r.err).toBeInstanceOf(Error)
  })

  it('chuyển tiếp lỗi phân giải DNS', async () => {
    mockedDns.mockImplementation((_h: string, _o: unknown, cb: (...a: unknown[]) => void) =>
      cb(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))
    )
    const r = await runGuard()
    expect(r.err).toBeInstanceOf(Error)
  })
})

// Bộ giả cho một phản hồi https. Redirect: chỉ status + location; nội dung: body.
function fakeRes(spec: { status: number; location?: string; body?: string }) {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number
    headers: Record<string, string | undefined>
    resume: () => void
    destroy: () => void
  }
  res.statusCode = spec.status
  res.headers = { location: spec.location }
  res.resume = () => undefined
  res.destroy = () => undefined
  process.nextTick(() => {
    if (spec.body) res.emit('data', Buffer.from(spec.body))
    res.emit('end')
  })
  return res
}
function fakeReq() {
  const req = new EventEmitter() as EventEmitter & { destroy: () => void }
  req.destroy = () => undefined
  return req
}

describe('safeGet - theo redirect an toàn', () => {
  it('theo redirect https rồi trả nội dung trang đích', async () => {
    const queue = [
      { status: 302, location: 'https://đích.example/trang' },
      { status: 200, body: 'XIN-CHAO' },
    ]
    mockedGet.mockImplementation((_url: string, _opts: unknown, cb: (...a: unknown[]) => void) => {
      cb(fakeRes(queue.shift() as never))
      return fakeReq()
    })
    const res = await safeGet('https://nguon.example/')
    expect(res.status).toBe(200)
    expect(res.body).toBe('XIN-CHAO')
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it('TỪ CHỐI redirect hạ cấp sang http', async () => {
    mockedGet.mockImplementation((_url: string, _opts: unknown, cb: (...a: unknown[]) => void) => {
      cb(fakeRes({ status: 302, location: 'http://noi-bo.internal/' }))
      return fakeReq()
    })
    await expect(safeGet('https://nguon.example/')).rejects.toThrow(/không phải https/)
  })

  it('dừng và ném lỗi khi vòng redirect quá dài', async () => {
    mockedGet.mockImplementation((_url: string, _opts: unknown, cb: (...a: unknown[]) => void) => {
      cb(fakeRes({ status: 302, location: 'https://vong.example/lap' }))
      return fakeReq()
    })
    await expect(safeGet('https://nguon.example/')).rejects.toThrow(/Quá nhiều/)
  })
})
