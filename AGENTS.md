# Agent Guide

This repository implements the Observer Protocol policy-enforcement layer for the Tether WDK ecosystem. It follows the same conventions as the other `@observer-protocol/wdk-*` modules (`wdk-protocol-trust`, `wdk-observer-protocol`, `wdk-lightning-verifier`) to make integration mechanical.

## Project Overview

- **Architecture:** Two surfaces on the same engine:
  1. `evaluateLocal(wdkTx, delegationCredential, opts?)` — pure local rule evaluation, no network, no signing. The wallet blocks on deny pre-signature. Per AIP v0.8 §3.1 this is the *pre-settlement* surface.
  2. `getSignedDecision(wdkTx, delegationCredential, opts?)` — POSTs to the Observer Protocol sidecar (`https://api.observerprotocol.org/policy/evaluate`) and returns a key-3-signed `PolicyEvaluationCredential` for the audit trail. Per AIP v0.8 §3.1 this is the *post-submission* surface.
- **Runtime:** Node.js (≥20, native `fetch`). No bare-runtime support yet (planned alongside other `wdk-*` modules).

## Tech Stack & Tooling

- **Language:** JavaScript (ES2022+). Type information via JSDoc; TypeScript used only to generate `.d.ts` from JSDoc.
- **Module System:** ES Modules (`"type": "module"`).
- **Type Declarations:** `npm run build:types` runs `tsc` (declaration-only).
- **Testing:** `vitest`. `npm test` runs the suite.
- **No runtime crypto deps:** the local evaluator path doesn't sign — signing happens server-side at the OP sidecar. The only dependency is `@observer-protocol/policy-interface` (TypeScript types).

## Coding Conventions

- **File Naming:** kebab-case (`adapter.js`, `wdk-converter.js`).
- **Class Naming:** PascalCase (`WDKPolicyAdapter`).
- **Function Naming:** camelCase (`evaluateLocal`).
- **Error Naming:** PascalCase + `Error` suffix (`PolicyViolationError`).

## Spec

Authoritative spec is AIP v0.8 draft 1:
- https://github.com/observer-protocol/aip/blob/main/aip-v0.8-draft-1.md

Rule semantics (the five rules implemented here) come from AIP v0.8 §2.1–§2.4. The asymmetric geographic fail modes (§2.3) are load-bearing — review them before changing `src/rules/geographic.js`.

## Tests

The test suite covers:
- Converter — WDK transaction shape → internal evaluation input.
- Rules — each of the five rules from AIP v0.8 §2.x, including the asymmetric geographic fail modes.
- Evaluator — fail-fast pipeline ordering, `evaluatedWithAttestations` flag.
- Adapter — `evaluateLocal` end-to-end, `getSignedDecision` with mocked sidecar.

Run with `npm test`. All tests are deterministic; no live network calls (the sidecar HTTP call is mocked).
