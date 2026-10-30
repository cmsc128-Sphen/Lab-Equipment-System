const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepository } = require('../src/database/repository');

function fixture(initial = {}) {
  const records = new Map(Object.entries(initial));
  const snapshot = (id) => ({ id, exists: records.has(id), data: () => records.get(id) });
  const collection = {
    doc(id = 'generated-id') {
      return {
        id,
        async create(data) {
          if (records.has(id)) throw Object.assign(new Error('Already exists'), { code: 6 });
          records.set(id, data);
        },
        async get() { return snapshot(id); },
        async update(data) {
          if (!records.has(id)) throw Object.assign(new Error('Not found'), { code: 5 });
          records.set(id, { ...records.get(id), ...data });
        },
        async delete() { records.delete(id); },
      };
    },
    orderBy() {
      let after;
      return {
        startAfter(id) { after = id; return this; },
        limit(count) {
          return { async get() {
            return { docs: [...records.keys()].sort().filter((id) => after === undefined || id > after)
              .slice(0, count).map(snapshot) };
          } };
        },
      };
    },
  };
  return { records, repository: createRepository({ collection: () => collection }, 'items') };
}

test('creating with an existing ID fails without overwriting its data', async () => {
  // A second create must not replace an existing catalogue entry.
  const { repository, records } = fixture({ beaker: { name: 'Original' } });
  await assert.rejects(repository.create({ name: 'Replacement' }, 'beaker'), { code: 6 });
  assert.equal(records.get('beaker').name, 'Original');
});

test('create, read, edit and delete preserve the document ID and unrelated fields', async () => {
  const { repository } = fixture();
  const { id } = await repository.create({ name: 'Beaker', primaryImage: null });
  const before = await repository.getById(id);
  assert.ok(before.data.createdAt);
  // Editing one field must keep the original creation timestamp and nullable picture field.
  await repository.update(id, { name: 'Beaker, 250 mL' });
  const after = await repository.getById(id);
  assert.deepEqual(after.data.createdAt, before.data.createdAt);
  assert.equal(after.data.primaryImage, null);
  assert.equal(after.data.name, 'Beaker, 250 mL');
  await repository.delete(id);
  assert.equal(await repository.getById(id), null);
  await repository.delete(id); // Repeated deletion is intentionally idempotent.
});

test('editing a missing document fails instead of creating an incomplete record', async () => {
  const { repository, records } = fixture();
  await assert.rejects(repository.update('missing', { name: 'Unexpected' }), { code: 5 });
  assert.equal(records.size, 0);
});

test('cursor pagination reads the next IDs without repeating the first page', async () => {
  const { repository } = fixture({ c: {}, a: {}, b: {} });
  const first = await repository.list({ limit: 2 });
  const second = await repository.list({ limit: 2, afterId: first.nextCursor });
  assert.deepEqual(first.records.map((row) => row.id), ['a', 'b']);
  assert.deepEqual(second.records.map((row) => row.id), ['c']);
  assert.equal(second.nextCursor, null);
});

test('invalid paths, managed fields and oversized reads fail before changing data', async () => {
  const { repository, records } = fixture();
  await assert.rejects(repository.delete('items/another-document'), TypeError);
  await assert.rejects(repository.create({ role: 'student', createdAt: 'forged' }), TypeError);
  await assert.rejects(repository.update('item', {}), TypeError);
  await assert.rejects(repository.list({ limit: 101 }), RangeError);
  assert.throws(() => createRepository({}, 'requests/request-id'), TypeError);
  assert.equal(records.size, 0);
});
