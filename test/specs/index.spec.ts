import { describe, it, expect } from 'vitest';
import * as Index from '@/index';

describe('@/index.ts', () => {
  it('RegExpMatcher を公開していること', () => {
    expect(Object.keys(Index).sort()).toEqual(['RegExpMatcher']);
  });
});
