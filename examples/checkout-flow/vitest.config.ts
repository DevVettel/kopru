import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'example-checkout-flow',
    include: ['test/**/*.test.ts'],
  },
});
