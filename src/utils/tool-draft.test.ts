import { describe, expect, it } from 'vitest';
import { DRAFT_MAX_CHARS, type DraftStore, draftStorageKey, readDraft, writeDraft } from './tool-draft';

function memoryStore(): DraftStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
}

describe('tool drafts', () => {
  it('normalizes the trailing slash into one key', () => {
    expect(draftStorageKey('/json-prettify/')).toBe(draftStorageKey('/json-prettify'));
  });

  it('round-trips a draft and clears blanks', () => {
    const store = memoryStore();
    writeDraft(store, '/hash-text', 'abc');
    expect(readDraft(store, '/hash-text/')).toBe('abc');
    writeDraft(store, '/hash-text', '   ');
    expect(readDraft(store, '/hash-text')).toBeNull();
  });

  it('refuses a draft large enough to blow the quota', () => {
    const store = memoryStore();
    writeDraft(store, '/jwt-parser', 'kept');
    writeDraft(store, '/jwt-parser', 'x'.repeat(DRAFT_MAX_CHARS + 1));
    expect(readDraft(store, '/jwt-parser')).toBe('kept');
  });
});
