// Unit tests for the hybrid extractor (LLM primary/regex fallback orchestration).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkBlocks } from '../src/ai/blockExtractor.js';

const envWith = (text) => ({ AI: { run: async () => ({ response: text }) } });
const envThrow = { AI: { run: async () => { throw new Error('LLM down'); } } };

// NOTE: EXTRACTION_MODE is 'regex-first' (config). For common formats the regex
// answers first and the LLM is never consulted — so these assert the contract.

test('common format → regex (LLM not needed even if it would fail)', async () => {
  const r = await extractWorkBlocks('9-11 API work, 2-4 testing', envThrow);
  assert.equal(r.source, 'regex');
  assert.equal(r.entries.length, 2);
});

test('no AI binding → regex still works', async () => {
  const r = await extractWorkBlocks('9-11 API', {});
  assert.equal(r.source, 'regex');
  assert.equal(r.entries[0].start_time, '09:00');
});

test('novel format regex cannot parse → LLM rescue (valid JSON)', async () => {
  const r = await extractWorkBlocks(
    'spent the whole morning shift on the thing',
    envWith('[{"start_time":"9:00","end_time":"10:30","task":"Morning shift work","is_lunch":false}]')
  );
  assert.equal(r.source, 'llm');
  assert.equal(r.entries[0].start_time, '09:00'); // normalized HH:MM
});

test('LLM garbage / empty / only-lunch → falls back to regex', async () => {
  assert.equal((await extractWorkBlocks('9-11 API', envWith('sorry'))).source, 'regex');
  assert.equal((await extractWorkBlocks('9-11 API', envWith('[]'))).source, 'regex');
  assert.equal(
    (await extractWorkBlocks('9-11 API', envWith('[{"start_time":"13:00","end_time":"14:00","task":"Lunch","is_lunch":true}]'))).source,
    'regex'
  );
});

test('LLM mislabels a lunch as work → re-flagged is_lunch via tested break detector', async () => {
  const r = await extractWorkBlocks(
    'morning stuff',
    envWith('[{"start_time":"09:00","end_time":"10:00","task":"API","is_lunch":false},{"start_time":"13:00","end_time":"14:00","task":"Lunch","is_lunch":false}]')
  );
  assert.equal(r.source, 'llm');
  assert.equal(r.entries[1].is_lunch, true);
});
