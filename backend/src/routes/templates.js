import { Router } from 'express';
import pool from '../db.js';
import { trackEvent } from '../analytics/events.js';

const router = Router();

function templateSelect(whereClause = 'WHERE ht.is_active = true') {
  return `
    SELECT
      ht.*,
      c.name AS category_name,
      c.slug AS category_slug,
      c.icon AS category_icon
    FROM habit_templates ht
    LEFT JOIN habit_template_categories c ON c.id = ht.category_id
    ${whereClause}`;
}

router.get('/categories', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM habit_template_categories ORDER BY sort_order ASC, name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching template categories:', err);
    res.status(500).json({ error: 'Failed to fetch template categories' });
  }
});

router.get('/', async (req, res) => {
  try {
    const params = [];
    let where = 'WHERE ht.is_active = true';
    if (req.query.category) {
      params.push(req.query.category);
      where += ` AND c.slug = $${params.length}`;
    }
    if (req.query.featured === 'true') {
      where += ' AND ht.is_featured = true';
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where += ` AND (ht.title ILIKE $${params.length} OR ht.description ILIKE $${params.length})`;
    }

    const result = await pool.query(
      `${templateSelect(where)} ORDER BY ht.is_featured DESC, ht.usage_count DESC, ht.title ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.get('/packs', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         COALESCE(json_agg(
           json_build_object(
             'id', ht.id,
             'title', ht.title,
             'description', ht.description,
             'icon', ht.icon,
             'frequency_type', ht.frequency_type,
             'category_name', c.name,
             'sort_order', pi.sort_order
           )
           ORDER BY pi.sort_order ASC, ht.title ASC
         ) FILTER (WHERE ht.id IS NOT NULL), '[]') AS templates
       FROM habit_template_packs p
       LEFT JOIN habit_template_pack_items pi ON pi.pack_id = p.id
       LEFT JOIN habit_templates ht ON ht.id = pi.template_id AND ht.is_active = true
       LEFT JOIN habit_template_categories c ON c.id = ht.category_id
       GROUP BY p.id
       ORDER BY p.is_featured DESC, p.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching template packs:', err);
    res.status(500).json({ error: 'Failed to fetch template packs' });
  }
});

async function importTemplate(client, userId, templateId) {
  const templateResult = await client.query(
    `${templateSelect('WHERE ht.id = $1 AND ht.is_active = true')}`,
    [templateId]
  );
  const template = templateResult.rows[0];
  if (!template) return null;

  const habitResult = await client.query(
    `WITH next_order AS (
       SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM habits WHERE user_id = $5
     )
     INSERT INTO habits (name, frequency, icon, category, sort_order, user_id)
     SELECT $1, $2, $3, $4, value, $5 FROM next_order
     RETURNING *`,
    [
      template.title,
      template.frequency_type || 'daily',
      template.icon || '✅',
      template.category_name || null,
      userId,
    ]
  );
  await client.query(
    `UPDATE habit_templates SET usage_count = usage_count + 1 WHERE id = $1`,
    [templateId]
  );
  return { template, habit: habitResult.rows[0] };
}

router.post('/:id/import', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const imported = await importTemplate(client, req.user.id, req.params.id);
    if (!imported) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Template not found' });
    }
    await client.query('COMMIT');
    await trackEvent('template_imported', {
      userId: req.user.id,
      metadata: { template_id: imported.template.id, habit_id: imported.habit.id },
    });
    res.status(201).json(imported.habit);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing template:', err);
    res.status(500).json({ error: 'Failed to import template' });
  } finally {
    client.release();
  }
});

router.post('/packs/:id/import', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = await client.query(
      `SELECT template_id
       FROM habit_template_pack_items
       WHERE pack_id = $1
       ORDER BY sort_order ASC`,
      [req.params.id]
    );
    if (items.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pack not found or empty' });
    }

    const habits = [];
    for (const item of items.rows) {
      const imported = await importTemplate(client, req.user.id, item.template_id);
      if (imported) habits.push(imported.habit);
    }

    await client.query('COMMIT');
    await trackEvent('pack_imported', {
      userId: req.user.id,
      metadata: { pack_id: req.params.id, habit_count: habits.length },
    });
    res.status(201).json({ habits });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing pack:', err);
    res.status(500).json({ error: 'Failed to import pack' });
  } finally {
    client.release();
  }
});

export default router;
