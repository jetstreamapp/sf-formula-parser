/**
 * Schema types for optional field-type-aware validation.
 *
 * The FieldSchema interface is intentionally compatible with the Salesforce `Field`
 * type from the describeSObject() API, so users can pass `describe.fields` directly.
 */

/**
 * Salesforce field types from the describeSObject API.
 */
export type SalesforceFieldType =
  | 'string'
  | 'boolean'
  | 'int'
  | 'double'
  | 'date'
  | 'datetime'
  | 'base64'
  | 'id'
  | 'reference'
  | 'currency'
  | 'textarea'
  | 'percent'
  | 'phone'
  | 'url'
  | 'email'
  | 'combobox'
  | 'picklist'
  | 'multipicklist'
  | 'anyType'
  | 'location'
  | 'time'
  | 'encryptedstring'
  | 'address'
  | 'complexvalue';

/**
 * Internal formula type used for validation.
 */
export type FormulaType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'geolocation'
  | 'picklist'
  | 'multipicklist'
  | 'any';

/**
 * Minimal field schema for type-aware validation.
 * Compatible with the Salesforce `Field` type from describeSObject().
 * Users can pass `describeSObjectResult.fields` directly.
 */
export interface FieldSchema {
  name: string;
  type: SalesforceFieldType;
}

/**
 * Map a Salesforce field type to an internal formula type.
 */
export function toFormulaType(fieldType: SalesforceFieldType): FormulaType {
  switch (fieldType) {
    case 'string':
    case 'textarea':
    case 'id':
    case 'reference':
    case 'phone':
    case 'url':
    case 'email':
    case 'encryptedstring':
    case 'combobox':
    case 'base64':
      return 'string';
    case 'picklist':
      return 'picklist';
    case 'multipicklist':
      return 'multipicklist';
    case 'int':
    case 'double':
    case 'currency':
    case 'percent':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'time':
      return 'time';
    case 'location':
    case 'address':
      return 'geolocation';
    case 'anyType':
    case 'complexvalue':
    default:
      return 'any';
  }
}

// ── Picklist markers ──────────────────────────────────────────────────

const PICKLIST_MARKER = Symbol('isPicklist');
const MULTIPICKLIST_MARKER = Symbol('isMultipicklist');
const FIELD_NAME_MARKER = Symbol('fieldName');

/** Mark a string value as originating from a picklist field. */
export function markPicklist(value: string, fieldName: string): string {
  const s = new String(value) as unknown as Record<symbol, unknown>;
  s[PICKLIST_MARKER] = true;
  s[FIELD_NAME_MARKER] = fieldName;
  // Ensure valueOf/toString return the primitive for coercion
  return s as unknown as string;
}

/** Mark a string value as originating from a multipicklist field. */
export function markMultipicklist(value: string, fieldName: string): string {
  const s = new String(value) as unknown as Record<symbol, unknown>;
  s[MULTIPICKLIST_MARKER] = true;
  s[FIELD_NAME_MARKER] = fieldName;
  return s as unknown as string;
}

/** Check if a value is a picklist-marked string. */
export function isPicklistValue(value: unknown): boolean {
  return value instanceof String && (value as unknown as Record<symbol, boolean>)[PICKLIST_MARKER] === true;
}

/** Check if a value is a multipicklist-marked string. */
export function isMultipicklistValue(value: unknown): boolean {
  return value instanceof String && (value as unknown as Record<symbol, boolean>)[MULTIPICKLIST_MARKER] === true;
}

/** Check if a value is any kind of picklist. */
export function isAnyPicklistValue(value: unknown): boolean {
  return isPicklistValue(value) || isMultipicklistValue(value);
}

/** Get the field name from a picklist-marked value. */
export function getPicklistFieldName(value: unknown): string | null {
  if (value instanceof String) {
    const name = (value as unknown as Record<symbol, string>)[FIELD_NAME_MARKER];
    return name ?? null;
  }
  return null;
}

// ── Schema types ──────────────────────────────────────────────────────

/**
 * The key used for the current/root object in a schema map.
 */
export const SCHEMA_SELF_KEY = '$record';

/**
 * Schema input — either a flat array (current object only) or a map keyed by relationship path.
 *
 * Flat array (backwards compatible):
 *   schema: [{ name: 'Name', type: 'string' }]
 *
 * Relationship map:
 *   schema: {
 *     '$record': [{ name: 'Name', type: 'string' }],    // current object
 *     'Account': [{ name: 'Name', type: 'string' }],     // Account relationship
 *     '$User': [{ name: 'FirstName', type: 'string' }],  // $User global
 *   }
 */
export type SchemaInput = FieldSchema[] | Record<string, FieldSchema[]>;

// ── Schema map builder ────────────────────────────────────────────────

export interface FieldTypeInfo {
  formulaType: FormulaType;
  salesforceType: SalesforceFieldType;
}

/**
 * Build a case-insensitive field type map from a FieldSchema array.
 */
function buildSingleFieldTypeMap(fields: FieldSchema[]): Map<string, FieldTypeInfo> {
  const map = new Map<string, FieldTypeInfo>();
  for (const field of fields) {
    map.set(field.name.toLowerCase(), {
      formulaType: toFormulaType(field.type),
      salesforceType: field.type,
    });
  }
  return map;
}

/**
 * A schema map that supports lookups by relationship path.
 * Key '$record' is the root/current object. Other keys are relationship paths (e.g., 'Account', '$User').
 */
export class SchemaMap {
  private maps: Map<string, Map<string, FieldTypeInfo>>;

  constructor(input: SchemaInput) {
    this.maps = new Map();
    if (Array.isArray(input)) {
      // Flat array — current object only, stored under the self key
      this.maps.set(SCHEMA_SELF_KEY, buildSingleFieldTypeMap(input));
    } else {
      // Record keyed by relationship path
      for (const [key, fields] of Object.entries(input)) {
        this.maps.set(key.toLowerCase(), buildSingleFieldTypeMap(fields));
      }
    }
  }

  /** Get field type info for a direct field on the root object. */
  getField(fieldName: string): FieldTypeInfo | undefined {
    return this.maps.get(SCHEMA_SELF_KEY)?.get(fieldName.toLowerCase());
  }

  /** Get field type info for a field on a specific relationship path. */
  getRelatedField(relationshipPath: string, fieldName: string): FieldTypeInfo | undefined {
    return this.maps.get(relationshipPath.toLowerCase())?.get(fieldName.toLowerCase());
  }

  /** Check if the root object schema is defined. */
  hasRootSchema(): boolean {
    return this.maps.has(SCHEMA_SELF_KEY);
  }

  /** Check if a relationship path has a schema defined. */
  hasSchemaFor(relationshipPath: string): boolean {
    return this.maps.has(relationshipPath.toLowerCase());
  }
}
