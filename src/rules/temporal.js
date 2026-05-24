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
 * @typedef {import('../types.js').TimeWindow} TimeWindow
 * @typedef {import('../converter.js').InternalProposal} InternalProposal
 * @typedef {import('../evaluator.js').EvaluatorContext} EvaluatorContext
 */

/**
 * Convert a Date to local (hour, minute, day) in the named IANA timezone.
 * @param {Date} date
 * @param {string} timezone
 */
function toLocalParts (date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false
  })
  /** @type {Record<string, string>} */
  const parts = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  return {
    hour: parseInt(parts.hour ?? '0', 10) % 24,
    minute: parseInt(parts.minute ?? '0', 10),
    day: (parts.weekday ?? '').toLowerCase().slice(0, 3)
  }
}

/** @param {string} hhmm */
function parseHHMM (hhmm) {
  const [h = 0, m = 0] = hhmm.split(':').map(x => parseInt(x, 10))
  return h * 60 + m
}

/**
 * @param {{hour:number,minute:number,day:string}} now
 * @param {TimeWindow} window
 */
function withinWindow (now, window) {
  if (Array.isArray(window.daysOfWeek) && window.daysOfWeek.length > 0) {
    if (!window.daysOfWeek.some(d => d === now.day)) return false
  }
  const start = parseHHMM(window.start)
  const end = parseHHMM(window.end)
  const cur = now.hour * 60 + now.minute
  if (start <= end) return cur >= start && cur < end
  // Midnight-wrapping window (e.g. 22:00 → 06:00).
  return cur >= start || cur < end
}

/**
 * Temporal rule per AIP v0.8 §2.2.
 *
 * @param {InternalProposal} _proposal
 * @param {TradingMandate} mandate
 * @param {EvaluatorContext} [context]
 * @returns {DenyReason | null}
 */
export function evaluateTemporal (_proposal, mandate, context) {
  const windows = mandate.temporal?.allowedTimeWindows
  if (!Array.isArray(windows) || windows.length === 0) return null
  const now = context?.now ?? new Date()
  for (const w of windows) {
    if (withinWindow(toLocalParts(now, w.timezone), w)) return null
  }
  return {
    ruleType: 'temporal',
    ruleField: 'allowedTimeWindows',
    message: `Current time falls outside all ${windows.length} allowed time window(s).`,
    currentValue: now.toISOString()
  }
}
