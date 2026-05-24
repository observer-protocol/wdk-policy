// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

/**
 * @typedef {import('./types.js').ObserverDelegationCredential} ObserverDelegationCredential
 * @typedef {import('./types.js').AttestationContext} AttestationContext
 * @typedef {import('./types.js').PolicyEvaluationCredential} PolicyEvaluationCredential
 * @typedef {import('./converter.js').InternalProposal} InternalProposal
 * @typedef {import('./evaluator.js').EvaluatorContext} EvaluatorContext
 */

export const DEFAULT_SIDECAR_URL = 'https://api.observerprotocol.org/policy/evaluate'

/**
 * POST a proposal+credential payload to the Observer Protocol policy
 * sidecar and return the signed PolicyEvaluationCredential. The sidecar
 * runs the same rule pipeline server-side and signs decisions with key-3
 * (the assertionMethod-valid scoped on-server signer per AIP v0.8 §3.4).
 *
 * @param {Object} args
 * @param {string} args.url - Sidecar URL.
 * @param {InternalProposal} args.proposal
 * @param {ObserverDelegationCredential} args.delegationCredential
 * @param {AttestationContext[]} [args.attestations]
 * @param {EvaluatorContext} [args.context]
 * @param {typeof fetch} [args.fetchImpl] - Optional fetch override (for tests).
 * @param {number} [args.timeoutMs] - Optional request timeout. Defaults to 5000ms.
 * @returns {Promise<PolicyEvaluationCredential>}
 */
export async function postToSidecar (args) {
  const {
    url,
    proposal,
    delegationCredential,
    attestations,
    context,
    fetchImpl = globalThis.fetch,
    timeoutMs = 5000
  } = args

  if (typeof fetchImpl !== 'function') {
    throw new Error('postToSidecar: no fetch implementation available')
  }

  // Map our internal proposal back to the wire EvaluationInput shape that
  // the sidecar expects (matches @observer-protocol/policy-interface).
  const wirePayload = {
    proposal: {
      rail: proposal.rail,
      canonicalBytes: proposal.canonicalBytes ?? '',
      humanReadable: {
        ...(proposal.hints.notional != null && { notional: proposal.hints.notional }),
        ...(proposal.hints.unit != null && { unit: proposal.hints.unit }),
        ...(proposal.hints.counterparty != null && { counterparty: proposal.hints.counterparty }),
        ...(proposal.hints.counterpartyJurisdiction != null && {
          counterpartyJurisdiction: proposal.hints.counterpartyJurisdiction
        })
      }
    },
    delegationCredential,
    ...(attestations && { attestations }),
    ...(context && { context })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@observer-protocol/wdk-policy/0.1.0-beta.1'
      },
      body: JSON.stringify(wirePayload),
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`policy sidecar HTTP ${response.status}: ${text || response.statusText}`)
  }

  const body = await response.json()
  return /** @type {PolicyEvaluationCredential} */ (body)
}
