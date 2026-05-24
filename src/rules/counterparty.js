// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

/**
 * @typedef {import('../types.js').TradingMandate} TradingMandate
 * @typedef {import('../types.js').DenyReason} DenyReason
 * @typedef {import('../types.js').AttestationContext} AttestationContext
 * @typedef {import('../converter.js').InternalProposal} InternalProposal
 */

/**
 * Counterparty controls per AIP v0.8 §2.1.
 *
 * Fail modes:
 *   - blockList: closed list; absent counterparty → skip
 *   - allowList: closed list; absent counterparty → DENY (fail-closed)
 *   - requireIssuerClassIn: set membership over issuer_class; if no
 *     attestation available, the rule is SKIPPED — the caller records
 *     evaluatedWithAttestations=false on the overall decision.
 *
 * @param {InternalProposal} proposal
 * @param {TradingMandate} mandate
 * @param {AttestationContext[]} [attestations]
 * @returns {DenyReason | null}
 */
export function evaluateCounterparty (proposal, mandate, attestations) {
  const cp = mandate.counterparty
  if (!cp) return null

  const counterparty = proposal.hints.counterparty

  // blockList — can only check when we have a counterparty.
  if (Array.isArray(cp.blockList) && cp.blockList.length > 0 && counterparty) {
    if (cp.blockList.includes(counterparty)) {
      return {
        ruleType: 'counterparty',
        ruleField: 'blockList',
        message: `Counterparty ${counterparty} is on the block list.`,
        currentValue: counterparty
      }
    }
  }

  // allowList — fail-closed.
  if (Array.isArray(cp.allowList) && cp.allowList.length > 0) {
    if (!counterparty) {
      return {
        ruleType: 'counterparty',
        ruleField: 'allowList',
        message: 'Mandate declares counterparty.allowList but proposal carries no counterparty hint; cannot evaluate, denying.'
      }
    }
    if (!cp.allowList.includes(counterparty)) {
      return {
        ruleType: 'counterparty',
        ruleField: 'allowList',
        message: `Counterparty ${counterparty} is not on the allow list.`,
        currentValue: counterparty
      }
    }
  }

  // requireIssuerClassIn — set membership; skip if no attestation.
  if (Array.isArray(cp.requireIssuerClassIn) && cp.requireIssuerClassIn.length > 0 && counterparty) {
    const att = (attestations ?? []).find(a => a.counterparty === counterparty)
    if (!att || !att.issuerClass) {
      // Skip — overall decision will note evaluatedWithAttestations=false.
      return null
    }
    if (!cp.requireIssuerClassIn.includes(att.issuerClass)) {
      return {
        ruleType: 'counterparty',
        ruleField: 'requireIssuerClassIn',
        message: `Counterparty issuer_class '${att.issuerClass}' is not in the required set (${cp.requireIssuerClassIn.join(', ')}).`,
        currentValue: att.issuerClass,
        proposedValue: cp.requireIssuerClassIn
      }
    }
  }

  return null
}
