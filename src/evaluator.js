// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

import { evaluateAmountLimits } from './rules/amount-limits.js'
import { evaluateCounterparty } from './rules/counterparty.js'
import { evaluateTemporal } from './rules/temporal.js'
import { evaluateGeographic } from './rules/geographic.js'
import { evaluateVelocity } from './rules/velocity.js'

/**
 * @typedef {import('./types.js').TradingMandate} TradingMandate
 * @typedef {import('./types.js').DenyReason} DenyReason
 * @typedef {import('./types.js').AttestationContext} AttestationContext
 * @typedef {import('./types.js').ObserverDelegationCredential} ObserverDelegationCredential
 * @typedef {import('./converter.js').InternalProposal} InternalProposal
 */

/**
 * Optional context for stateful rules. Wallets without state pass nothing;
 * stateful rules then skip and server-side defense-in-depth catches.
 *
 * @typedef {Object} EvaluatorContext
 * @property {number} [currentDailyVolume] - Aggregate 24h volume for this delegation, in mandate.unit.
 * @property {number} [currentMonthlyVolume] - Aggregate 30d volume for this delegation, in mandate.unit.
 * @property {number} [currentPosition] - Current open exposure, in mandate.unit.
 * @property {Date} [now] - Override "now" for deterministic tests.
 */

/**
 * Result of a local rule-pipeline run.
 *
 * @typedef {Object} LocalEvaluationResult
 * @property {boolean} allowed - True when no rule denied.
 * @property {DenyReason} [denyReason] - Structured reason; set iff !allowed.
 * @property {boolean} evaluatedWithAttestations - Whether attestations were supplied.
 */

/**
 * Extract the tradingMandate from a signed ObserverDelegationCredential.
 * A credential with no tradingMandate is treated as an empty mandate
 * (no positive rules), which means evaluator returns allow on all
 * proposals — the policy author wanting deny-all should issue an explicit
 * empty allowList / allowedVenues per v0.8 §2.1 fail-closed semantics.
 *
 * @param {ObserverDelegationCredential} credential
 * @returns {TradingMandate}
 */
export function extractMandate (credential) {
  return credential?.credentialSubject?.tradingMandate ?? {}
}

/**
 * Run the local rule pipeline. Deterministic, fail-fast order:
 * amount → temporal → velocity → counterparty → geographic.
 *
 * @param {InternalProposal} proposal
 * @param {TradingMandate} mandate
 * @param {Object} [opts]
 * @param {AttestationContext[]} [opts.attestations]
 * @param {EvaluatorContext} [opts.context]
 * @returns {LocalEvaluationResult}
 */
export function runPipeline (proposal, mandate, opts) {
  const attestations = opts?.attestations
  const context = opts?.context
  const evaluatedWithAttestations = Array.isArray(attestations) && attestations.length > 0

  const pipeline = [
    () => evaluateAmountLimits(proposal, mandate, context),
    () => evaluateTemporal(proposal, mandate, context),
    () => evaluateVelocity(proposal, mandate, context),
    () => evaluateCounterparty(proposal, mandate, attestations),
    () => evaluateGeographic(proposal, mandate, attestations)
  ]

  for (const step of pipeline) {
    const deny = step()
    if (deny) {
      return { allowed: false, denyReason: deny, evaluatedWithAttestations }
    }
  }
  return { allowed: true, evaluatedWithAttestations }
}
