/**
 * RBAC Permission Engine
 *
 * Permission format: { "module": ["action", ...] }
 * Wildcard: { "*": ["*"] } = super admin
 *
 * Usage examples:
 *   hasPermission(permissions, 'rfqs', 'create')   → true/false
 *   hasPermission(permissions, 'vendors', 'approve') → true/false
 */

function hasPermission(permissions, module, action) {
  if (!permissions || typeof permissions !== 'object') return false;

  // Super admin wildcard
  if (permissions['*'] && (permissions['*'].includes('*') || permissions['*'].includes(action))) {
    return true;
  }

  // Module wildcard
  if (permissions[module]) {
    if (permissions[module].includes('*')) return true;
    if (permissions[module].includes(action)) return true;
  }

  return false;
}

/**
 * Merge permissions from multiple roles
 * Returns a flat merged permissions object
 */
function mergePermissions(roles) {
  const merged = {};

  for (const role of roles) {
    const perms = role.permissions || {};

    // Super admin shortcut
    if (perms['*']) {
      return { '*': ['*'] };
    }

    for (const [module, actions] of Object.entries(perms)) {
      if (!merged[module]) {
        merged[module] = new Set();
      }
      for (const action of actions) {
        merged[module].add(action);
        if (action === '*') break;
      }
    }
  }

  // Convert sets to arrays
  const result = {};
  for (const [module, actions] of Object.entries(merged)) {
    result[module] = [...actions];
  }
  return result;
}

/**
 * Express middleware factory
 * Usage: router.get('/rfqs', requirePermission('rfqs', 'read'), handler)
 */
function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.permissions) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: no permissions loaded',
        code: 'NO_PERMISSIONS',
      });
    }

    if (!hasPermission(req.permissions, module, action)) {
      return res.status(403).json({
        success: false,
        error: `Access denied: requires ${module}:${action}`,
        code: 'PERMISSION_DENIED',
        required: { module, action },
      });
    }

    next();
  };
}

module.exports = { hasPermission, mergePermissions, requirePermission };
