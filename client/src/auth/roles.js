export function homeForRole(role) {
    if (role === 'lab_aid' || role === 'admin') {
        return '/inventory/admin'
    }

    return '/inventory/students'
}
