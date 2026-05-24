import { describe, test, expect } from 'vitest'
import { convertWDKTransaction } from '../src/converter.js'

describe('convertWDKTransaction', () => {
  test('maps a basic WDK tx to internal proposal shape', () => {
    const wdkTx = {
      sender: '0xabc',
      recipient: '0xdef',
      value: '5000',
      asset: 'USDT'
    }
    const out = convertWDKTransaction(wdkTx)
    expect(out.rail).toBe('tether-chain')
    expect(out.hints.notional).toBe(5000)
    expect(out.hints.unit).toBe('USDT')
    expect(out.hints.counterparty).toBe('0xdef')
  })

  test('honors metadata.rail when present', () => {
    const wdkTx = {
      sender: '0xa', recipient: '0xb', value: '1', asset: 'USDT',
      metadata: { rail: 'ethereum-mainnet' }
    }
    expect(convertWDKTransaction(wdkTx).rail).toBe('ethereum-mainnet')
  })

  test('passes through canonicalBytes unchanged', () => {
    const wdkTx = {
      sender: '0xa', recipient: '0xb', value: '1', asset: 'USDT',
      canonicalBytes: '0xdeadbeef'
    }
    expect(convertWDKTransaction(wdkTx).canonicalBytes).toBe('0xdeadbeef')
  })

  test('throws on missing required fields', () => {
    expect(() => convertWDKTransaction(null)).toThrow(/object/)
    expect(() => convertWDKTransaction({ sender: 'x' })).toThrow(/sender/)
  })

  test('handles value as string (BigInt-safe input)', () => {
    const wdkTx = {
      sender: '0xa', recipient: '0xb', value: '25000', asset: 'USDT'
    }
    expect(convertWDKTransaction(wdkTx).hints.notional).toBe(25000)
  })

  test('handles value as number too (for convenience)', () => {
    const wdkTx = {
      sender: '0xa', recipient: '0xb', value: 1234, asset: 'USDT'
    }
    expect(convertWDKTransaction(wdkTx).hints.notional).toBe(1234)
  })

  test('leaves notional undefined when value is empty or invalid', () => {
    const wdkTx = {
      sender: '0xa', recipient: '0xb', value: '', asset: 'USDT'
    }
    expect(convertWDKTransaction(wdkTx).hints.notional).toBeUndefined()
  })
})
