import puppeteer from 'puppeteer';
import { describe, expect, it } from 'vitest';

describe('integration tooling', () => {
  it('makes Puppeteer available for Chrome integration coverage', () => {
    expect(puppeteer.launch).toBeTypeOf('function');
  });
});
