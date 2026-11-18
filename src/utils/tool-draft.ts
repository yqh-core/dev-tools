/** 每个工具主输入的本地草稿。只存 path，不上传。 */
export const DRAFT_PREFIX = 'dd:draft:';

/** localStorage 对单条草稿的上限，避免超配额把整站存储写坏。 */
export const DRAFT_MAX_CHARS = 200_000;

export interface DraftStore {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function draftStorageKey(path: string): string {
  const normalized = path.replace(/\/+$/, '') || '/';
  return `${DRAFT_PREFIX}${normalized}`;
}

export function readDraft(store: DraftStore, path: string): string | null {
  const value = store.getItem(draftStorageKey(path));
  if (value == null || value.trim() === '') {
    return null;
  }
  return value;
}

export function writeDraft(store: DraftStore, path: string, value: string): void {
  const key = draftStorageKey(path);
  if (!value.trim()) {
    store.removeItem(key);
    return;
  }
  if (value.length > DRAFT_MAX_CHARS) {
    return;
  }
  store.setItem(key, value);
}
