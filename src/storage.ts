// IndexedDB persistence. idb-keyval keeps one object store per database, hence two databases.

import { createStore, get, set } from 'idb-keyval';
import type { Attempt } from './core/attempt';

const attempts = createStore('pdd-swipe-log', 'attempts');
const state = createStore('pdd-swipe-state', 'state');

/** Append an attempt to the log; keyed by [ts, qid], so keys sort by time. */
export function logAttempt(a: Attempt): Promise<void> {
  return set([a.ts, a.qid], a, attempts);
}

/**
 * Id of the question the "все подряд" pass resumes from: undefined before the first answer,
 * null once the pass is finished.
 */
export function loadCursor(): Promise<string | null | undefined> {
  return get<string | null>('cursor', state);
}

export function saveCursor(qid: string | null): Promise<void> {
  return set('cursor', qid, state);
}
