export const accountRoles = ['student', 'lab_aid', 'admin']

export function isAccountRole(role) {
    return accountRoles.includes(role)
}

export function homeForRole(role) {
    if (role === 'student') {
        return '/inventory/students'
    }

    if (role === 'lab_aid' || role === 'admin') {
        return '/inventory/admin'
    }

    return null
}
