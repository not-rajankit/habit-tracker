import { Router } from 'express';
import pool from '../db.js';
import { logAdminActivity, requireAnyPermission, requirePermission } from '../authentication/rbac.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function badRequest(res, error) {
  return res.status(400).json({ error });
}

function validateUuid(id, res) {
  if (UUID_RE.test(String(id))) return true;
  badRequest(res, 'Invalid id');
  return false;
}

router.use(requireAnyPermission([
  'manage_users',
  'manage_templates',
  'manage_categories',
  'manage_packs',
  'view_analytics',
  'manage_roles',
  'manage_system_settings',
]));

router.get('/overview', requirePermission('view_analytics'), async (_req, res) => {
  try {
    const [users, activity, templates, completions, imports, logs] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_users,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_signups_7d,
           COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE)::int AS active_today,
           COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '7 days')::int AS active_7d,
           COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '30 days')::int AS active_30d
         FROM authentication.users`
      ),
      pool.query(
        `SELECT event_name, COUNT(*)::int AS count
         FROM analytics_events
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY event_name
         ORDER BY count DESC`
      ),
      pool.query(
        `SELECT ht.title, ht.usage_count, c.name AS category_name
         FROM habit_templates ht
         LEFT JOIN habit_template_categories c ON c.id = ht.category_id
         ORDER BY ht.usage_count DESC, ht.title ASC
         LIMIT 8`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE event_name = 'habit_completed')::int AS completed,
           COUNT(*) FILTER (WHERE event_name = 'habit_created')::int AS created
         FROM analytics_events
         WHERE created_at >= NOW() - INTERVAL '30 days'`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS imported
         FROM analytics_events
         WHERE event_name IN ('template_imported', 'pack_imported')`
      ),
      pool.query(
        `SELECT aal.*, u.email AS actor_email
         FROM admin_activity_logs aal
         LEFT JOIN authentication.users u ON u.id = aal.actor_user_id
         ORDER BY aal.created_at DESC
         LIMIT 10`
      ),
    ]);

    const completionRow = completions.rows[0];
    const created = Number(completionRow.created || 0);
    const completed = Number(completionRow.completed || 0);
    res.json({
      metrics: {
        ...users.rows[0],
        habit_completion_rate: created > 0 ? Math.round((completed / created) * 100) : 0,
        template_adoption_count: imports.rows[0].imported,
      },
      activity: activity.rows,
      popular_templates: templates.rows,
      recent_admin_activity: logs.rows,
    });
  } catch (err) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

router.get('/analytics', requirePermission('view_analytics'), async (_req, res) => {
  try {
    const [events, categories, retention] = await Promise.all([
      pool.query(
        `SELECT date_trunc('day', created_at)::date AS date, event_name, COUNT(*)::int AS count
         FROM analytics_events
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY date, event_name
         ORDER BY date DESC, event_name ASC`
      ),
      pool.query(
        `SELECT c.name, COUNT(ae.id)::int AS imports
         FROM habit_template_categories c
         LEFT JOIN habit_templates ht ON ht.category_id = c.id
         LEFT JOIN analytics_events ae
           ON ae.event_name = 'template_imported'
          AND (ae.metadata->>'template_id')::uuid = ht.id
         GROUP BY c.id
         ORDER BY imports DESC, c.name ASC`
      ),
      pool.query(
        `WITH signups AS (
           SELECT id, created_at::date AS signup_date FROM authentication.users
         )
         SELECT
           COUNT(*)::int AS signup_count,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM analytics_events ae
             WHERE ae.user_id = signups.id AND ae.created_at::date >= signups.signup_date + 1
           ))::int AS day_1,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM analytics_events ae
             WHERE ae.user_id = signups.id AND ae.created_at::date >= signups.signup_date + 7
           ))::int AS day_7,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM analytics_events ae
             WHERE ae.user_id = signups.id AND ae.created_at::date >= signups.signup_date + 30
           ))::int AS day_30
         FROM signups`
      ),
    ]);
    res.json({ events: events.rows, categories: categories.rows, retention: retention.rows[0] });
  } catch (err) {
    console.error('Error fetching admin analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/users', requirePermission('manage_users'), async (req, res) => {
  try {
    const params = [];
    const where = [];
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`u.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT
         u.id, u.email, u.name, u.avatar_url, u.auth_provider, u.status,
         u.created_at, u.updated_at, u.last_active_at,
         COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM authentication.users u
       LEFT JOIN authentication.user_roles ur ON ur.user_id = u.id
       LEFT JOIN authentication.roles r ON r.id = ur.role_id
       ${whereSql}
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/status', requirePermission('suspend_users'), async (req, res) => {
  try {
    if (!validateUuid(req.params.id, res)) return;
    const status = req.body.status;
    if (!['active', 'suspended'].includes(status)) return badRequest(res, 'Invalid status');
    if (req.params.id === req.user.id && status === 'suspended') {
      return badRequest(res, 'You cannot suspend your own account');
    }

    const result = await pool.query(
      `UPDATE authentication.users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, status`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAdminActivity(req.user.id, `user_${status}`, 'user', req.params.id, { email: result.rows[0].email });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.get('/roles', requirePermission('manage_roles'), async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM authentication.roles ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.put('/users/:id/roles', requirePermission('manage_roles'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!validateUuid(req.params.id, res)) return;
    const roles = Array.isArray(req.body.roles) ? req.body.roles : [];
    const allowed = roles.every((role) => ['Admin', 'User'].includes(role));
    if (!allowed) return badRequest(res, 'Only Admin and User roles can be assigned here');
    if (req.params.id === req.user.id && !roles.includes('Admin')) {
      return badRequest(res, 'You cannot remove your own admin access');
    }

    await client.query('BEGIN');
    await client.query(
      `DELETE FROM authentication.user_roles
       WHERE user_id = $1
         AND role_id IN (SELECT id FROM authentication.roles WHERE name IN ('Admin', 'User'))`,
      [req.params.id]
    );
    for (const role of roles) {
      await client.query(
        `INSERT INTO authentication.user_roles (user_id, role_id, assigned_by)
         SELECT $1, id, $2 FROM authentication.roles WHERE name = $3
         ON CONFLICT DO NOTHING`,
        [req.params.id, req.user.id, role]
      );
    }
    await client.query('COMMIT');
    await logAdminActivity(req.user.id, 'user_roles_updated', 'user', req.params.id, { roles });
    res.json({ id: req.params.id, roles });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating user roles:', err);
    res.status(500).json({ error: 'Failed to update user roles' });
  } finally {
    client.release();
  }
});

router.get('/categories', requirePermission('manage_categories'), async (_req, res) => {
  const result = await pool.query(`SELECT * FROM habit_template_categories ORDER BY sort_order ASC, name ASC`);
  res.json(result.rows);
});

router.post('/categories', requirePermission('manage_categories'), async (req, res) => {
  try {
    const { name, slug, icon, sort_order = 0 } = req.body;
    if (!name || !slug) return badRequest(res, 'Name and slug are required');
    if (!/^[a-z0-9-]+$/i.test(slug.trim())) return badRequest(res, 'Slug can only contain letters, numbers, and hyphens');
    const result = await pool.query(
      `INSERT INTO habit_template_categories (name, slug, icon, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), slug.trim(), icon || null, Number(sort_order) || 0]
    );
    await logAdminActivity(req.user.id, 'category_created', 'category', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(err.code === '23505' ? 409 : 500).json({ error: err.code === '23505' ? 'Category slug already exists' : 'Failed to create category' });
  }
});

router.put('/categories/:id', requirePermission('manage_categories'), async (req, res) => {
  try {
    if (!validateUuid(req.params.id, res)) return;
    const { name, slug, icon, sort_order } = req.body;
    if (slug && !/^[a-z0-9-]+$/i.test(slug.trim())) return badRequest(res, 'Slug can only contain letters, numbers, and hyphens');
    const result = await pool.query(
      `UPDATE habit_template_categories SET
         name = COALESCE($1, name),
         slug = COALESCE($2, slug),
         icon = COALESCE($3, icon),
         sort_order = COALESCE($4, sort_order),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, slug, icon, sort_order, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    await logAdminActivity(req.user.id, 'category_updated', 'category', req.params.id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(err.code === '23505' ? 409 : 500).json({ error: err.code === '23505' ? 'Category slug already exists' : 'Failed to update category' });
  }
});

router.delete('/categories/:id', requirePermission('manage_categories'), async (req, res) => {
  try {
    if (!validateUuid(req.params.id, res)) return;
    const result = await pool.query(`DELETE FROM habit_template_categories WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    await logAdminActivity(req.user.id, 'category_deleted', 'category', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

router.get('/templates', requirePermission('manage_templates'), async (_req, res) => {
  const result = await pool.query(
    `SELECT ht.*, c.name AS category_name
     FROM habit_templates ht
     LEFT JOIN habit_template_categories c ON c.id = ht.category_id
     ORDER BY ht.created_at DESC`
  );
  res.json(result.rows);
});

router.post('/templates', requirePermission('manage_templates'), async (req, res) => {
  try {
    const { title, description, category_id, icon, color, difficulty, frequency_type = 'daily', default_goal = 1, is_featured = false, is_active = true } = req.body;
    if (!title) return badRequest(res, 'Title is required');
    const result = await pool.query(
      `INSERT INTO habit_templates
       (title, description, category_id, icon, color, difficulty, frequency_type, default_goal, is_featured, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [title.trim(), description || null, category_id || null, icon || null, color || null, difficulty || null, frequency_type, Number(default_goal) || 1, Boolean(is_featured), Boolean(is_active), req.user.id]
    );
    await logAdminActivity(req.user.id, 'template_created', 'template', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/templates/:id', requirePermission('manage_templates'), async (req, res) => {
  try {
    if (!validateUuid(req.params.id, res)) return;
    const { title, description, category_id, icon, color, difficulty, frequency_type, default_goal, is_featured, is_active } = req.body;
    const result = await pool.query(
      `UPDATE habit_templates SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category_id = COALESCE($3, category_id),
         icon = COALESCE($4, icon),
         color = COALESCE($5, color),
         difficulty = COALESCE($6, difficulty),
         frequency_type = COALESCE($7, frequency_type),
         default_goal = COALESCE($8, default_goal),
         is_featured = COALESCE($9, is_featured),
         is_active = COALESCE($10, is_active),
         updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [title, description, category_id, icon, color, difficulty, frequency_type, default_goal, is_featured, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    await logAdminActivity(req.user.id, 'template_updated', 'template', req.params.id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', requirePermission('manage_templates'), async (req, res) => {
  try {
    if (!validateUuid(req.params.id, res)) return;
    const result = await pool.query(`DELETE FROM habit_templates WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    await logAdminActivity(req.user.id, 'template_deleted', 'template', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

router.get('/packs', requirePermission('manage_packs'), async (_req, res) => {
  const result = await pool.query(
    `SELECT
       p.*,
       COALESCE(array_agg(ht.title ORDER BY pi.sort_order) FILTER (WHERE ht.id IS NOT NULL), '{}') AS template_titles,
       COALESCE(array_agg(ht.id ORDER BY pi.sort_order) FILTER (WHERE ht.id IS NOT NULL), '{}') AS template_ids
     FROM habit_template_packs p
     LEFT JOIN habit_template_pack_items pi ON pi.pack_id = p.id
     LEFT JOIN habit_templates ht ON ht.id = pi.template_id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );
  res.json(result.rows);
});

router.post('/packs', requirePermission('manage_packs'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, description, cover_image, is_featured = false, template_ids = [] } = req.body;
    if (!title) return badRequest(res, 'Title is required');
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO habit_template_packs (title, description, cover_image, is_featured)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title.trim(), description || null, cover_image || null, Boolean(is_featured)]
    );
    for (let index = 0; index < template_ids.length; index++) {
      await client.query(
        `INSERT INTO habit_template_pack_items (pack_id, template_id, sort_order)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [result.rows[0].id, template_ids[index], index + 1]
      );
    }
    await client.query('COMMIT');
    await logAdminActivity(req.user.id, 'pack_created', 'pack', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating pack:', err);
    res.status(500).json({ error: 'Failed to create pack' });
  } finally {
    client.release();
  }
});

router.put('/packs/:id', requirePermission('manage_packs'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!validateUuid(req.params.id, res)) return;
    const { title, description, cover_image, is_featured, template_ids } = req.body;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE habit_template_packs SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         cover_image = COALESCE($3, cover_image),
         is_featured = COALESCE($4, is_featured),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, description, cover_image, is_featured, req.params.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pack not found' });
    }
    if (Array.isArray(template_ids)) {
      await client.query(`DELETE FROM habit_template_pack_items WHERE pack_id = $1`, [req.params.id]);
      for (let index = 0; index < template_ids.length; index++) {
        await client.query(
          `INSERT INTO habit_template_pack_items (pack_id, template_id, sort_order)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [req.params.id, template_ids[index], index + 1]
        );
      }
    }
    await client.query('COMMIT');
    await logAdminActivity(req.user.id, 'pack_updated', 'pack', req.params.id);
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating pack:', err);
    res.status(500).json({ error: 'Failed to update pack' });
  } finally {
    client.release();
  }
});

router.delete('/packs/:id', requirePermission('manage_packs'), async (req, res) => {
  try {
    if (!validateUuid(req.params.id, res)) return;
    const result = await pool.query(`DELETE FROM habit_template_packs WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    await logAdminActivity(req.user.id, 'pack_deleted', 'pack', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting pack:', err);
    res.status(500).json({ error: 'Failed to delete pack' });
  }
});

router.get('/settings', requirePermission('manage_system_settings'), (_req, res) => {
  res.json({ settings: { platform_content: true, analytics_events: true } });
});

export default router;
