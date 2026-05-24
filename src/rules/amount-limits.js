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
 * @typedef {import('../converter.js').InternalProposal} InternalProposal
 * @typedef {import('../evaluator.js').EvaluatorContext} EvaluatorContext
 */

/**
 * Amount-limits rule per AIP v0.7 + v0.8 §2:
 *   - maxNotionalPerOrder
 *   - maxPosition (requires context.currentPosition)
 *   - dailyDrawdownCap (P&L state; deferred in v0.1)
 *
 * Fail-closed: if the mandate declares maxNotionalPerOrder but the
 * proposal carries no notional hint, deny.
 *
 * @param {InternalProposal} proposal
 * @param {TradingMandate} mandate
 * @param {EvaluatorContext} [context]
 * @returns {DenyReason | null}
 */
export function evaluateAmountLimits (proposal, mandate, context) {
  const { hints } = proposal

  // Unit consistency
  if (mandate.unit != null && hints.unit != null && hints.unit !== mandate.unit) {
    return {
      ruleType: 'amountLimits',
      ruleField: 'unit',
      message: `Proposal unit ${hints.unit} does not match mandate unit ${mandate.unit}.`,
      currentValue: hints.unit,
      proposedValue: mandate.unit
    }
  }

  // maxNotionalPerOrder
  if (mandate.maxNotionalPerOrder != null) {
    if (hints.notional == null) {
      return {
        ruleType: 'amountLimits',
        ruleField: 'maxNotionalPerOrder',
        message: 'Mandate declares maxNotionalPerOrder but proposal carries no notional hint; cannot evaluate, denying.'
      }
    }
    if (hints.notional > mandate.maxNotionalPerOrder) {
      return {
        ruleType: 'amountLimits',
        ruleField: 'maxNotionalPerOrder',
        message: `Proposed order notional ${hints.notional} ${mandate.unit ?? ''} exceeds maxNotionalPerOrder ${mandate.maxNotionalPerOrder} ${mandate.unit ?? ''}.`.trim(),
        currentValue: mandate.maxNotionalPerOrder,
        proposedValue: hints.notional
      }
    }
  }

  // maxPosition (stateful — skip without context)
  if (mandate.maxPosition != null && context?.currentPosition != null) {
    const newPosition = context.currentPosition + (hints.notional ?? 0)
    if (newPosition > mandate.maxPosition) {
      return {
        ruleType: 'amountLimits',
        ruleField: 'maxPosition',
        message: `Proposed order would bring open position to ${newPosition} ${mandate.unit ?? ''}, exceeding maxPosition ${mandate.maxPosition} ${mandate.unit ?? ''}.`.trim(),
        currentValue: context.currentPosition,
        proposedValue: newPosition
      }
    }
  }

  // dailyDrawdownCap — requires P&L state not modeled in v0.1.
  return null
}
