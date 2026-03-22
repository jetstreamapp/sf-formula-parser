import { Parser } from './parser/index.js';
import { walkAST } from './parser/walk.js';

export interface ExtractedFields {
  objectFields: string[];
  globals: Record<string, string[]>;
  customMetadata: string[];
  customLabels: string[];
  customSettings: string[];
  customPermissions: string[];
}

/**
 * Extract all field references from a formula string.
 * Returns a deduplicated array of dot-joined field names in parse order.
 */
export function extractFields(formula: string): string[] {
  const ast = Parser.parse(formula);
  const seen = new Set<string>();

  walkAST(ast, node => {
    if (node.type === 'FieldReference') {
      const fieldName = node.parts.join('.');
      seen.add(fieldName);
    }
  });

  return Array.from(seen);
}

/**
 * Extract and categorize field references from a formula string.
 *
 * Categories:
 * - objectFields: regular fields (no $ prefix)
 * - globals: $-prefixed fields keyed by prefix (e.g. $User, $Organization)
 * - customMetadata: $CustomMetadata.* fields
 * - customLabels: $Label.* fields
 * - customSettings: $Setup.* fields
 * - customPermissions: $Permission.* fields
 */
export function extractFieldsByCategory(formula: string): ExtractedFields {
  const fields = extractFields(formula);

  const result: ExtractedFields = {
    objectFields: [],
    globals: {},
    customMetadata: [],
    customLabels: [],
    customSettings: [],
    customPermissions: [],
  };

  for (const field of fields) {
    const firstPart = field.split('.')[0]!;

    if (!firstPart.startsWith('$')) {
      result.objectFields.push(field);
      continue;
    }

    const key = firstPart.toLowerCase();
    switch (key) {
      case '$custommetadata':
        result.customMetadata.push(field);
        break;
      case '$label':
        result.customLabels.push(field);
        break;
      case '$setup':
        result.customSettings.push(field);
        break;
      case '$permission':
        result.customPermissions.push(field);
        break;
      default:
        // All other $-prefixed globals ($User, $Organization, $Profile, etc.)
        if (!result.globals[firstPart]) {
          result.globals[firstPart] = [];
        }
        result.globals[firstPart].push(field);
        break;
    }
  }

  return result;
}
