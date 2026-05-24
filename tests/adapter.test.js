import { describe, test, expect, vi } from 'vitest'
import { evaluateLocal, WDKPolicyAdapter, PolicyViolationError } from '../index.js'
import { makeDelegation, makeWdkTx } from './_fixtures.js'

describe('evaluateLocal (Surface 1 — no network, no signing)', () => {
  test('allow: tx within mandate', () => {
    const delegation = makeDelegation({ maxNotionalPerOrder: 10000, unit: 'USDT' })
    const r = evaluateLocal(makeWdkTx({ value: '5000' }), delegation)
    expect(r.allowed).toBe(true)
  })
  test('deny: tx exceeds mandate', () => {
    const delegation = makeDelegation({ maxNotionalPerOrder: 10000, unit: 'USDT' })
    const r = evaluateLocal(makeWdkTx({ value: '15000' }), delegation)
    expect(r.allowed).toBe(false)
    expect(r.denyReason.ruleType).toBe('amountLimits')
  })
})

describe('WDKPolicyAdapter.checkPolicy (alias of evaluateLocal)', () => {
  test('returns deny without throwing', () => {
    const delegation = makeDelegation({ maxNotionalPerOrder: 10000, unit: 'USDT' })
    const adapter = new WDKPolicyAdapter()
    const r = adapter.checkPolicy(makeWdkTx({ value: '15000' }), delegation)
    expect(r.allowed).toBe(false)
    expect(r.denyReason.ruleType).toBe('amountLimits')
  })
})

describe('WDKPolicyAdapter.getSignedDecision (Surface 2 — sidecar)', () => {
  /**
   * Helper: build a fetch mock that returns a signed PolicyEvaluationCredential.
   */
  function mockFetchAllow () {
    return vi.fn(async (_url, _init) => {
      return new Response(JSON.stringify({
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: 'urn:uuid:test-eval',
        type: ['VerifiableCredential', 'PolicyEvaluationCredential'],
        issuer: 'did:web:observerprotocol.org',
        validFrom: '2026-05-25T00:00:00Z',
        credentialSubject: {
          decision: 'allow',
          evaluatedAgainst: { delegationCredentialId: 'urn:uuid:test-delegation', delegationCredentialHash: 'abc' },
          proposal: { proposalHash: 'def', rail: 'tether-chain' },
          evaluator: { id: 'urn:observer-protocol:evaluator:policy-core-v1', version: '0.1.0' },
          evaluatedAt: '2026-05-25T00:00:00Z',
          evaluatedWithAttestations: false
        },
        proof: {
          type: 'Ed25519Signature2026',
          created: '2026-05-25T00:00:00Z',
          verificationMethod: 'did:web:observerprotocol.org#key-3',
          proofPurpose: 'assertionMethod',
          proofValue: 'zTestSig'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
  }

  test('returns the signed credential on allow; posts proper wire payload', async () => {
    const fetchMock = mockFetchAllow()
    const adapter = new WDKPolicyAdapter({ fetchImpl: fetchMock, sidecarUrl: 'https://sidecar.test/evaluate' })
    const delegation = makeDelegation({ maxNotionalPerOrder: 10000, unit: 'USDT' })
    const wdkTx = makeWdkTx({ value: '5000', canonicalBytes: 'deadbeef' })

    const credential = await adapter.getSignedDecision(wdkTx, delegation)
    expect(credential.credentialSubject.decision).toBe('allow')
    expect(credential.proof.verificationMethod).toBe('did:web:observerprotocol.org#key-3')

    // Confirm the sidecar got the wire-shape EvaluationInput, not the WDK shape.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://sidecar.test/evaluate')
    const body = JSON.parse(init.body)
    expect(body.proposal.rail).toBe('tether-chain')
    expect(body.proposal.canonicalBytes).toBe('deadbeef')
    expect(body.proposal.humanReadable.notional).toBe(5000)
    expect(body.proposal.humanReadable.counterparty).toBe('0xrecipient')
    expect(body.delegationCredential.id).toBe('urn:uuid:test-delegation')
  })

  test('throws PolicyViolationError on deny; attaches the signed deny credential', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: 'urn:uuid:test-deny',
      type: ['VerifiableCredential', 'PolicyEvaluationCredential'],
      issuer: 'did:web:observerprotocol.org',
      validFrom: '2026-05-25T00:00:00Z',
      credentialSubject: {
        decision: 'deny',
        denyReason: {
          ruleType: 'amountLimits',
          ruleField: 'maxNotionalPerOrder',
          message: 'Proposed notional 15000 USDT exceeds maxNotionalPerOrder 10000 USDT.',
          currentValue: 10000,
          proposedValue: 15000
        },
        evaluatedAgainst: { delegationCredentialId: 'urn:uuid:test-delegation', delegationCredentialHash: 'abc' },
        proposal: { proposalHash: 'def', rail: 'tether-chain' },
        evaluator: { id: 'urn:observer-protocol:evaluator:policy-core-v1', version: '0.1.0' },
        evaluatedAt: '2026-05-25T00:00:00Z',
        evaluatedWithAttestations: false
      },
      proof: {
        type: 'Ed25519Signature2026',
        created: '2026-05-25T00:00:00Z',
        verificationMethod: 'did:web:observerprotocol.org#key-3',
        proofPurpose: 'assertionMethod',
        proofValue: 'zDenySig'
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const adapter = new WDKPolicyAdapter({ fetchImpl: fetchMock })
    const delegation = makeDelegation({ maxNotionalPerOrder: 10000, unit: 'USDT' })
    const wdkTx = makeWdkTx({ value: '15000', canonicalBytes: 'deadbeef' })

    await expect(adapter.getSignedDecision(wdkTx, delegation)).rejects.toThrow(PolicyViolationError)

    try {
      await adapter.getSignedDecision(wdkTx, delegation)
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyViolationError)
      expect(err.denyReason.ruleType).toBe('amountLimits')
      expect(err.denyReason.currentValue).toBe(10000)
      expect(err.denyReason.proposedValue).toBe(15000)
      // The signed deny credential is attached for audit-trail purposes.
      expect(err.credential).toBeDefined()
      expect(err.credential.credentialSubject.decision).toBe('deny')
      expect(err.credential.proof.verificationMethod).toBe('did:web:observerprotocol.org#key-3')
    }
  })

  test('requires canonicalBytes for signed decisions (per AIP v0.8 §3.3)', async () => {
    const fetchMock = mockFetchAllow()
    const adapter = new WDKPolicyAdapter({ fetchImpl: fetchMock })
    const delegation = makeDelegation({ maxNotionalPerOrder: 10000, unit: 'USDT' })
    const wdkTx = makeWdkTx({ value: '5000' }) // no canonicalBytes
    await expect(adapter.getSignedDecision(wdkTx, delegation)).rejects.toThrow(/canonicalBytes/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('propagates sidecar HTTP errors with status', async () => {
    const fetchMock = vi.fn(async () => new Response('upstream offline', { status: 503 }))
    const adapter = new WDKPolicyAdapter({ fetchImpl: fetchMock })
    const delegation = makeDelegation({})
    const wdkTx = makeWdkTx({ canonicalBytes: 'deadbeef' })
    await expect(adapter.getSignedDecision(wdkTx, delegation)).rejects.toThrow(/HTTP 503/)
  })
})
