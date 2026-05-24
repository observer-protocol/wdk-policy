// Shared test fixtures.

/**
 * @typedef {import('../types.js').TradingMandate} TradingMandate
 * @typedef {import('../types.js').ObserverDelegationCredential} ObserverDelegationCredential
 * @typedef {import('../types.js').AttestationContext} AttestationContext
 */

/**
 * @param {TradingMandate} mandate
 * @returns {ObserverDelegationCredential}
 */
export function makeDelegation (mandate) {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: 'urn:uuid:test-delegation',
    type: ['VerifiableCredential', 'ObserverDelegationCredential'],
    issuer: 'did:web:observerprotocol.org',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    credentialSubject: {
      id: 'did:web:observerprotocol.org:agents:test-agent',
      tradingMandate: mandate
    },
    proof: {
      type: 'Ed25519Signature2026',
      created: '2026-01-01T00:00:00Z',
      verificationMethod: 'did:web:observerprotocol.org#key-2',
      proofPurpose: 'assertionMethod',
      proofValue: 'zTestPlaceholder'
    }
  }
}

/**
 * @param {Object} parts
 * @param {string} [parts.sender]
 * @param {string} [parts.recipient]
 * @param {string} [parts.value]
 * @param {string} [parts.asset]
 * @param {string} [parts.rail]
 * @param {string} [parts.canonicalBytes]
 */
export function makeWdkTx (parts = {}) {
  return {
    sender: parts.sender ?? '0xsender',
    recipient: parts.recipient ?? '0xrecipient',
    value: parts.value ?? '5000',
    asset: parts.asset ?? 'USDT',
    metadata: { rail: parts.rail ?? 'tether-chain' },
    canonicalBytes: parts.canonicalBytes
  }
}

/**
 * @param {string} counterparty
 * @param {{ issuerClass?: string, jurisdiction?: string }} parts
 * @returns {AttestationContext}
 */
export function attest (counterparty, parts) {
  return /** @type {AttestationContext} */ ({ counterparty, ...parts })
}
