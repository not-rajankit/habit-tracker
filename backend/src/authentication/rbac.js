import pool from '../db.js';

export async function getUserRolesAndPermissions(userId) {
  const result = await pool.query(
    `SELECT
       COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
       COALESCE(array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
     FROM authentication.users u
     LEFT JOIN authentication.user_roles ur ON ur.user_id = u.id
     LEFT JOIN authentication.roles r ON r.id = ur.role_id
     LEFT JOIN authentication.role_permissions rp ON rp.role_id = r.id
     LEFT JOIN authentication.permissions p ON p.id = rp.permission_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  const row = result.rows[0] || {};
  return {
    roles: row.roles || [],
    permissions: row.permissions || [],
  };
}

export async function attachRolesAndPermissions(user) {
  if (!user) return null;
  const access = await getUserRolesAndPermissions(user.id);
  return {
    ...user,
    roles: access.roles,
    permissions: access.permissions,
  };
}

export function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (hasPermission(req.user, permission)) return next();
    return res.status(403).json({ error: 'Permission denied' });
  };
}

export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const userPermissions = new Set(req.user?.permissions || []);
    if (permissions.some((permission) => userPermissions.has(permission))) return next();
    return res.status(403).json({ error: 'Permission denied' });
  };
}

export async function logAdminActivity(actorUserId, action, targetType, targetId, metadata = {}) {
  await pool.query(
    `INSERT INTO admin_activity_logs (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorUserId || null, action, targetType || null, targetId || null, JSON.stringify(metadata)]
  );
}
