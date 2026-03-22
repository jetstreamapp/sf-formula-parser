import { describe, it, expect } from 'vitest';
import { extractFields, extractFieldsByCategory } from '../extract.js';
import { ParseError } from '../evaluator/errors.js';

describe('extractFields', () => {
  it('extracts a single field', () => {
    expect(extractFields('Amount')).toEqual(['Amount']);
  });

  it('extracts multiple fields from an expression', () => {
    expect(extractFields('IF(Amount > 100, Name, Description)')).toEqual(['Amount', 'Name', 'Description']);
  });

  it('extracts global field references', () => {
    expect(extractFields('$User.FirstName & " " & $Organization.Name')).toEqual(['$User.FirstName', '$Organization.Name']);
  });

  it('extracts dotted relation fields', () => {
    expect(extractFields('Account.Name')).toEqual(['Account.Name']);
  });

  it('deduplicates repeated fields', () => {
    expect(extractFields('Amount + Amount')).toEqual(['Amount']);
  });

  it('returns empty array for literals only', () => {
    expect(extractFields('"hello"')).toEqual([]);
    expect(extractFields('42')).toEqual([]);
    expect(extractFields('true')).toEqual([]);
  });

  it('extracts fields from nested function calls', () => {
    expect(extractFields('IF(ISBLANK(X), Y, Z)')).toEqual(['X', 'Y', 'Z']);
  });

  it('extracts fields from unary expressions', () => {
    expect(extractFields('NOT(IsActive)')).toEqual(['IsActive']);
  });

  it('extracts fields from complex formulas', () => {
    const formula = 'IF(AND(Amount > 1000, ISBLANK(Description)), $User.FirstName & " " & Name, Account.Name)';
    expect(extractFields(formula)).toEqual(['Amount', 'Description', '$User.FirstName', 'Name', 'Account.Name']);
  });

  it('throws ParseError for invalid formulas', () => {
    expect(() => extractFields('IF(,')).toThrow(ParseError);
  });
});

describe('extractFieldsByCategory', () => {
  it('categorizes object fields', () => {
    const result = extractFieldsByCategory('Amount + Tax');
    expect(result.objectFields).toEqual(['Amount', 'Tax']);
    expect(result.globals).toEqual({});
    expect(result.customMetadata).toEqual([]);
    expect(result.customLabels).toEqual([]);
    expect(result.customSettings).toEqual([]);
    expect(result.customPermissions).toEqual([]);
  });

  it('categorizes $User and $Organization into globals', () => {
    const result = extractFieldsByCategory('$User.FirstName & $Organization.Name');
    expect(result.globals).toEqual({
      $User: ['$User.FirstName'],
      $Organization: ['$Organization.Name'],
    });
    expect(result.objectFields).toEqual([]);
  });

  it('categorizes $CustomMetadata fields', () => {
    const result = extractFieldsByCategory('$CustomMetadata.MyType__mdt.MyRecord.Field__c');
    expect(result.customMetadata).toEqual(['$CustomMetadata.MyType__mdt.MyRecord.Field__c']);
  });

  it('categorizes $Label fields', () => {
    const result = extractFieldsByCategory('$Label.MyLabel');
    expect(result.customLabels).toEqual(['$Label.MyLabel']);
  });

  it('categorizes $Setup fields', () => {
    const result = extractFieldsByCategory('$Setup.MySetting__c.Field__c');
    expect(result.customSettings).toEqual(['$Setup.MySetting__c.Field__c']);
  });

  it('categorizes $Permission fields', () => {
    const result = extractFieldsByCategory('$Permission.MyPermission');
    expect(result.customPermissions).toEqual(['$Permission.MyPermission']);
  });

  it('handles mixed field types', () => {
    const formula = 'IF($User.IsActive, $Label.Greeting & " " & Name, $Setup.Default__c.Value__c)';
    const result = extractFieldsByCategory(formula);
    expect(result.objectFields).toEqual(['Name']);
    expect(result.globals).toEqual({ $User: ['$User.IsActive'] });
    expect(result.customLabels).toEqual(['$Label.Greeting']);
    expect(result.customSettings).toEqual(['$Setup.Default__c.Value__c']);
  });

  it('groups multiple globals under the same prefix', () => {
    const result = extractFieldsByCategory('$User.FirstName & " " & $User.LastName');
    expect(result.globals).toEqual({
      $User: ['$User.FirstName', '$User.LastName'],
    });
  });
});
