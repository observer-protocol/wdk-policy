// Copyright 2026 Observer Protocol, Inc.
// Licensed under the Apache License, Version 2.0.
//
// Minimal end-to-end example: a WDK wallet wants to send a transaction.
// Before signing, it checks the proposal against its delegation credential.
// Step 1: local-only fail-fast check.
// Step 2 (optional): sidecar call for the signed PolicyEvaluationCredential.

import {
  evaluateLocal,
  WDKPolicyAdapter,
  PolicyViolationError
} from '@observer-protocol/wdk-policy'

// --- 1. Inputs the wallet has ---------------------------------------------

// A WDK transaction the wallet is about to sign.
const wdkTx = {
  sender: '0xagent-wallet-address',
  recipient: '0xcounterparty-address',
  value: '5000',
  asset: 'USDT',
  metadata: { rail: 'tether-chain' },
  // Hex of rail-native pre-sign bytes from WDK's signer machinery.
  // Required only for getSignedDecision (Surface 2).
  canonicalBytes: '0xdeadbeef'
}

// The signed ObserverDelegationCredential the agent holds, with a
// tradingMandate capping per-order at 10,000 USDT.
const delegationCredential = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  id: 'urn:uuid:example-delegation',
  type: ['VerifiableCredential', 'ObserverDelegationCredential'],
  issuer: 'did:web:observerprotocol.org',
  validFrom: '2026-01-01T00:00:00Z',
  validUntil: '2027-01-01T00:00:00Z',
  credentialSubject: {
    id: 'did:web:observerprotocol.org:agents:my-agent',
    tradingMandate: {
      maxNotionalPerOrder: 10000,
      unit: 'USDT'
    }
  },
  proof: { type: 'Ed25519Signature2026', /* … */ proofValue: 'zRealSignature' }
}

// --- 2. Surface 1: local-only check (no network, no signing) --------------

const local = evaluateLocal(wdkTx, delegationCredential)
if (!local.allowed) {
  console.error('local policy denied:', local.denyReason)
  // Wallet MUST NOT proceed to signing.
  process.exit(1)
}
console.log('local policy allows the proposal')

// --- 3. Surface 2 (optional): get a signed PolicyEvaluationCredential -----

const adapter = new WDKPolicyAdapter() // defaults to the public OP sidecar

try {
  const credential = await adapter.getSignedDecision(wdkTx, delegationCredential)
  console.log(
    'signed PolicyEvaluationCredential:',
    credential.id,
    '— store this alongside the signed transaction for the audit trail'
  )
  // Now safe to proceed with WDK signing.
} catch (err) {
  if (err instanceof PolicyViolationError) {
    console.error('policy denied:', err.denyReason.message)
    // err.credential carries the signed deny credential — store for audit.
    console.error('signed deny credential:', err.credential?.id)
  } else {
    // Sidecar unreachable, HTTP error, etc. Wallet decides whether to fall
    // back to local-only allow or treat as fail-closed.
    console.error('sidecar error:', err.message)
  }
}
