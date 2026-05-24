# @observer-protocol/wdk-policy

> WDK protocol module: delegation-scoped policy enforcement for agentic wallets, powered by Observer Protocol AIP v0.8.

**Note**: This package is currently in beta (`0.1.0-beta.1`). It implements [AIP v0.8](https://github.com/observer-protocol/aip/blob/main/aip-v0.8-draft-1.md), which is itself a published draft. The five rule evaluators are spec-complete and tested; the signed-decision sidecar endpoint is being deployed alongside this beta. Test thoroughly in development before production use.

---

## Why this exists

WDK gives an agent a wallet. It doesn't give the wallet's signer any way to know *whether the proposed transaction falls within the scope of authority the principal granted*. Two agents holding identical WDK wallets and identical delegation credentials can attempt very different transactions; the wallet has no protocol-native way to decide which transactions are within mandate and which aren't.

This module fills that gap. A WDK wallet that holds an `ObserverDelegationCredential` (per [AIP v0.8](https://github.com/observer-protocol/aip/blob/main/aip-v0.8-draft-1.md)) can ask, **pre-signature**, whether a proposed transaction is within the credential's `tradingMandate`. If the answer is no, the wallet blocks the signing routine — the key material is never touched. The same call can optionally fetch a cryptographically-signed `PolicyEvaluationCredential` from Observer Protocol's evaluator service, recording the decision for the audit trail.

## Install

```bash
npm install @observer-protocol/wdk-policy
```

## Quick start

### Surface 1 — local evaluation (no network, no signing)

The wallet blocks pre-signature on deny. This is the "key material never touched" guarantee — the wallet's signing routine is never reached.

```javascript
import { evaluateLocal } from '@observer-protocol/wdk-policy'

// `wdkTx`         — your WDK transaction object
// `delegation`    — the signed ObserverDelegationCredential the agent holds
const decision = evaluateLocal(wdkTx, delegation)

if (!decision.allowed) {
  // Surface the structured deny reason to the agent / human operator.
  throw new Error(`Policy violation: ${decision.denyReason.message}`)
}
// Within mandate — proceed with WDK signing.
```

No keys, no network. Suitable for fully offline or air-gapped wallets.

### Surface 2 — get a signed PolicyEvaluationCredential

Use this when you want the audit-trail artifact: a cryptographically-signed credential issued by Observer Protocol's evaluator, bound to the proposal hash and the delegation credential hash.

```javascript
import { WDKPolicyAdapter, PolicyViolationError } from '@observer-protocol/wdk-policy'

const adapter = new WDKPolicyAdapter()

try {
  const credential = await adapter.getSignedDecision(wdkTx, delegation)
  // credential is a signed PolicyEvaluationCredential — store it alongside
  // the signed transaction for the audit trail.
} catch (err) {
  if (err instanceof PolicyViolationError) {
    // Deny — err.denyReason carries the structured violation detail.
    console.error('Policy violation:', err.denyReason)
  } else {
    throw err
  }
}
```

This makes a network call to Observer Protocol's evaluator (`https://api.observerprotocol.org/policy/evaluate` by default; configurable). Returns the signed credential on allow; throws `PolicyViolationError` on deny.

## What gets evaluated

The five rule families defined in AIP v0.8 §2:

- **Amount limits** — `maxNotionalPerOrder`, `maxPosition`, unit consistency, drawdown cap.
- **Counterparty controls** — `allowList`, `blockList`, `requireIssuerClassIn` (set membership over OP's `issuer_class` taxonomy).
- **Temporal** — `allowedTimeWindows` (IANA-timezone-aware, midnight-wrap handling).
- **Geographic** — `blockedJurisdictions` (fail-open on unknown), `allowedJurisdictionsOnly` (fail-CLOSED on unknown).
- **Velocity** — `dailyVolumeCap`, `monthlyVolumeCap` (stateful; skipped in local eval, enforced server-side).

See [AIP v0.8 §2.1–§2.4](https://github.com/observer-protocol/aip/blob/main/aip-v0.8-draft-1.md) for the normative semantics.

## WDK transaction format

The adapter accepts a thin generic shape — enough for the rule pipeline to extract the semantic hints it needs. The wallet integrator populates these fields from WDK's per-rail transaction objects.

```javascript
{
  sender: '0x...',                  // source address (rail-native)
  recipient: '0x...',               // destination address (rail-native)
  value: '5000',                    // amount as string (BigInt-safe)
  asset: 'USDT',                    // unit/asset code
  timestamp: '2026-05-25T...Z',     // optional; defaults to now
  metadata: {
    rail: 'tether-chain'            // optional; defaults to 'tether-chain'
  },
  canonicalBytes: '0x...'           // optional; hex of rail-native pre-sign bytes.
                                    // REQUIRED for getSignedDecision (binds the
                                    // signed credential to this exact tx).
}
```

`canonicalBytes` is what gets hashed into `proposalHash` inside the signed `PolicyEvaluationCredential` — see AIP v0.8 §3.3 for the rail-native canonicalisation requirement. WDK's signer machinery already produces these bytes per rail; pass them through as opaque hex.

## API

See [src/adapter.js](./src/adapter.js) for the JSDoc-typed surface. Brief:

| Function | Returns | Network |
|---|---|---|
| `evaluateLocal(wdkTx, credential, opts?)` | `{ allowed, denyReason?, evaluatedWithAttestations }` | none |
| `new WDKPolicyAdapter(config?).getSignedDecision(wdkTx, credential, opts?)` | `Promise<PolicyEvaluationCredential>` | POST to evaluator URL |
| `new WDKPolicyAdapter(config?).checkPolicy(wdkTx, credential, opts?)` | `Promise<{ allowed, denyReason? }>` | none (alias for `evaluateLocal`) |

`opts` may carry `attestations` (counterparty trust context) and `context` (velocity state).

## Integration guide

For step-by-step WDK integration, see [op-policy-engine/docs/WDK-INTEGRATION.md](https://github.com/observer-protocol/op-policy-engine/blob/main/docs/WDK-INTEGRATION.md).

## License

Apache-2.0. See [LICENSE](./LICENSE).
