import { describe, it, expect } from 'vitest';
import { FormulaError } from '../index.js';

describe('smoke test', () => {
  it('imports FormulaError from the library', () => {
    const err = new FormulaError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FormulaError');
    expect(err.message).toBe('test');
  });
});
