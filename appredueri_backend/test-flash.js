const pool = require('./src/db');

(async () => {
  try {
    const result = await pool.query(`
      SELECT
        o.id, o.title, o.flash_expires_at,
        b.id as business_id, b.name as business_name,
        b.subscription_badge_type as business_badge_type
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      WHERE o.is_active = TRUE
        AND o.flash_expires_at IS NOT NULL
        AND o.flash_expires_at > NOW()
        AND o.moderation_status IN ('approved', 'auto_approved')
      LIMIT 5
    `);
    console.log('Query OK, rows:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('First row:', JSON.stringify(result.rows[0], null, 2));
    }

    // Now try the FULL query from the flash endpoint
    const fullResult = await pool.query(`
      SELECT
        o.id, o.title, o.description, o.discount_type, o.discount_value,
        o.start_date, o.end_date, o.flash_expires_at,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,
        b.id as business_id, b.name as business_name,
        b.lat, b.lng, b.logo_url as business_logo,
        b.cover_image_url as business_cover,
        b.is_verified as business_verified,
        b.subscription_badge_type as business_badge_type,
        c.name as city_name, cat.name as category_name,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count,
        (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.is_active = TRUE
        AND o.flash_expires_at IS NOT NULL
        AND o.flash_expires_at > NOW()
        AND o.moderation_status IN ('approved', 'auto_approved')
      ORDER BY o.flash_expires_at ASC
      LIMIT 10
    `);
    console.log('Full query OK, rows:', fullResult.rows.length);
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
