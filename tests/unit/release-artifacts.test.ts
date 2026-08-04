import { describe, expect, it } from 'vitest';

import { formatArchiveInventory } from '../../scripts/release-artifacts.mjs';

describe('release artifacts', () => {
  it('produces a complete, deterministic inventory for the reviewed extension archive', () => {
    expect(formatArchiveInventory(['popup/index.html', 'manifest.json'])).toBe(
      'manifest.json\npopup/index.html\n',
    );
  });
});
