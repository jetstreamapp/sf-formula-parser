#!/usr/bin/env npx tsx
/**
 * Formula verification script — compares our parser output against a real Salesforce org.
 *
 * Usage: npx tsx scripts/formula-verify/verify.ts
 *
 * Prerequisites:
 *   - Authenticated SF org: sf org login web
 *   - API version 56.0+ (FormulaEval API)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve paths relative to the formula-parser project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

interface FormulaTest {
  id: string;
  formula: string;
  returnType: string;
  description: string;
  ourExpected: unknown;
  skip?: boolean;
  skipReason?: string;
}

interface TestResult {
  id: string;
  formula: string;
  description: string;
  ourResult: unknown;
  sfResult: string;
  ourExpected: unknown;
  match: boolean;
  error?: string;
}

async function main() {
  // 1. Load formulas
  const formulas: { tests: FormulaTest[] } = JSON.parse(
    readFileSync(resolve(__dirname, 'formulas.json'), 'utf-8')
  );

  const skipped = formulas.tests.filter(t => t.skip);
  const active = formulas.tests.filter(t => !t.skip);
  console.log(`\nLoaded ${formulas.tests.length} formulas (${active.length} active, ${skipped.length} skipped)\n`);
  if (skipped.length > 0) {
    for (const s of skipped) {
      console.log(`  Skipped: ${s.id} — ${s.skipReason ?? 'no reason given'}`);
    }
    console.log('');
  }

  // 2. Generate Apex and write to temp file
  console.log('Generating Apex script...');
  const apexCode = execSync(`npx tsx ${resolve(__dirname, 'generate-apex.ts')}`, {
    cwd: projectRoot,
    encoding: 'utf-8',
  });
  const apexFile = resolve(__dirname, '_verify.apex');
  writeFileSync(apexFile, apexCode);

  // 3. Run Apex against SF org
  console.log('Running Apex in Salesforce org...\n');
  let sfOutput: string;
  try {
    sfOutput = execSync(`sf apex run --file "${apexFile}" --json`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e: unknown) {
    // sf apex run may exit non-zero but still have output
    sfOutput = (e as { stdout?: string }).stdout ?? '';
    if (!sfOutput) {
      console.error('Failed to run Apex. Make sure you are authenticated:');
      console.error('   sf org login web');
      process.exit(1);
    }
  }

  // 4. Parse SF results from debug log
  const sfResults = parseSfResults(sfOutput);

  // 5. Run formulas through our parser
  // Dynamic import since formula-parser is ESM
  const { evaluateFormula } = await import(
    resolve(projectRoot, 'src/index.ts')
  );

  const results: TestResult[] = [];

  for (const test of formulas.tests) {
    if (test.skip) continue;

    let ourResult: unknown;
    let ourError: string | undefined;

    try {
      ourResult = evaluateFormula(test.formula, { record: {} });
      // Normalize: Date -> ISO string for comparison
      if (ourResult instanceof Date) {
        ourResult = ourResult.toISOString();
      }
    } catch (e: unknown) {
      ourError = (e as Error).message;
      ourResult = `ERROR: ${ourError}`;
    }

    const sfResult = sfResults.get(test.id) ?? 'NOT_RUN';

    // Compare (loose: string vs number, etc.)
    const match = compareResults(ourResult, sfResult, test.returnType);

    results.push({
      id: test.id,
      formula: test.formula,
      description: test.description,
      ourResult,
      sfResult,
      ourExpected: test.ourExpected,
      match,
      error: ourError,
    });
  }

  // 6. Output report
  printReport(results);
}

function parseSfResults(output: string): Map<string, string> {
  const results = new Map<string, string>();

  try {
    const json = JSON.parse(output);
    const logs: string = json?.result?.logs ?? '';
    const lines = logs.split('\n');

    for (const line of lines) {
      const match = line.match(/###FORMULA_RESULT### (.+?)=(.+)/);
      if (match) {
        results.set(match[1]!, match[2]!);
      }
    }
  } catch {
    // Try to parse raw output as debug log
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/###FORMULA_RESULT### (.+?)=(.+)/);
      if (match) {
        results.set(match[1]!, match[2]!);
      }
    }
  }

  return results;
}

function compareResults(ours: unknown, sf: string, returnType: string): boolean {
  if (sf === 'NOT_RUN') return false;
  if (typeof ours === 'string' && ours.startsWith('ERROR:') && sf.startsWith('ERROR:'))
    return true;

  const sfClean = sf.trim();

  switch (returnType) {
    case 'DECIMAL': {
      const ourNum = typeof ours === 'number' ? ours : parseFloat(String(ours));
      const sfNum = parseFloat(sfClean);
      if (isNaN(ourNum) && isNaN(sfNum)) return true;
      if (isNaN(ourNum) || isNaN(sfNum)) return false;
      return Math.abs(ourNum - sfNum) < 0.0001;
    }
    case 'BOOLEAN': {
      const ourBool = String(ours).toLowerCase();
      const sfBool = sfClean.toLowerCase();
      return ourBool === sfBool;
    }
    case 'STRING':
    default:
      return String(ours) === sfClean;
  }
}

function printReport(results: TestResult[]) {
  const passed = results.filter((r) => r.match);
  const failed = results.filter((r) => !r.match);
  const notRun = results.filter((r) => r.sfResult === 'NOT_RUN');

  console.log('===================================================');
  console.log('  FORMULA VERIFICATION REPORT');
  console.log('===================================================\n');

  if (failed.length > 0) {
    console.log(`MISMATCHES (${failed.length}):\n`);
    for (const r of failed) {
      if (r.sfResult === 'NOT_RUN') continue;
      console.log(`  ${r.id}: ${r.formula}`);
      console.log(`    Description: ${r.description}`);
      console.log(`    Our result:  ${JSON.stringify(r.ourResult)}`);
      console.log(`    SF result:   ${r.sfResult}`);
      console.log(`    Expected:    ${JSON.stringify(r.ourExpected)}`);
      console.log('');
    }
  }

  if (notRun.length > 0) {
    console.log(`NOT RUN (${notRun.length}):`);
    for (const r of notRun) {
      console.log(`  ${r.id}: ${r.formula}`);
    }
    console.log('');
  }

  if (passed.length > 0) {
    console.log(`PASSED (${passed.length}):`);
    for (const r of passed) {
      console.log(`  ${r.id}: ${r.formula} -> ${JSON.stringify(r.ourResult)}`);
    }
    console.log('');
  }

  console.log('---------------------------------------------------');
  console.log(
    `  Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length - notRun.length} | Not run: ${notRun.length}`
  );
  console.log('---------------------------------------------------\n');

  // Write machine-readable results
  const outFile = resolve(dirname(fileURLToPath(import.meta.url)), 'results.json');
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Full results written to: ${outFile}\n`);
}

main().catch(console.error);
