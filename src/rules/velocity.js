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
 * Velocity rule per AIP v0.8 §2.4.
 *
 * Stateful. Wallet-embedded callers without persistent state SHOULD pass
 * no context; the rule then skips and the server-side evaluator catches
 * any cap breach via defense-in-depth.
 *
 * @param {InternalProposal} proposal
 * @param {TradingMandate} mandate
 * @param {EvaluatorContext} [context]
 * @returns {DenyReason | null}
 */
export function evaluateVelocity (proposal, mandate, context) {
  const vel = mandate.velocity
  if (!vel) return null

  const notional = proposal.hints.notional ?? 0

  if (vel.dailyVolumeCap != null && context?.currentDailyVolume != null) {
    const newDaily = context.currentDailyVolume + notional
    if (newDaily > vel.dailyVolumeCap) {
      return {
        ruleType: 'velocity',
        ruleField: 'dailyVolumeCap',
        message: `Proposed transaction would bring 24h volume to ${newDaily} ${mandate.unit ?? ''}, exceeding dailyVolumeCap ${vel.dailyVolumeCap} ${mandate.unit ?? ''}.`.trim(),
        currentValue: context.currentDailyVolume,
        proposedValue: newDaily
      }
    }
  }

  if (vel.monthlyVolumeCap != null && context?.currentMonthlyVolume != null) {
    const newMonthly = context.currentMonthlyVolume + notional
    if (newMonthly > vel.monthlyVolumeCap) {
      return {
        ruleType: 'velocity',
        ruleField: 'monthlyVolumeCap',
        message: `Proposed transaction would bring 30d volume to ${newMonthly} ${mandate.unit ?? ''}, exceeding monthlyVolumeCap ${vel.monthlyVolumeCap} ${mandate.unit ?? ''}.`.trim(),
        currentValue: context.currentMonthlyVolume,
        proposedValue: newMonthly
      }
    }
  }

  return null
}
