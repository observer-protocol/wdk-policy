// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

import { convertWDKTransaction } from './converter.js'
import { extractMandate, runPipeline } from './evaluator.js'
import { postToSidecar, DEFAULT_SIDECAR_URL } from './sidecar-client.js'
import { PolicyViolationError } from './errors.js'

/**
 * @typedef {import('./converter.js').WDKTransaction} WDKTransaction
 * @typedef {import('./evaluator.js').LocalEvaluationResult} LocalEvaluationResult
 * @typedef {import('./evaluator.js').EvaluatorContext} EvaluatorContext
 * @typedef {import('./types.js').ObserverDelegationCredential} ObserverDelegationCredential
 * @typedef {import('./types.js').AttestationContext} AttestationContext
 * @typedef {import('./types.js').PolicyEvaluationCredential} PolicyEvaluationCredential
 */

/**
 * @typedef {Object} EvaluateOptions
 * @property {AttestationContext[]} [attestations]
 * @property {EvaluatorContext} [context]
 */

/**
 * @typedef {Object} WDKPolicyAdapterConfig
 * @property {string} [sidecarUrl] - URL of the Observer Protocol policy sidecar. Defaults to the public hosted endpoint.
 * @property {typeof fetch} [fetchImpl] - Optional fetch override (test injection).
 * @property {number} [timeoutMs] - Sidecar request timeout in ms. Defaults to 5000.
 */

/**
 * Surface 1 (top-level helper) — pure local rule evaluation. No network,
 * no signing. Returns whether the proposal is within the credential's
 * tradingMandate.
 *
 * Use this for fail-fast wallet UX: if `allowed === false`, the wallet
 * MUST NOT proceed to signing.
 *
 * @param {WDKTransaction} wdkTx
 * @param {ObserverDelegationCredential} delegationCredential
 * @param {EvaluateOptions} [opts]
 * @returns {LocalEvaluationResult}
 */
export function evaluateLocal (wdkTx, delegationCredential, opts) {
  const proposal = convertWDKTransaction(wdkTx)
  const mandate = extractMandate(delegationCredential)
  return runPipeline(proposal, mandate, opts)
}

/**
 * The WDK policy adapter. Holds sidecar configuration and exposes both the
 * local-only check and the signed-decision request.
 */
export class WDKPolicyAdapter {
  /**
   * @param {WDKPolicyAdapterConfig} [config]
   */
  constructor (config) {
    /** @type {string} */
    this.sidecarUrl = config?.sidecarUrl ?? DEFAULT_SIDECAR_URL
    /** @type {typeof fetch | undefined} */
    this.fetchImpl = config?.fetchImpl
    /** @type {number} */
    this.timeoutMs = config?.timeoutMs ?? 5000
  }

  /**
   * Pure local evaluation. Alias of `evaluateLocal`. No network, no signing.
   *
   * @param {WDKTransaction} wdkTx
   * @param {ObserverDelegationCredential} delegationCredential
   * @param {EvaluateOptions} [opts]
   * @returns {LocalEvaluationResult}
   */
  checkPolicy (wdkTx, delegationCredential, opts) {
    return evaluateLocal(wdkTx, delegationCredential, opts)
  }

  /**
   * Get a cryptographically-signed PolicyEvaluationCredential from the
   * Observer Protocol policy sidecar. The sidecar re-runs evaluation
   * server-side and signs the decision with #key-3 (assertionMethod-valid
   * per AIP v0.8 §3.4).
   *
   * Throws `PolicyViolationError` on deny — the deny credential is attached
   * to the error as `err.credential` so audit can still record the signed
   * deny artifact.
   *
   * @param {WDKTransaction} wdkTx
   * @param {ObserverDelegationCredential} delegationCredential
   * @param {EvaluateOptions} [opts]
   * @returns {Promise<PolicyEvaluationCredential>}
   */
  async getSignedDecision (wdkTx, delegationCredential, opts) {
    const proposal = convertWDKTransaction(wdkTx)
    if (!proposal.canonicalBytes) {
      throw new Error(
        'wdk-policy: getSignedDecision requires WDKTransaction.canonicalBytes (hex of rail-native pre-sign bytes). Supply from WDK signer machinery — see AIP v0.8 §3.3.'
      )
    }
    const credential = await postToSidecar({
      url: this.sidecarUrl,
      proposal,
      delegationCredential,
      attestations: opts?.attestations,
      context: opts?.context,
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs
    })
    if (credential?.credentialSubject?.decision === 'deny') {
      const reason = credential.credentialSubject.denyReason
      throw new PolicyViolationError(
        reason?.message ?? 'Policy denied',
        reason,
        credential
      )
    }
    return credential
  }
}
