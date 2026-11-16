import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from '../src/index.js';

describe('@kopru/core', () => {
  it('paket adını dışa aktarır', () => {
    expect(PACKAGE_NAME).toBe('@kopru/core');
  });
});
