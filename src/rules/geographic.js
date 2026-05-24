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
 * Geographic rule per AIP v0.8 §2.3.
 *
 * CRITICAL — asymmetric fail modes:
 *   - blockedJurisdictions:     fail-OPEN  when jurisdiction unknown (skip rule)
 *   - allowedJurisdictionsOnly: fail-CLOSED when jurisdiction unknown (deny)
 *
 * @param {InternalProposal} proposal
 * @param {TradingMandate} mandate
 * @param {AttestationContext[]} [attestations]
 * @returns {DenyReason | null}
 */
export function evaluateGeographic (proposal, mandate, attestations) {
  const geo = mandate.geographic
  if (!geo) return null

  const jurisdiction = resolveJurisdiction(proposal, attestations)

  // blockedJurisdictions — fail-OPEN when unknown.
  if (Array.isArray(geo.blockedJurisdictions) && geo.blockedJurisdictions.length > 0) {
    if (jurisdiction != null && geo.blockedJurisdictions.includes(jurisdiction)) {
      return {
        ruleType: 'geographic',
        ruleField: 'blockedJurisdictions',
        message: `Counterparty jurisdiction ${jurisdiction} is on the blocked list.`,
        currentValue: jurisdiction,
        proposedValue: geo.blockedJurisdictions
      }
    }
    // unknown → skip (fail-open).
  }

  // allowedJurisdictionsOnly — fail-CLOSED when unknown.
  if (Array.isArray(geo.allowedJurisdictionsOnly) && geo.allowedJurisdictionsOnly.length > 0) {
    if (jurisdiction == null) {
      return {
        ruleType: 'geographic',
        ruleField: 'allowedJurisdictionsOnly',
        message: 'Mandate declares allowedJurisdictionsOnly but counterparty jurisdiction is unknown; denying (fail-closed per AIP v0.8 §2.3).',
        proposedValue: geo.allowedJurisdictionsOnly
      }
    }
    if (!geo.allowedJurisdictionsOnly.includes(jurisdiction)) {
      return {
        ruleType: 'geographic',
        ruleField: 'allowedJurisdictionsOnly',
        message: `Counterparty jurisdiction ${jurisdiction} is not in the allowed-only list.`,
        currentValue: jurisdiction,
        proposedValue: geo.allowedJurisdictionsOnly
      }
    }
  }

  return null
}

/**
 * @param {InternalProposal} proposal
 * @param {AttestationContext[] | undefined} attestations
 */
function resolveJurisdiction (proposal, attestations) {
  const cp = proposal.hints.counterparty
  if (cp && Array.isArray(attestations)) {
    const att = attestations.find(a => a.counterparty === cp)
    if (att?.jurisdiction) return att.jurisdiction
  }
  return proposal.hints.counterpartyJurisdiction
}
