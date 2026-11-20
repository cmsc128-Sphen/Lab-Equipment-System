import test from 'node:test'

import assert from 'node:assert/strict'

import { homeForRole, isAccountRole } from './roles.js'

test('known account roles resolve only to their own landing route', () => {
    assert.equal(homeForRole('student'), '/inventory/students')
    assert.equal(homeForRole('lab_aid'), '/inventory/admin')
    assert.equal(homeForRole('admin'), '/inventory/admin')
})

test('unsupported and missing roles do not default to a privileged or student route', () => {
    for (const role of ['owner', '', null, undefined]) {
        assert.equal(isAccountRole(role), false)
        assert.equal(homeForRole(role), null)
    }
})
