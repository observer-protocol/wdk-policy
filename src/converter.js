// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

/**
 * @typedef {Object} WDKTransaction
 * @property {string} sender - Source address (rail-native).
 * @property {string} recipient - Destination address (rail-native).
 * @property {string} value - Transaction amount as a string (BigInt-safe).
 * @property {string} asset - Unit / asset code (e.g. "USDT").
 * @property {string} [timestamp] - ISO 8601 timestamp. Defaults to current time.
 * @property {{ rail?: string }} [metadata] - Optional metadata. `rail` defaults to "tether-chain".
 * @property {string} [canonicalBytes] - Hex-encoded rail-native canonical pre-sign bytes. Required for getSignedDecision to bind the signed credential to this exact transaction.
 */

/**
 * Internal proposal shape consumed by the rule pipeline. Mirrors the
 * `EvaluationInput.proposal` shape from @observer-protocol/policy-interface
 * but flattens the semantic hints so the rule modules don't dig through
 * `humanReadable`.
 *
 * @typedef {Object} InternalProposal
 * @property {string} rail
 * @property {string} [canonicalBytes]
 * @property {Object} hints
 * @property {number} [hints.notional]
 * @property {string} [hints.unit]
 * @property {string} [hints.counterparty]
 * @property {string} [hints.counterpartyJurisdiction]
 */

/**
 * Convert a WDK transaction to the internal proposal shape used by the
 * rule pipeline.
 *
 * @param {WDKTransaction} wdkTx
 * @returns {InternalProposal}
 */
export function convertWDKTransaction (wdkTx) {
  if (!wdkTx || typeof wdkTx !== 'object') {
    throw new TypeError('convertWDKTransaction: wdkTx must be an object')
  }
  if (typeof wdkTx.sender !== 'string' || typeof wdkTx.recipient !== 'string') {
    throw new TypeError('convertWDKTransaction: wdkTx.sender and wdkTx.recipient must be strings')
  }

  // Parse value as a number for rule comparisons. WDK gives us a string to
  // avoid JS number truncation on very large values; for the cap comparisons
  // in v0.8 (USD-scale notionals), parseFloat is fine. Wallets working at
  // base-unit (e.g. wei) should convert to the mandate's denomination before
  // populating `value`.
  let notional
  if (typeof wdkTx.value === 'string' && wdkTx.value.length > 0) {
    const parsed = parseFloat(wdkTx.value)
    if (Number.isFinite(parsed)) notional = parsed
  } else if (typeof wdkTx.value === 'number' && Number.isFinite(wdkTx.value)) {
    notional = wdkTx.value
  }

  const rail = wdkTx.metadata?.rail ?? 'tether-chain'

  return {
    rail,
    canonicalBytes: wdkTx.canonicalBytes,
    hints: {
      notional,
      unit: wdkTx.asset,
      counterparty: wdkTx.recipient
      // counterpartyJurisdiction is not in the WDK shape — it comes from
      // the attestations parameter on the adapter call.
    }
  }
}
