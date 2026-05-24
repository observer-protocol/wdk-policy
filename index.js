// Copyright 2026 Observer Protocol, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

/** @typedef {import('./src/adapter.js').WDKPolicyAdapterConfig} WDKPolicyAdapterConfig */
/** @typedef {import('./src/converter.js').WDKTransaction} WDKTransaction */
/** @typedef {import('./src/evaluator.js').LocalEvaluationResult} LocalEvaluationResult */

export { WDKPolicyAdapter } from './src/adapter.js'
export { evaluateLocal } from './src/adapter.js'
export { PolicyViolationError } from './src/errors.js'
export { convertWDKTransaction } from './src/converter.js'
