/**
 * Salesforce Formula Engine - Test Cases
 *
 * Test data and expected results derived from the official Salesforce formula
 * engine test suite at: https://github.com/salesforce/formula-engine
 *
 * That project is licensed under the BSD 3-Clause License, reproduced below.
 * This file retains test expectations derived from that source and must carry
 * the following notice when redistributed:
 *
 * ---------------------------------------------------------------------------
 * Copyright (c) 2021, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * * Neither the name of Salesforce.com nor the names of its contributors may
 *   be used to endorse or promote products derived from this software without
 *   specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 * ---------------------------------------------------------------------------
 *
 * USAGE:
 *   Import this file into your test suite and iterate over the arrays.
 *   Each entry has: { formula, expected, description? }
 *   Some entries also have: { context } for field values needed.
 *
 * CONVENTIONS:
 *   - `null` means the formula should return null/undefined
 *   - Dates are represented as ISO strings "YYYY-MM-DD"
 *   - DateTimes are represented as ISO strings "YYYY-MM-DD HH:mm:ss" (GMT)
 *   - Times are represented as "HH:mm:ss.SSS"
 *   - `ERROR` means the formula should throw an error
 *   - Numbers use standard JS number type
 */

// ============================================================================
// OPERATOR TESTS
// ============================================================================

export const ADDITION_TESTS = [
  { formula: '1+37', expected: 38 },
  { formula: 'null + 37', expected: null, description: 'null propagates in arithmetic' },
  { formula: 'null * 37', expected: null },
  { formula: '3 + null', expected: null },
  { formula: 'true + true', expected: 'ERROR', description: 'boolean rejected in addition' },
  { formula: 'true + 1', expected: 'ERROR', description: 'boolean + number rejected' },
  { formula: '1 + false', expected: 'ERROR', description: 'number + boolean rejected' },
];

export const SUBTRACTION_TESTS = [
  { formula: '37-1', expected: 36 },
  { formula: '1-37', expected: -36 },
  { formula: 'true - 1', expected: 'ERROR', description: 'boolean rejected in subtraction' },
  { formula: '1 - "test"', expected: 'ERROR', description: 'string rejected in subtraction' },
  { formula: '"test" - 1', expected: 'ERROR', description: 'string rejected in subtraction (left)' },
  { formula: '"a" - "b"', expected: 'ERROR', description: 'string - string rejected' },
];

export const MULTIPLICATION_TESTS = [
  { formula: '1*37', expected: 37 },
  { formula: 'null*37', expected: null },
  { formula: 'true * 2', expected: 'ERROR', description: 'boolean rejected in multiplication' },
  { formula: '"test" * 2', expected: 'ERROR', description: 'string rejected in multiplication' },
  { formula: '2 * "test"', expected: 'ERROR', description: 'string rejected in multiplication (right)' },
];

export const DIVISION_TESTS = [
  { formula: '4/2', expected: 2 },
  { formula: '4/null', expected: null },
  { formula: 'null/4', expected: null },
  // Division by zero should throw an error
  { formula: '1/0', expected: 'ERROR', description: 'division by zero throws' },
  { formula: 'true / 2', expected: 'ERROR', description: 'boolean rejected in division' },
  { formula: '"test" / 2', expected: 'ERROR', description: 'string rejected in division' },
];

export const EXPONENT_TESTS = [
  { formula: '2^3', expected: 8 },
  { formula: '0^0', expected: 1 },
  { formula: '0.0^0.0', expected: 1 },
  // Overflow protection: 64^64 should throw (log10(64)*64 > 64)
  { formula: '64^64', expected: 'ERROR', description: 'power overflow' },
  { formula: 'true ^ 2', expected: 'ERROR', description: 'boolean rejected in exponent' },
  { formula: '"test" ^ 2', expected: 'ERROR', description: 'string rejected in exponent' },
];

export const UNARY_TESTS = [
  { formula: '+37', expected: 37 },
  { formula: '-37', expected: -37 },
  { formula: '-true', expected: 'ERROR', description: 'unary minus on boolean rejected' },
  { formula: '+"hello"', expected: 'ERROR', description: 'unary plus on string rejected' },
  { formula: '-"hello"', expected: 'ERROR', description: 'unary minus on string rejected' },
  { formula: '+true', expected: 'ERROR', description: 'unary plus on boolean rejected' },
  { formula: '!5', expected: 'ERROR', description: 'NOT on number rejected' },
  { formula: '!"hello"', expected: 'ERROR', description: 'NOT on string rejected' },
];

// ============================================================================
// OPERATOR PRECEDENCE TESTS (CRITICAL — verified from ANTLR grammar)
// ============================================================================

export const PRECEDENCE_TESTS = [
  // Standard: * / higher than + -
  { formula: '1 + 2 * 3 + 4 / 2', expected: 9, description: '1 + (2*3) + (4/2) = 1+6+2' },
  { formula: '(1 + 2) * (3 + 4) / 2', expected: 10.5, description: '3 * 7 / 2' },

  // CRITICAL: ^ is BELOW * / in Salesforce (unusual!)
  // In the real ANTLR grammar, multiplicativeExpression handles ^,
  // and exponentExpression (deeper/tighter) handles * /
  // So 2 * 3 ^ 4 = (2 * 3) ^ 4 = 6^4 = 1296
  {
    formula: '2 * 3 ^ 4',
    expected: 1296,
    description: 'SF precedence: * binds tighter than ^, so (2*3)^4 = 6^4 = 1296, NOT 2*(3^4)=162',
  },

  // ^ is LEFT-associative in Salesforce (unusual!)
  {
    formula: '2 ^ 3 ^ 2',
    expected: 64,
    description: 'SF: left-assoc, so (2^3)^2 = 8^2 = 64, NOT 2^(3^2)=2^9=512',
  },

  // & (concat) is at the SAME precedence level as + / -
  {
    formula: '1 + 2 & "x"',
    expected: '3x',
    description: '& is same level as +, left-assoc: (1+2)&"x" = "3x"',
  },
];

// ============================================================================
// EQUALITY / COMPARISON TESTS
// ============================================================================

export const EQUALITY_TESTS = [
  // Basic equality
  { formula: '1=1', expected: true },
  { formula: '37=1', expected: false },
  { formula: '"ab"="ab"', expected: true },
  { formula: '"ab"="ba"', expected: false },
  { formula: '"ab"=""', expected: false },

  // Null equality — STRING context: null coerced to ""
  { formula: 'null=""', expected: true, description: 'string context: null = "" is true' },
  { formula: 'null="ab"', expected: false, description: 'string context: null coerced to ""' },

  // Not-equal
  { formula: '1 <> 1', expected: false },
  { formula: '37<>1', expected: true },
  { formula: '"ab"<>"ab"', expected: false },
  { formula: '"ab"<>"ba"', expected: true },
  { formula: '"ab"<>""', expected: true },
  { formula: 'null<>""', expected: false, description: 'string context: null = ""' },
  { formula: 'null<>"ab"', expected: true },

  // Null equality — NUMERIC context: three-valued logic (returns null)
  { formula: '37=null', expected: null, description: 'numeric context: null propagates' },
  { formula: '37<>null', expected: null },
];

export const COMPARISON_TESTS = [
  { formula: '1<37', expected: true },
  { formula: '37<37', expected: false },
  { formula: '37<null', expected: null, description: 'null propagates in comparisons' },
  { formula: '38>37', expected: true },
  { formula: '37>37', expected: false },
  { formula: '37<=37', expected: true },
  { formula: '38<=37', expected: false },
  { formula: 'null<=37', expected: null },
  { formula: '37>=37', expected: true },
  { formula: '36>=37', expected: false },

  // String comparison (lexicographic, case-sensitive)
  { formula: '"5" > "4"', expected: true },
  { formula: '"5" <= "4"', expected: false },
  { formula: '"Foo" > "FOO"', expected: true, description: 'lowercase > uppercase in ASCII' },
  { formula: '"Foo" > null', expected: null },
  { formula: 'null > "foo"', expected: null },

  // Date comparison
  { formula: 'date(2014, 3, 20) <= date(2015, 3, 20)', expected: true },
  { formula: 'date(2015, 3, 20) <= date(2015, 3, 20)', expected: true },
  { formula: 'null <= date(2015, 3, 20)', expected: null },

  // Time comparison
  { formula: 'timeValue("12:34:56.789") = timeValue("12:34:56.789")', expected: true },
  { formula: 'timeValue("01:34:56.789") = timeValue("12:34:56.789")', expected: false },
  { formula: 'timeValue("01:34:56.789") < timeValue("12:34:56.789")', expected: true },
  { formula: 'timeValue("01:34:56.789") > timeValue("12:34:56.789")', expected: false },
];

// ============================================================================
// STRING CONCATENATION TESTS
// ============================================================================

export const CONCAT_TESTS = [
  { formula: '"abc" & "def"', expected: 'abcdef' },
  { formula: '"abc" & null', expected: 'abc', description: 'null treated as "" in concat' },
  { formula: 'null & "abc"', expected: 'abc' },
];

// ============================================================================
// BOOLEAN TESTS
// ============================================================================

export const BOOLEAN_TESTS = [
  { formula: 'true', expected: true },
  { formula: 'false', expected: false },
  { formula: 'null', expected: null },
  { formula: '3+null', expected: null },
];

// ============================================================================
// LOGICAL FUNCTION TESTS
// ============================================================================

export const NOT_TESTS = [
  { formula: 'not false', expected: true },
  { formula: 'not(1=1)', expected: false },
  { formula: 'not(null)', expected: null, description: 'NOT preserves null (unlike AND/OR)' },
];

export const AND_TESTS = [
  { formula: 'and(true, true)', expected: true },
  { formula: 'and(1=1, 1=0)', expected: false },
  { formula: 'and(1=1, 3<37, 8<>12)', expected: true, description: 'variadic AND' },
  { formula: 'and(1=1, 3<37, null)', expected: false, description: 'null treated as false in AND' },
  { formula: 'and(1=1, 3>37, null)', expected: false },
  { formula: 'and(1<>1, 1/0=0)', expected: false, description: 'short-circuit: 1/0 never evaluated' },
];

export const OR_TESTS = [
  { formula: 'or(true, false)', expected: true },
  { formula: 'or(1=37, 1=0)', expected: false },
  { formula: 'or(1=0, 3>37, 8=12)', expected: false },
  { formula: 'or(1=0, 3>37, null)', expected: false, description: 'null treated as false in OR' },
  { formula: 'or(1=0, 3<37, null)', expected: true },
  { formula: 'or(1=1, 1/0=0)', expected: true, description: 'short-circuit: 1/0 never evaluated' },
];

// ============================================================================
// IF / IFS / CASE TESTS
// ============================================================================

export const IF_TESTS = [
  { formula: 'if(1=1, 1, 0)', expected: 1 },
  { formula: 'if(1=37, 1, 0)', expected: 0 },
  { formula: '5=if(1=37, 1, 0)', expected: false },
  { formula: 'if(true, 1, null)', expected: 1 },
  { formula: 'if(false, 1/0, 37)', expected: 37, description: 'lazy: false branch not evaluated' },
  { formula: 'if(true, 37, 1/0)', expected: 37, description: 'lazy: false branch not evaluated' },
  { formula: 'if(1=null, 1, 0)', expected: 0, description: 'null condition = false' },
];

export const IFS_TESTS = [
  { formula: 'ifs(1=1, 1, 0)', expected: 1 },
  { formula: 'ifs(1=37, 1, 0)', expected: 0 },
  { formula: 'ifs(1=37, 1, 2=37, 2, 0)', expected: 0 },
  { formula: 'ifs(1=37, 1, 2<>37, 2, 0)', expected: 2 },
  { formula: '5=ifs(1=37, 1, 0)', expected: false },
  { formula: 'ifs(true, 1, null)', expected: 1 },
  { formula: 'ifs(false, 1/0, 37)', expected: 37, description: 'lazy: false branch not evaluated' },
  { formula: 'ifs(true, 37, 1/0)', expected: 37, description: 'lazy: unused branch not evaluated' },
  { formula: 'ifs(1=null, 1, 0)', expected: 0, description: 'null condition = false' },
];

export const IFS_ERROR_TESTS = [
  // IFS requires odd number of args, minimum 3
  { formula: 'ifs()', expected: 'ERROR', description: 'wrong number of arguments (0)' },
  { formula: 'ifs(null)', expected: 'ERROR', description: 'wrong number of arguments (1)' },
  { formula: 'ifs(null, 1)', expected: 'ERROR', description: 'wrong number of arguments (2)' },
  { formula: 'ifs(null, 1, null, 1)', expected: 'ERROR', description: 'wrong number of arguments (4)' },
];

export const CASE_TESTS = [
  { formula: 'case(10, 9, 0, 10, 1, 11, 0, 2)', expected: 1 },
  { formula: 'case(37, 9, 0, 10, 1, 11, 0, 2)', expected: 2, description: 'no match = else' },
  { formula: '1=case(10, 9, 0, 10, 1, 11, 0, 2)', expected: true },
  {
    formula: 'case(10, 9, "groucho", 10, "chico", 11, "harpo", "zeppo")',
    expected: 'chico',
  },
  { formula: 'case(null, 9, 0, 10, 1, 11, 0, 2)', expected: 2, description: 'null expr = else' },
  { formula: 'case(35, null, 0, 10, 1, 11, 0, 2)', expected: 2, description: 'null when = no match' },
  { formula: 'case(9, 9, 0, 10, null, 2)', expected: 0, description: 'null in unmatched result is fine' },
  {
    formula: 'ABS(CASE(DATE(2004,12,5),DATE(2004,12,4),200,DATE(2004,12,4),300,400))',
    expected: 400,
  },
  {
    formula: 'ABS(CASE(NULL,NULL,200,DATE(2004,12,4),300,400))',
    expected: 400,
    description: 'CASE null = null goes to else',
  },
];

// ============================================================================
// NULL HANDLING FUNCTION TESTS
// ============================================================================

export const ISNULL_TESTS = [
  { formula: 'isnull(null)', expected: true },
  { formula: 'isnull(5)', expected: false },
  { formula: 'isnull(if(true, null, 37))', expected: true },
  { formula: 'isnull("abc")', expected: false },
  { formula: 'isnull("")', expected: false, description: 'empty string is NOT null' },
  { formula: 'isnull(if(true, null, "abc"))', expected: true },
];

export const NULLVALUE_TESTS = [
  { formula: 'nullvalue(37, 6)', expected: 37, description: 'non-null returns first arg' },
  { formula: 'nullvalue(null, 6)', expected: 6, description: 'null returns second arg' },
  { formula: '5 = nullvalue(null, 6)', expected: false },
  { formula: 'nullvalue("abc", "123")', expected: 'abc' },
  // Note: NULLVALUE with string type has special behavior
  // In the real engine, string-typed NULLVALUE is optimized away
  { formula: 'nullvalue("", "123")', expected: null, description: 'NULLVALUE: empty string in string context' },
  { formula: 'nullvalue(null, "123")', expected: null, description: 'NULLVALUE: null string context' },
];

// ============================================================================
// MATH FUNCTION TESTS
// ============================================================================

export const ABS_TESTS = [
  { formula: 'abs(3.5)', expected: 3.5 },
  { formula: 'abs(-3.5)', expected: 3.5 },
];

export const SQRT_TESTS = [{ formula: 'sqrt(16)', expected: 4 }];

export const EXP_LN_LOG_TESTS = [
  { formula: 'exp(ln(36))', expected: 36 },
  { formula: 'ln(exp(3))', expected: 3 },
  { formula: 'log(100)', expected: 2 },
  { formula: 'log(abs(100))', expected: 2 },
  { formula: 'abs(log(100))', expected: 2 },
  { formula: 'abs(log(sqrt(9000+1000)))', expected: 2 },
];

export const MOD_TESTS = [
  { formula: 'mod(100, 10)', expected: 0 },
  { formula: 'mod(-101, 10)', expected: -1, description: 'sign follows dividend (Java remainder)' },
  { formula: 'mod(100.5, -10)', expected: 0.5 },
];

export const MAX_TESTS = [
  { formula: 'max(100, 10)', expected: 100 },
  { formula: 'max(100*5, -10)', expected: 500 },
  { formula: 'max(-101, 10)', expected: 10 },
  { formula: 'max(100.5, -10)', expected: 100.5 },
  { formula: 'max(100, -10, 1000)', expected: 1000, description: 'variadic max' },
  { formula: 'max(100.5, null, -10)', expected: null, description: 'null propagates in MAX' },
];

export const MIN_TESTS = [
  { formula: 'min(100, 10)', expected: 10 },
  { formula: 'min(-101, 10)', expected: -101 },
  { formula: 'min(-100.5, -10)', expected: -100.5 },
  { formula: 'min(100, 10, 1000)', expected: 10, description: 'variadic min' },
  { formula: 'min(100.5, null, -10)', expected: null, description: 'null propagates in MIN' },
];

export const ROUND_TESTS = [
  { formula: 'round(1.13, 1)', expected: 1.1 },
  { formula: 'round(-1.13, 1)', expected: -1.1 },
  { formula: 'round(1.17, 1)', expected: 1.2 },
  { formula: 'round(-1.17, 1)', expected: -1.2 },
  { formula: 'round(1.13, 0)', expected: 1 },
  { formula: 'round(0.00, 0)', expected: 0 },
  { formula: 'round(0.0001, 4)', expected: 0.0001 },
  { formula: 'round(0.0006, 3)', expected: 0.001 },
  { formula: 'round(-0.0006, 3)', expected: -0.001 },
  { formula: 'round(0, 3)', expected: 0 },
  { formula: 'round(0, -2)', expected: 0 },
  { formula: 'round(-123456.3335, -2)', expected: -123500, description: 'negative scale' },
];

export const CEILING_TESTS = [
  // CEILING: rounds toward ZERO for negatives (NOT Math.ceil!)
  { formula: 'ceiling(1.3)', expected: 2 },
  { formula: 'ceiling(1.7)', expected: 2 },
  { formula: 'ceiling(-1.3)', expected: -2, description: 'toward zero = away from zero, rounds UP magnitude' },
  { formula: 'ceiling(-1.7)', expected: -2 },
  { formula: 'ceiling(0.07)', expected: 1 },
  { formula: 'ceiling(-0.07)', expected: -1 },
  { formula: 'ceiling(0)', expected: 0 },
  { formula: 'ceiling(null)', expected: null },
  { formula: 'ceiling(6/11*11)', expected: 6, description: 'pre-rounds to avoid float noise' },
];

export const FLOOR_TESTS = [
  // FLOOR: rounds toward ZERO for negatives (NOT Math.floor!)
  { formula: 'floor(1.3)', expected: 1 },
  { formula: 'floor(1.7)', expected: 1 },
  { formula: 'floor(-1.3)', expected: -1, description: 'toward zero = rounds DOWN magnitude' },
  { formula: 'floor(-1.7)', expected: -1 },
  { formula: 'floor(0.07)', expected: 0 },
  { formula: 'floor(-0.07)', expected: 0 },
  { formula: 'floor(0)', expected: 0 },
  { formula: 'floor(null)', expected: null },
  { formula: 'floor(6/11*11)', expected: 6, description: 'pre-rounds to avoid float noise' },
];

export const MCEILING_TESTS = [
  // MCEILING: true mathematical ceiling (always toward +infinity)
  // Same as Math.ceil()
  { formula: 'mceiling(1.3)', expected: 2 },
  { formula: 'mceiling(1.7)', expected: 2 },
  { formula: 'mceiling(-1.3)', expected: -1, description: 'Math.ceil(-1.3) = -1' },
  { formula: 'mceiling(-1.7)', expected: -1, description: 'Math.ceil(-1.7) = -1' },
  { formula: 'mceiling(0.07)', expected: 1 },
  { formula: 'mceiling(-0.07)', expected: 0, description: 'Math.ceil(-0.07) = 0' },
  { formula: 'mceiling(0)', expected: 0 },
  { formula: 'mceiling(null)', expected: null },
  { formula: 'mceiling(6/11*11)', expected: 6 },
];

export const MFLOOR_TESTS = [
  // MFLOOR: true mathematical floor (always toward -infinity)
  // Same as Math.floor()
  { formula: 'mfloor(1.3)', expected: 1 },
  { formula: 'mfloor(1.7)', expected: 1 },
  { formula: 'mfloor(-1.3)', expected: -2, description: 'Math.floor(-1.3) = -2' },
  { formula: 'mfloor(-1.7)', expected: -2, description: 'Math.floor(-1.7) = -2' },
  { formula: 'mfloor(0.07)', expected: 0 },
  { formula: 'mfloor(-0.07)', expected: -1, description: 'Math.floor(-0.07) = -1' },
  { formula: 'mfloor(0)', expected: 0 },
  { formula: 'mfloor(null)', expected: null },
  { formula: 'mfloor(6/11*11)', expected: 6 },
];

export const PI_TESTS = [{ formula: 'ROUND(PI(),7)', expected: 3.1415927 }];

// ============================================================================
// TEXT FUNCTION TESTS
// ============================================================================

export const TEXT_TESTS = [
  { formula: 'text(123456)', expected: '123456' },
  { formula: 'text(date(1968, 12, 20))', expected: '1968-12-20' },
];

export const VALUE_TESTS = [{ formula: 'value("123456")', expected: 123456 }];

export const LEN_TESTS = [
  { formula: 'len("123456")', expected: 6 },
  { formula: 'len(null)', expected: 0, description: 'LEN(null) = 0, not null' },
  { formula: 'len("")', expected: 0 },
];

export const BEGINS_TESTS = [
  { formula: 'begins("123456", "123")', expected: true },
  { formula: 'begins("123456", "23")', expected: false },
  { formula: 'begins("123456", "")', expected: true, description: 'empty search = true' },
  { formula: 'begins("123456", null)', expected: true, description: 'null search = true' },
  { formula: 'begins(null, null)', expected: true },
  { formula: 'begins("", "123")', expected: null, description: 'empty/null source = null' },
  { formula: 'begins(null, "123")', expected: null },
];

export const CONTAINS_TESTS = [
  { formula: 'contains("123456", "23")', expected: true },
  { formula: 'contains("123456", "123")', expected: true },
  { formula: 'contains("123456", "235")', expected: false },
  { formula: 'contains("123456", "")', expected: true, description: 'empty search = true' },
  { formula: 'contains("123456", null)', expected: true, description: 'null search = true' },
  { formula: 'contains(null, null)', expected: true },
  { formula: 'contains(null, "235")', expected: null, description: 'null source = null' },
  { formula: 'contains("", "235")', expected: null, description: 'empty source = null' },
];

export const LEFT_TESTS = [
  { formula: 'left("123456", 3)', expected: '123' },
  { formula: 'left("123456", 37)', expected: '123456', description: 'n > length = entire string' },
  { formula: 'left("", 37)', expected: null, description: 'empty source = null' },
  { formula: 'left("123456", 0)', expected: null, description: 'n=0 = null' },
  { formula: 'left("123456", -2)', expected: null, description: 'negative n = null' },
  { formula: 'left(null, 3)', expected: null },
];

export const RIGHT_TESTS = [
  { formula: 'right("123456", 3)', expected: '456' },
  { formula: 'right("123456", 37)', expected: '123456', description: 'n > length = entire string' },
  { formula: 'right("", 37)', expected: null, description: 'empty source = null' },
  { formula: 'right("123456", 0)', expected: null, description: 'n=0 = null' },
  { formula: 'right("123456", -2)', expected: null, description: 'negative n = null' },
  { formula: 'right(null, 3)', expected: null },
];

export const MID_TESTS = [
  // MID is 1-based
  { formula: 'mid("123456", 4, 2)', expected: '45' },
  { formula: 'mid("123456", 4, 37)', expected: '456', description: 'length exceeds string = to end' },
  { formula: 'mid("123456", -4, 2)', expected: '12', description: 'negative start clamped to 1' },
  { formula: 'mid("123456", 0, 2)', expected: '12', description: 'zero start clamped to 1' },
  { formula: 'mid("123456", 2, -2)', expected: null, description: 'negative length = null' },
  { formula: 'mid("123456", 2, 0)', expected: null, description: 'zero length = null' },
  { formula: 'mid("", 4, 2)', expected: null, description: 'empty source = null' },
  { formula: 'mid("123456", 4, null)', expected: null },
  { formula: 'mid("123456", 37, 2)', expected: null, description: 'start beyond string = null' },
  { formula: 'mid("123456", null, 2)', expected: null },
];

export const FIND_TESTS = [
  // FIND is 1-based, returns 0 if not found
  { formula: 'find("asman", "Doug Chasman")', expected: 8 },
  { formula: 'find("w", "Something wicked this way comes", 15)', expected: 23, description: 'with start position' },
  { formula: 'find("apple", "Doug Chasman")', expected: 0, description: 'not found = 0' },
];

export const TRIM_TESTS = [
  { formula: 'trim("  1234  ")', expected: '1234' },
  { formula: 'trim("    ")', expected: null, description: 'all whitespace = null' },
  { formula: 'trim("")', expected: null, description: 'empty = null' },
  { formula: 'trim(null)', expected: null },
];

export const UPPER_TESTS = [
  { formula: 'UPPER(null)', expected: null },
  { formula: 'UPPER("string")', expected: 'STRING' },
  { formula: 'UPPER("STRING")', expected: 'STRING' },
  { formula: 'UPPER("StRiNg ")', expected: 'STRING ' },
];

export const LOWER_TESTS = [
  { formula: 'LOWER(null)', expected: null },
  { formula: 'LOWER("string")', expected: 'string' },
  { formula: 'LOWER("STRING")', expected: 'string' },
  { formula: 'LOWER("StRiNg ")', expected: 'string ' },
];

export const SUBSTITUTE_TESTS = [
  // SUBSTITUTE(source, old, new)
  // null source → null, null old → null, null new → treated as ""
  { formula: 'SUBSTITUTE("Hello World", "World", "Earth")', expected: 'Hello Earth' },
  { formula: 'SUBSTITUTE("Hello; Text;", ";", "")', expected: 'Hello Text' },
];

export const RPAD_TESTS = [
  { formula: 'rpad("string",0)', expected: null },
  { formula: 'rpad("string",1)', expected: 's', description: 'truncates if shorter than length' },
  { formula: 'rpad("string",5)', expected: 'strin' },
  { formula: 'rpad("string",6)', expected: 'string', description: 'exact length = no padding' },
  { formula: 'rpad("string",7)', expected: 'string ', description: 'pads with space by default' },
  { formula: 'rpad("string",8)', expected: 'string  ' },
  { formula: 'rpad("string",0,"x")', expected: null },
  { formula: 'rpad("string",1,"x")', expected: 's' },
  { formula: 'rpad("string",6,"x")', expected: 'string' },
  { formula: 'rpad("string",7,"x")', expected: 'stringx' },
  { formula: 'rpad("string",8,"x")', expected: 'stringxx' },
  { formula: 'rpad("string",7,",.;")', expected: 'string,' },
  { formula: 'rpad("string",8,",.;")', expected: 'string,.' },
  { formula: 'rpad("string",9,",.;")', expected: 'string,.;' },
  { formula: 'rpad("string",10,",.;")', expected: 'string,.;,' },
  { formula: 'rpad("string",15,",.;")', expected: 'string,.;,.;,.;' },
];

export const LPAD_TESTS = [
  { formula: 'lpad("string",0)', expected: null },
  { formula: 'lpad("string",1)', expected: 's', description: 'truncates if shorter than length' },
  { formula: 'lpad("string",5)', expected: 'strin' },
  { formula: 'lpad("string",6)', expected: 'string', description: 'exact length = no padding' },
  { formula: 'lpad("string",7)', expected: ' string', description: 'pads with space by default' },
  { formula: 'lpad("string",8)', expected: '  string' },
  { formula: 'lpad("string",0,"x")', expected: null },
  { formula: 'lpad("string",1,"x")', expected: 's' },
  { formula: 'lpad("string",6,"x")', expected: 'string' },
  { formula: 'lpad("string",7,"x")', expected: 'xstring' },
  { formula: 'lpad("string",8,"x")', expected: 'xxstring' },
  { formula: 'lpad("string",7,",.;")', expected: ',string' },
  { formula: 'lpad("string",8,",.;")', expected: ',.string' },
  { formula: 'lpad("string",9,",.;")', expected: ',.;string' },
  { formula: 'lpad("string",10,",.;")', expected: ',.;,string' },
  { formula: 'lpad("string",15,",.;")', expected: ',.;,.;,.;string' },
];

export const ISNUMBER_TESTS = [
  { formula: 'ISNUMBER("")', expected: false },
  { formula: 'ISNUMBER("5")', expected: true },
  { formula: 'ISNUMBER("5.0")', expected: true },
  { formula: 'ISNUMBER("+5.0")', expected: true },
  { formula: 'ISNUMBER("-5.0")', expected: true },
  { formula: 'ISNUMBER("No")', expected: false },
];

// ============================================================================
// DATE / TIME FUNCTION TESTS
// ============================================================================

export const DATE_TESTS = [
  { formula: 'date(1958, 1, 15)', expected: '1958-01-15' },
  { formula: 'date(1958, null, 15)', expected: null },
];

export const DAY_TESTS = [
  { formula: 'day(date(1958, 1, 15))', expected: 15 },
  { formula: 'day(null)', expected: null },
];

export const MONTH_TESTS = [
  { formula: 'month(date(1958, 1, 15))', expected: 1 },
  { formula: 'month(null)', expected: null },
];

export const YEAR_TESTS = [
  { formula: 'year(date(1958, 1, 15))', expected: 1958 },
  { formula: 'year(null)', expected: null },
];

export const WEEKDAY_TESTS = [
  // 1=Sunday, 2=Monday, ..., 7=Saturday
  { formula: 'WEEKDAY(DATE(2016,11,3))', expected: 5, description: 'Thursday = 5' },
  { formula: 'WEEKDAY(DATE(1969,2,12))', expected: 4, description: 'Wednesday = 4' },
];

export const ADDMONTHS_TESTS = [
  // End-of-month semantics
  { formula: 'ADDMONTHS(date(2020, 1, 31), 1)', expected: '2020-02-29', description: 'Jan 31 + 1mo = Feb 29 (2020 leap)' },
  { formula: 'ADDMONTHS(date(2020, 4, 30), 3)', expected: '2020-07-31', description: 'Apr 30 + 3mo = Jul 31 (last day)' },
  { formula: 'ADDMONTHS(date(2019, 2, 28), -1)', expected: '2019-01-31', description: 'Feb 28 - 1mo = Jan 31 (last day)' },
  { formula: 'ADDMONTHS(date(2020, 7, 31), -3)', expected: '2020-04-30', description: 'Jul 31 - 3mo = Apr 30 (last day)' },
  { formula: 'ADDMONTHS(date(2020, 1, 30), 1)', expected: '2020-02-29', description: 'Jan 30 + 1mo = Feb 29' },
  { formula: 'ADDMONTHS(date(2020, 5, 30), -3)', expected: '2020-02-29', description: 'May 30 - 3mo = Feb 29' },
  // Non-end-of-month (day preserved)
  { formula: 'ADDMONTHS(date(2020, 1, 25), 1)', expected: '2020-02-25' },
  { formula: 'ADDMONTHS(date(2020, 5, 10), -3)', expected: '2020-02-10' },
  // Fractional months truncated
  { formula: 'ADDMONTHS(date(2020, 1, 25), 0.5)', expected: '2020-01-25', description: 'fractional months truncated to 0' },
  { formula: 'ADDMONTHS(date(2020, 2, 29), -0.8)', expected: '2020-02-29', description: 'fractional months truncated to 0' },
];

export const DATEVALUE_TESTS = [
  // dateValue on dateTimeValue
  { formula: 'dateValue(dateTimeValue("2004-12-31 11:32:10"))', expected: '2004-12-31' },
];

export const DATETIMEVALUE_TESTS = [
  { formula: 'DATETIMEVALUE("2016-02-29 13:15:10")', expected: '2016-02-29 13:15:10' },
  // Lenient month/day parsing (single digits OK)
  { formula: 'DATETIMEVALUE("2016-3-1 13:15:10")', expected: '2016-03-01 13:15:10' },
  // Trailing space OK
  { formula: 'DATETIMEVALUE("2016-3-1 13:15:10 ")', expected: '2016-03-01 13:15:10' },
];

export const TIMEVALUE_TESTS = [
  { formula: 'timeValue("12:34:56.789")', expected: '12:34:56.789' },
  // Adding 86400000ms (24h) to a time wraps around
  { formula: '(timeValue("12:34:56.789")+86400000) = timeValue("12:34:56.789")', expected: true, description: 'time wraps at 24h' },
  // Invalid format
  { formula: 'timeValue("12:34:56.789Z")', expected: 'ERROR', description: 'Z suffix not allowed' },
];

// ============================================================================
// DATE ARITHMETIC TESTS
// ============================================================================

export const DATE_ARITHMETIC_TESTS = [
  // Date + Number (fractional days truncated for Date)
  { formula: 'date(2005, 4, 5) + 0.7', expected: '2005-04-05', description: 'truncated: +0 days' },
  { formula: 'date(2005, 4, 5) + 1.9', expected: '2005-04-06', description: 'truncated: +1 day' },
  { formula: 'date(2005, 4, 5) + 0.5 + 0.5', expected: '2005-04-05', description: 'each add truncated separately' },
  { formula: 'date(2005, 4, 5) + (0.5 + 0.5)', expected: '2005-04-06', description: 'sum=1 then truncated: +1 day' },
  { formula: 'date(2005, 4, 5) + (-0.7)', expected: '2005-04-05', description: 'truncated toward zero: +0 days' },
  { formula: 'date(2005, 4, 5) + (-1.9)', expected: '2005-04-04', description: 'truncated toward zero: -1 day' },

  // Date + Date → error (Salesforce rejects this)
  { formula: 'date(2005, 4, 5) + date(2005, 4, 1)', expected: 'ERROR', description: 'Date + Date rejected' },
  {
    formula: 'DATETIMEVALUE("2016-02-29 13:15:10") + DATETIMEVALUE("2016-03-01 13:15:10")',
    expected: 'ERROR',
    description: 'DateTime + DateTime rejected',
  },

  // Date - Date (returns number of days)
  { formula: 'date(2005, 4, 5) - date(2005, 4, 1)', expected: 4 },
  { formula: 'date(2005, 4, 10) - date(2005, 4, 9)', expected: 1 },

  // DateTime arithmetic
  { formula: 'DATETIMEVALUE("2016-02-29 13:15:10")+1.0', expected: '2016-03-01 13:15:10', description: '+1 day' },
  { formula: 'DATETIMEVALUE("2016-02-29 13:15:10")-1.0', expected: '2016-02-28 13:15:10', description: '-1 day' },
  { formula: 'DATETIMEVALUE("2016-02-29 13:15:10")+0.166667', expected: '2016-02-29 17:15:10', description: '+~4 hours' },
  { formula: '1.0+DATETIMEVALUE("2016-02-29 13:15:10")', expected: '2016-03-01 13:15:10', description: 'commutative' },
  { formula: '3.6+DATETIMEVALUE("2016-02-29 13:15:10")', expected: '2016-03-04 03:39:10', description: '+3.6 days' },

  // DateValue from DateTime arithmetic
  { formula: 'dateValue(dateTimeValue("2004-12-31 11:32:10")+3.00)', expected: '2005-01-03' },
  { formula: 'dateValue(dateTimeValue("2004-12-31 11:32:10")+3.60)', expected: '2005-01-04' },
  { formula: 'dateValue(dateTimeValue("2004-02-28 10:34:00")+4.60)', expected: '2004-03-04' },

  // Date/Time type guard errors
  { formula: 'date(2005, 4, 5) + true', expected: 'ERROR', description: 'Date + Boolean rejected' },
  { formula: '"text" - date(2005, 4, 5)', expected: 'ERROR', description: 'String - Date rejected' },
  { formula: 'true - date(2005, 4, 5)', expected: 'ERROR', description: 'Boolean - Date rejected' },
  { formula: 'date(2005, 4, 5) - "text"', expected: 'ERROR', description: 'Date - String rejected' },
  { formula: 'date(2005, 4, 5) - true', expected: 'ERROR', description: 'Date - Boolean rejected' },

  // Time + Number / Time - Number
  { formula: 'timeValue("08:34:56.789") + 3600000', expected: 34496789, description: 'Time + 1h in ms' },
  { formula: 'timeValue("08:34:56.789") - 3600000', expected: 27296789, description: 'Time - 1h in ms' },

  // Time + Time → error (can subtract but not add)
  { formula: 'timeValue("08:34:56.789") + timeValue("06:34:56.789")', expected: 'ERROR', description: 'Time + Time rejected' },
  { formula: '"text" - timeValue("08:34:56.789")', expected: 'ERROR', description: 'String - Time rejected' },

  // Time arithmetic (milliseconds)
  { formula: 'timeValue("08:34:56.789") - timeValue("06:34:56.789")', expected: 7200000, description: '2h in ms' },
  {
    formula: 'timeValue("10:34:56.789") - timeValue("12:34:56.789")',
    expected: 79200000,
    description: '22h in ms (wraps: (t1-t2+86400000)%86400000)',
  },
  { formula: 'timeValue("12:34:56.789") - timeValue("12:34:56.789")', expected: 0 },
];

// ============================================================================
// OPTIONAL / EXTENDED FUNCTION TESTS
// ============================================================================

export const CHR_ASCII_TESTS = [
  { formula: 'CHR(0)', expected: null },
  { formula: 'CHR(32)', expected: ' ' },
  { formula: 'CHR(-32)', expected: null },
  { formula: 'ASCII(null)', expected: null },
  { formula: 'ASCII("")', expected: null },
  { formula: 'ASCII(" ")', expected: 32 },
];

export const INITCAP_TESTS = [
  { formula: 'INITCAP("mr. smith")', expected: 'Mr. Smith' },
  { formula: 'INITCAP("mr. 123smith")', expected: 'Mr. 123smith' },
  { formula: 'INITCAP("mr. _smith")', expected: 'Mr. _Smith' },
];

export const DAYOFYEAR_TESTS = [
  { formula: 'DAYOFYEAR(date(2005, 4, 5))', expected: 95 },
  { formula: 'DAYOFYEAR(date(2005, 12, 31))', expected: 365 },
  { formula: 'DAYOFYEAR(date(2006, 1, 1))', expected: 1 },
  { formula: 'DAYOFYEAR(date(2008, 12, 31))', expected: 366, description: 'leap year' },
];

export const ISOWEEK_TESTS = [
  { formula: 'ISOWEEK(date(2005, 4, 5))', expected: 14 },
  { formula: 'ISOWEEK(date(2005, 12, 31))', expected: 52 },
  { formula: 'ISOWEEK(date(2006, 1, 1))', expected: 52, description: 'Jan 1 can be in prev year ISO week' },
];

export const ISOYEAR_TESTS = [
  { formula: 'ISOYEAR(date(2005, 4, 5))', expected: 2005 },
  { formula: 'ISOYEAR(date(2005, 12, 31))', expected: 2005 },
  { formula: 'ISOYEAR(date(2006, 1, 1))', expected: 2005, description: 'Jan 1 2006 is in ISO year 2005' },
];

export const UNIXTIMESTAMP_TESTS = [
  { formula: 'UNIXTIMESTAMP(date(2005, 4, 5))', expected: 1112659200 },
  { formula: 'TEXT(FROMUNIXTIME(1112659200))', expected: '2005-04-05 00:00:00Z' },
  { formula: 'UNIXTIMESTAMP(datetimevalue("2005-11-15 17:00:00"))', expected: 1132074000 },
  { formula: 'TEXT(FROMUNIXTIME(1132074000))', expected: '2005-11-15 17:00:00Z' },
];

// ============================================================================
// SHORT-CIRCUIT / LAZY EVALUATION TESTS
// ============================================================================

export const SHORT_CIRCUIT_TESTS = [
  // These formulas contain 1/0 which would throw, but short-circuit prevents evaluation
  { formula: 'AND(1<>1, 1/0=0)', expected: false, description: 'AND short-circuits on first false' },
  { formula: 'OR(1=1, 1/0=0)', expected: true, description: 'OR short-circuits on first true' },
  { formula: 'IF(false, 1/0, 37)', expected: 37, description: 'IF lazy: false branch not evaluated' },
  { formula: 'IF(true, 37, 1/0)', expected: 37, description: 'IF lazy: false branch not evaluated' },
  { formula: 'IFS(false, 1/0, 37)', expected: 37, description: 'IFS lazy: false branches not evaluated' },
];

// ============================================================================
// INTEGRATION / COMPLEX FORMULA TESTS
// ============================================================================

export const COMPLEX_FORMULA_TESTS = [
  { formula: 'IF(ISBLANK(null), 0, 42)', expected: 0 },
  { formula: 'IF(AND(10 > 0, NOT(ISBLANK("hello"))), UPPER(LEFT("hello", 3)) & "-" & TEXT(ROUND(10.41, 0)), "N/A")', expected: 'HEL-10' },
  { formula: 'CASE(MONTH(DATE(2024,3,15)), 1, "Q1", 2, "Q1", 3, "Q1", 4, "Q2", 5, "Q2", 6, "Q2", "Other")', expected: 'Q1' },
];

// ============================================================================
// ALL TEST SUITES COMBINED
// ============================================================================

export const ALL_TEST_SUITES = {
  // Operators
  addition: ADDITION_TESTS,
  subtraction: SUBTRACTION_TESTS,
  multiplication: MULTIPLICATION_TESTS,
  division: DIVISION_TESTS,
  exponent: EXPONENT_TESTS,
  unary: UNARY_TESTS,
  precedence: PRECEDENCE_TESTS,
  equality: EQUALITY_TESTS,
  comparison: COMPARISON_TESTS,
  concat: CONCAT_TESTS,
  boolean: BOOLEAN_TESTS,

  // Logical functions
  not: NOT_TESTS,
  and: AND_TESTS,
  or: OR_TESTS,
  if_: IF_TESTS,
  ifs: IFS_TESTS,
  ifsErrors: IFS_ERROR_TESTS,
  case_: CASE_TESTS,
  isnull: ISNULL_TESTS,
  nullvalue: NULLVALUE_TESTS,

  // Math functions
  abs: ABS_TESTS,
  sqrt: SQRT_TESTS,
  expLnLog: EXP_LN_LOG_TESTS,
  mod: MOD_TESTS,
  max: MAX_TESTS,
  min: MIN_TESTS,
  round: ROUND_TESTS,
  ceiling: CEILING_TESTS,
  floor: FLOOR_TESTS,
  mceiling: MCEILING_TESTS,
  mfloor: MFLOOR_TESTS,
  pi: PI_TESTS,

  // Text functions
  text: TEXT_TESTS,
  value: VALUE_TESTS,
  len: LEN_TESTS,
  begins: BEGINS_TESTS,
  contains: CONTAINS_TESTS,
  left: LEFT_TESTS,
  right: RIGHT_TESTS,
  mid: MID_TESTS,
  find: FIND_TESTS,
  trim: TRIM_TESTS,
  upper: UPPER_TESTS,
  lower: LOWER_TESTS,
  substitute: SUBSTITUTE_TESTS,
  rpad: RPAD_TESTS,
  lpad: LPAD_TESTS,
  isnumber: ISNUMBER_TESTS,

  // Date/time functions
  date: DATE_TESTS,
  day: DAY_TESTS,
  month: MONTH_TESTS,
  year: YEAR_TESTS,
  weekday: WEEKDAY_TESTS,
  addmonths: ADDMONTHS_TESTS,
  datevalue: DATEVALUE_TESTS,
  datetimevalue: DATETIMEVALUE_TESTS,
  timevalue: TIMEVALUE_TESTS,
  dateArithmetic: DATE_ARITHMETIC_TESTS,

  // Extended functions
  chrAscii: CHR_ASCII_TESTS,
  initcap: INITCAP_TESTS,
  dayofyear: DAYOFYEAR_TESTS,
  isoweek: ISOWEEK_TESTS,
  isoyear: ISOYEAR_TESTS,
  unixTimestamp: UNIXTIMESTAMP_TESTS,

  // Short-circuit / lazy evaluation
  shortCircuit: SHORT_CIRCUIT_TESTS,

  // Complex / integration
  complex: COMPLEX_FORMULA_TESTS,
};

/**
 * Total test case count (for reference)
 */
export const TOTAL_TEST_CASES = Object.values(ALL_TEST_SUITES).reduce((sum, suite) => sum + suite.length, 0);
