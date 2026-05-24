import { describe, test, expect } from 'vitest'
import { convertWDKTransaction } from '../src/converter.js'
import { runPipeline } from '../src/evaluator.js'
import { makeWdkTx, attest } from './_fixtures.js'

function run (mandate, wdkTx, opts) {
  return runPipeline(convertWDKTransaction(wdkTx), mandate, opts)
}

describe('amount-limits via pipeline', () => {
  test('allow when notional below cap', () => {
    const r = run({ maxNotionalPerOrder: 10000, unit: 'USDT' }, makeWdkTx({ value: '5000' }))
    expect(r.allowed).toBe(true)
  })
  test('deny with currentValue/proposedValue in denyReason', () => {
    const r = run({ maxNotionalPerOrder: 10000, unit: 'USDT' }, makeWdkTx({ value: '15000' }))
    expect(r.allowed).toBe(false)
    expect(r.denyReason.ruleType).toBe('amountLimits')
    expect(r.denyReason.currentValue).toBe(10000)
    expect(r.denyReason.proposedValue).toBe(15000)
  })
})

describe('counterparty issuer-class set membership (v0.8 §2.1)', () => {
  test('counterparty in required set → ALLOW', () => {
    const cp = '0xdef'
    const r = run(
      { counterparty: { requireIssuerClassIn: ['third_party_kyb', 'partner'] } },
      makeWdkTx({ recipient: cp }),
      { attestations: [attest(cp, { issuerClass: 'third_party_kyb' })] }
    )
    expect(r.allowed).toBe(true)
  })
  test('counterparty NOT in required set → DENY', () => {
    const cp = '0xdef'
    const r = run(
      { counterparty: { requireIssuerClassIn: ['third_party_kyb', 'partner'] } },
      makeWdkTx({ recipient: cp }),
      { attestations: [attest(cp, { issuerClass: 'sovereign_self_attested' })] }
    )
    expect(r.allowed).toBe(false)
    expect(r.denyReason.ruleField).toBe('requireIssuerClassIn')
  })
})

describe('geographic asymmetric fail modes (v0.8 §2.3) — LOAD-BEARING', () => {
  test('blockedJurisdictions + unknown jurisdiction → ALLOW (fail-open)', () => {
    const r = run({ geographic: { blockedJurisdictions: ['KP', 'IR'] } }, makeWdkTx())
    expect(r.allowed).toBe(true)
  })
  test('allowedJurisdictionsOnly + unknown jurisdiction → DENY (fail-closed)', () => {
    const r = run({ geographic: { allowedJurisdictionsOnly: ['US', 'GB'] } }, makeWdkTx())
    expect(r.allowed).toBe(false)
    expect(r.denyReason.ruleField).toBe('allowedJurisdictionsOnly')
  })
})

describe('temporal window matching', () => {
  const businessHours = {
    temporal: {
      allowedTimeWindows: [{
        start: '09:00', end: '17:00', timezone: 'UTC',
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri']
      }]
    }
  }
  // 2026-05-25 was a Monday.
  test('14:00 UTC Mon inside window → ALLOW', () => {
    expect(run(businessHours, makeWdkTx(), { context: { now: new Date('2026-05-25T14:00:00Z') } }).allowed).toBe(true)
  })
  test('20:00 UTC Mon outside window → DENY', () => {
    expect(run(businessHours, makeWdkTx(), { context: { now: new Date('2026-05-25T20:00:00Z') } }).allowed).toBe(false)
  })
  test('14:00 UTC Sat wrong day → DENY', () => {
    expect(run(businessHours, makeWdkTx(), { context: { now: new Date('2026-05-30T14:00:00Z') } }).allowed).toBe(false)
  })
})

describe('evaluator pipeline ordering & flags', () => {
  test('fail-fast: amount fails before temporal is checked', () => {
    // Both amount AND temporal would deny; pipeline order makes amount win.
    const mandate = {
      maxNotionalPerOrder: 1000,
      unit: 'USDT',
      temporal: { allowedTimeWindows: [{ start: '09:00', end: '17:00', timezone: 'UTC', daysOfWeek: ['mon'] }] }
    }
    const r = run(mandate, makeWdkTx({ value: '5000' }), { context: { now: new Date('2026-05-30T03:14:00Z') } })
    expect(r.allowed).toBe(false)
    expect(r.denyReason.ruleType).toBe('amountLimits')
  })
  test('evaluatedWithAttestations: true when attestations supplied', () => {
    const r = run({}, makeWdkTx(), { attestations: [attest('0xa', { issuerClass: 'op_first_party' })] })
    expect(r.evaluatedWithAttestations).toBe(true)
  })
  test('evaluatedWithAttestations: false when attestations omitted', () => {
    const r = run({}, makeWdkTx())
    expect(r.evaluatedWithAttestations).toBe(false)
  })
})
