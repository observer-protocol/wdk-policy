// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

/**
 * Local mirror of the types from @observer-protocol/policy-interface that
 * this module consumes. Kept here so the package has no required runtime
 * deps and stays self-contained. Authoritative source is AIP v0.8:
 *   https://github.com/observer-protocol/aip/blob/main/aip-v0.8-draft-1.md
 *
 * When @observer-protocol/policy-interface publishes to npm, callers MAY
 * import the canonical types from there; this file's shapes are kept in
 * sync with the spec by hand until then.
 */

/**
 * @typedef {'op_first_party' | 'sovereign_self_attested' | 'third_party_kyb' | 'partner' | 'peer_agent'} IssuerClass
 */

/**
 * @typedef {Object} DailyDrawdownCap
 * @property {number} limit
 * @property {'percent' | 'absolute'} type
 * @property {string} window
 */

/**
 * @typedef {Object} CounterpartyControls
 * @property {string[]} [allowList]
 * @property {string[]} [blockList]
 * @property {IssuerClass[]} [requireIssuerClassIn]
 */

/**
 * @typedef {Object} TimeWindow
 * @property {string} start
 * @property {string} end
 * @property {string} timezone
 * @property {Array<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'>} [daysOfWeek]
 */

/**
 * @typedef {Object} TemporalControls
 * @property {TimeWindow[]} [allowedTimeWindows]
 */

/**
 * @typedef {Object} GeographicControls
 * @property {string[]} [blockedJurisdictions]
 * @property {string[]} [allowedJurisdictionsOnly]
 */

/**
 * @typedef {Object} VelocityControls
 * @property {number} [dailyVolumeCap]
 * @property {number} [monthlyVolumeCap]
 */

/**
 * @typedef {Object} TradingMandate
 * @property {string[]} [allowedVenues]
 * @property {string[]} [allowedInstruments]
 * @property {number} [maxNotionalPerOrder]
 * @property {number} [maxPosition]
 * @property {string} [unit]
 * @property {DailyDrawdownCap} [dailyDrawdownCap]
 * @property {CounterpartyControls} [counterparty]
 * @property {TemporalControls} [temporal]
 * @property {GeographicControls} [geographic]
 * @property {VelocityControls} [velocity]
 */

/**
 * @typedef {Object} CredentialProof
 * @property {string} type
 * @property {string} created
 * @property {string} verificationMethod
 * @property {string} proofPurpose
 * @property {string} proofValue
 */

/**
 * @typedef {Object} ObserverDelegationCredentialSubject
 * @property {string} id
 * @property {TradingMandate} [tradingMandate]
 */

/**
 * @typedef {Object} ObserverDelegationCredential
 * @property {string} id
 * @property {string[]} type
 * @property {string} issuer
 * @property {string} validFrom
 * @property {string} [validUntil]
 * @property {ObserverDelegationCredentialSubject} credentialSubject
 * @property {CredentialProof} proof
 */

/**
 * @typedef {Object} AttestationContext
 * @property {string} counterparty
 * @property {IssuerClass} [issuerClass]
 * @property {string} [jurisdiction]
 */

/**
 * @typedef {'amountLimits' | 'counterparty' | 'temporal' | 'geographic' | 'velocity'} RuleType
 */

/**
 * @typedef {Object} DenyReason
 * @property {RuleType} ruleType
 * @property {string} ruleField
 * @property {string} message
 * @property {*} [currentValue]
 * @property {*} [proposedValue]
 */

/**
 * @typedef {Object} EvaluatedAgainst
 * @property {string} delegationCredentialId
 * @property {string} delegationCredentialHash
 */

/**
 * @typedef {Object} ProposalBinding
 * @property {string} proposalHash
 * @property {string} rail
 */

/**
 * @typedef {Object} Evaluator
 * @property {string} id
 * @property {string} version
 */

/**
 * @typedef {Object} PolicyEvaluationCredentialSubject
 * @property {'allow' | 'deny'} decision
 * @property {DenyReason} [denyReason]
 * @property {EvaluatedAgainst} evaluatedAgainst
 * @property {ProposalBinding} proposal
 * @property {Evaluator} evaluator
 * @property {string} evaluatedAt
 * @property {boolean} evaluatedWithAttestations
 */

/**
 * @typedef {Object} PolicyEvaluationCredential
 * @property {string} id
 * @property {string[]} type
 * @property {string} issuer
 * @property {string} validFrom
 * @property {PolicyEvaluationCredentialSubject} credentialSubject
 * @property {CredentialProof} proof
 */

// (no runtime exports — pure JSDoc typedef module)
export {}
