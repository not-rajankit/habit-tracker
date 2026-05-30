import pool from '../db.js';

export async function trackEvent(eventName, { userId = null, metadata = {} } = {}) {
  try {
    await pool.query(
      `INSERT INTO analytics_events (user_id, event_name, metadata)
       VALUES ($1, $2, $3)`,
      [userId, eventName, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error(`Analytics event failed: ${eventName}`, err);
  }
}
