// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

/**
 * Thrown by WDKPolicyAdapter.getSignedDecision() when the evaluator denies
 * the proposed transaction. Carries the structured DenyReason from the
 * signed PolicyEvaluationCredential — and, when the deny came back from
 * the sidecar, the full signed credential as `.credential` (audit-bearing
 * artifact, even on deny).
 *
 * @typedef {import('./types.js').DenyReason} DenyReason
 * @typedef {import('./types.js').PolicyEvaluationCredential} PolicyEvaluationCredential
 */
export class PolicyViolationError extends Error {
  /**
   * @param {string} message - Human-readable summary (matches denyReason.message).
   * @param {DenyReason | undefined} denyReason - Structured violation detail.
   * @param {PolicyEvaluationCredential} [credential] - The signed deny credential, when available.
   */
  constructor (message, denyReason, credential) {
    super(message)
    this.name = 'PolicyViolationError'
    /** @type {DenyReason | undefined} */
    this.denyReason = denyReason
    /** @type {PolicyEvaluationCredential | undefined} */
    this.credential = credential
  }
}
