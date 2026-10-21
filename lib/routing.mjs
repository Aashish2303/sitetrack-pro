const roles = ['md', 'engineer', 'sales', 'qms', 'accounts', 'admin'];
export const financeRoles = ['md', 'qms', 'accounts', 'admin'];
const directoryRoles = ['md', 'sales', 'admin'];
const modules = ['today', 'projects', 'dwr', 'dpr', 'boq', 'materials', 'indents', 'labour', 'issues', 'subcon', 'vendorledger', 'orders', 'vendordb', 'reports'];
const createModules = modules.filter(m => !['today', 'boq', 'reports'].includes(m));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function moduleForPath(path) {
  return modules.find(m => path === `/${m}` || path.startsWith(`/${m}/`)) || null;
}

export function isAppPath(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 1) return modules.includes(parts[0]);
  if (parts.length === 3 && ['projects', 'labour'].includes(parts[0]) && uuid.test(parts[1]) && parts[2] === 'edit') return true;
  if (parts.length === 2) {
    if (parts[1] === 'new') return createModules.includes(parts[0]);
    if (parts[0] === 'materials' && parts[1] === 'stock') return true;
    return ['projects', 'indents'].includes(parts[0]) && uuid.test(parts[1]);
  }
  return path === '/materials/transactions/new';
}

export function canAccessPath(path, role) {
  if (!roles.includes(role) || !isAppPath(path)) return false;
  const mod = moduleForPath(path);
  if (['subcon', 'vendorledger'].includes(mod) && !financeRoles.includes(role)) return false;
  if (mod === 'vendordb' && !directoryRoles.includes(role)) return false;
  if (path.endsWith('/new') && ['dwr', 'dpr', 'indents'].includes(mod)) {
    return ['engineer', 'qms', 'md', 'admin'].includes(role);
  }
  return true;
}

// Only known relative app URLs can become a post-login destination.
export function safeReturnTo(value, role) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/today';
  try {
    const url = new URL(value, 'https://sitetrack.invalid');
    if (url.origin !== 'https://sitetrack.invalid' || !isAppPath(url.pathname)) return '/today';
    if (role && !canAccessPath(url.pathname, role)) return '/today';
    return url.pathname + url.search + url.hash;
  } catch { return '/today'; }
}
