export function isProtectedAccount(email: string, roles: string[]): boolean {
  return email.toLowerCase() === 'admin@ehsanproperty.com' ||
    roles.some(role => role === 'admin' || role === 'owner');
}
