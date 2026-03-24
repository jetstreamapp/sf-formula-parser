import { useState, useCallback, type KeyboardEvent, type ReactNode } from 'react';
import { evaluateFormula, FormulaError, isDateOnly } from '@jetstreamapp/sf-formula-parser';
import type { FormulaReturnType, SchemaInput } from '@jetstreamapp/sf-formula-parser';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Recursively walk a parsed JSON context and convert ISO date strings to Date objects. */
function coerceDates(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.record && typeof obj.record === 'object') {
    coerceRecordDates(obj.record as Record<string, unknown>);
  }
  if (obj.priorRecord && typeof obj.priorRecord === 'object') {
    coerceRecordDates(obj.priorRecord as Record<string, unknown>);
  }
  if (obj.globals && typeof obj.globals === 'object') {
    for (const val of Object.values(obj.globals as Record<string, unknown>)) {
      if (val && typeof val === 'object') coerceRecordDates(val as Record<string, unknown>);
    }
  }
  return obj;
}

/** Walk a flat FormulaRecord, converting ISO date strings to Date objects. */
function coerceRecordDates(record: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === 'string' && ISO_DATE_RE.test(v)) {
      record[k] = new Date(v);
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      coerceRecordDates(v as Record<string, unknown>);
    }
  }
}

const RETURN_TYPE_OPTIONS: { value: '' | FormulaReturnType; label: string }[] = [
  { value: '', label: 'None (skip validation)' },
  { value: 'number', label: 'Number' },
  { value: 'string', label: 'Text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'time', label: 'Time' },
];

interface ExampleFormula {
  label: string;
  formula: string;
  context: string;
  returnType?: FormulaReturnType | '';
  schema?: string;
}

const EXAMPLE_FORMULAS: ExampleFormula[] = [
  {
    label: 'Basic IF',
    formula: 'IF(Amount > 1000, "Large Deal", "Small Deal")',
    context: '{\n  "record": {\n    "Amount": 5000\n  }\n}',
  },
  {
    label: 'Text functions',
    formula: 'UPPER(LEFT(Name, 3)) & "-" & TEXT(Amount)',
    context: '{\n  "record": {\n    "Name": "Acme Corp",\n    "Amount": 42\n  }\n}',
  },
  {
    label: 'Nested IF',
    formula: 'IF(Score >= 90, "A", IF(Score >= 80, "B", IF(Score >= 70, "C", "F")))',
    context: '{\n  "record": {\n    "Score": 85\n  }\n}',
  },
  {
    label: 'CASE',
    formula: 'CASE(Status, "New", "Just Created", "Active", "In Progress", "Closed", "Done", "Unknown")',
    context: '{\n  "record": {\n    "Status": "Active"\n  }\n}',
  },
  {
    label: 'Date functions',
    formula: 'YEAR(CreatedDate) & "-" & TEXT(MONTH(CreatedDate))',
    context: '{\n  "record": {\n    "CreatedDate": "2024-06-15T10:30:00Z"\n  }\n}',
  },
  {
    label: 'Math',
    formula: 'ROUND(Amount * TaxRate, 2)',
    context: '{\n  "record": {\n    "Amount": 199.99,\n    "TaxRate": 0.0825\n  }\n}',
  },
  {
    label: 'Related record',
    formula: 'Account.Name & " - " & Account.Industry',
    context: '{\n  "record": {\n    "Account": {\n      "Name": "Acme Corp",\n      "Industry": "Technology"\n    }\n  }\n}',
  },
  {
    label: 'ISBLANK / BLANKVALUE',
    formula: 'BLANKVALUE(Phone, "No phone on file")',
    context: '{\n  "record": {\n    "Phone": null\n  }\n}',
  },
  {
    label: 'Return type validation',
    formula: 'Amount + 1',
    context: '{\n  "record": {\n    "Amount": 100\n  }\n}',
    returnType: 'number',
  },
  {
    label: 'Type mismatch error',
    formula: '1 + 2',
    context: '{\n  "record": {}\n}',
    returnType: 'string',
  },
  {
    label: 'Schema + ISPICKVAL',
    formula: 'ISPICKVAL(Status, "Active")',
    context: '{\n  "record": {\n    "Status": "Active"\n  }\n}',
    schema: '[\n  { "name": "Status", "type": "picklist" },\n  { "name": "Name", "type": "string" }\n]',
    returnType: 'boolean',
  },
  {
    label: 'Picklist error',
    formula: 'UPPER(Status)',
    context: '{\n  "record": {\n    "Status": "Active"\n  }\n}',
    schema: '[\n  { "name": "Status", "type": "picklist" }\n]',
  },
  {
    label: 'Schema + related field',
    formula: 'Name & " (" & TEXT(Account.Industry) & ")"',
    context: '{\n  "record": {\n    "Name": "Acme Corp",\n    "Account": {\n      "Industry": "Technology"\n    }\n  }\n}',
    schema:
      '{\n  "$record": [\n    { "name": "Name", "type": "string" },\n    { "name": "AccountId", "type": "reference" }\n  ],\n  "Account": [\n    { "name": "Name", "type": "string" },\n    { "name": "Industry", "type": "picklist" }\n  ]\n}',
    returnType: 'string',
  },
  {
    label: 'Operator type error',
    formula: 'true + true',
    context: '{\n  "record": {}\n}',
  },
];

interface PlaygroundResult {
  value: string;
  type: string;
  error?: boolean;
}

function runEvaluate(formula: string, contextJson: string, returnType: FormulaReturnType | '', schemaJson: string): PlaygroundResult {
  if (!formula.trim()) {
    return { value: 'Enter a formula above', type: 'hint' };
  }

  let ctx: Record<string, unknown>;
  try {
    ctx = JSON.parse(contextJson);
  } catch {
    return { value: 'Invalid JSON in record context', type: 'error', error: true };
  }

  coerceDates(ctx);

  let schema: SchemaInput | undefined;
  if (schemaJson.trim()) {
    try {
      schema = JSON.parse(schemaJson);
    } catch {
      return { value: 'Invalid JSON in schema', type: 'error', error: true };
    }
  }

  const options: Record<string, unknown> = {};
  if (returnType) options.returnType = returnType;
  if (schema) options.schema = schema;

  try {
    const result = evaluateFormula(formula, ctx as any, Object.keys(options).length > 0 ? (options as any) : undefined);

    if (result === null) {
      return { value: 'null', type: 'null' };
    }
    if (result instanceof Date) {
      const dateOnly = isDateOnly(result);
      return { value: dateOnly ? result.toISOString().substring(0, 10) : result.toISOString(), type: dateOnly ? 'Date' : 'Date/Time' };
    }
    if (typeof result === 'object' && result !== null && 'timeInMillis' in result) {
      const ms = (result as { timeInMillis: number }).timeInMillis;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      return {
        value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        type: 'SfTime',
      };
    }
    if (typeof result === 'object' && result !== null && 'latitude' in result) {
      const geo = result as { latitude: number; longitude: number };
      return { value: `(${geo.latitude}, ${geo.longitude})`, type: 'GeoLocation' };
    }

    return { value: String(result), type: typeof result };
  } catch (e) {
    const msg = e instanceof FormulaError ? e.message : String(e);
    return { value: msg, type: 'error', error: true };
  }
}

interface FormulaPlaygroundProps {
  defaultFormula?: string;
  defaultContext?: string;
  compact?: boolean;
}

const selectStyle = {
  padding: '0.35rem 0.5rem',
  borderRadius: '6px',
  border: '1px solid var(--ifm-color-emphasis-300)',
  background: 'var(--ifm-background-surface-color)',
  color: 'var(--ifm-font-color-base)',
  fontSize: '0.8rem',
  cursor: 'pointer',
} as const;

export default function FormulaPlayground({
  defaultFormula = 'IF(Amount > 1000, "Large Deal", "Small Deal")',
  defaultContext = '{\n  "record": {\n    "Amount": 5000\n  }\n}',
  compact = false,
}: FormulaPlaygroundProps): ReactNode {
  const [formula, setFormula] = useState(defaultFormula);
  const [context, setContext] = useState(defaultContext);
  const [returnType, setReturnType] = useState<FormulaReturnType | ''>('');
  const [schema, setSchema] = useState('');
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  const handleRun = useCallback(() => {
    setResult(runEvaluate(formula, context, returnType, schema));
  }, [formula, context, returnType, schema]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setResult(runEvaluate(formula, context, returnType, schema));
      }
    },
    [formula, context, returnType, schema],
  );

  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(context);
      setContext(JSON.stringify(parsed, null, 2));
    } catch {
      // Don't format if JSON is invalid
    }
  }, [context]);

  const handleFormatSchema = useCallback(() => {
    try {
      const parsed = JSON.parse(schema);
      setSchema(JSON.stringify(parsed, null, 2));
    } catch {
      // Don't format if JSON is invalid
    }
  }, [schema]);

  const handleExample = useCallback((ex: ExampleFormula) => {
    setFormula(ex.formula);
    setContext(ex.context);
    setReturnType(ex.returnType ?? '');
    setSchema(ex.schema ?? '');
    setResult(null);
  }, []);

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {EXAMPLE_FORMULAS.map(ex => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--ifm-color-emphasis-300)',
                background: 'var(--ifm-background-surface-color)',
                color: 'var(--ifm-font-color-base)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--ifm-color-primary)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--ifm-color-emphasis-300)')}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      <div className="playground-container">
        <div>
          <div className="playground-panel">
            <div className="playground-panel-header">Formula</div>
            <textarea
              className="playground-editor"
              value={formula}
              onChange={e => {
                setFormula(e.target.value);
                setResult(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter a Salesforce formula..."
              spellCheck={false}
            />
          </div>

          <div className="playground-panel" style={{ marginTop: '1rem' }}>
            <div className="playground-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Record Context (JSON)</span>
              <button
                onClick={handleFormatJson}
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--ifm-color-emphasis-300)',
                  background: 'transparent',
                  color: 'var(--ifm-color-emphasis-600)',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Format
              </button>
            </div>
            <textarea
              className="playground-context-editor"
              value={context}
              onChange={e => {
                setContext(e.target.value);
                setResult(null);
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          </div>

          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                  color: 'var(--ifm-color-emphasis-700)',
                }}
              >
                Return Type
              </label>
              <select
                value={returnType}
                onChange={e => {
                  setReturnType(e.target.value as FormulaReturnType | '');
                  setResult(null);
                }}
                style={selectStyle}
              >
                {RETURN_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="playground-panel">
              <div className="playground-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Field Schema (JSON, optional)</span>
                <button
                  onClick={handleFormatSchema}
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--ifm-color-emphasis-300)',
                    background: 'transparent',
                    color: 'var(--ifm-color-emphasis-600)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Format
                </button>
              </div>
              <textarea
                className="playground-context-editor"
                value={schema}
                onChange={e => {
                  setSchema(e.target.value);
                  setResult(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`{
  "$record": [
    { "name": "Name", "type": "string" },
  ],
  "Account": [
    { "name": "Name", "type": "string" },
  ]
}`}
                spellCheck={false}
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          <button className="playground-run-btn" onClick={handleRun}>
            Evaluate
            <kbd style={{ opacity: 0.7, fontWeight: 400 }}>
              {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'}+↵
            </kbd>
          </button>
        </div>

        <div className="playground-panel">
          <div className="playground-panel-header">Result</div>
          <div className="playground-result">
            {result === null ? (
              <span style={{ color: 'var(--ifm-color-emphasis-400)' }}>Click &quot;Evaluate&quot; to run the formula</span>
            ) : result.error ? (
              <>
                <span className="playground-result-error">{result.value}</span>
                <div className="playground-result-type">Error</div>
              </>
            ) : (
              <>
                <span className="playground-result-value">{result.value}</span>
                <div className="playground-result-type">{result.type}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="playground-note">
        Formulas are evaluated entirely in your browser using <code>@jetstreamapp/sf-formula-parser</code> — nothing is sent to a server.
      </div>
    </div>
  );
}
