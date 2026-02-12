// Test the owners route logic directly against the production database
require('dotenv').config();
const pool = require('./src/db');

(async () => {
  try {
    const businessId = 1570;
    const email = 'test@appredueri.ro';

    console.log('Step 1: Finding user...');
    const userQuery = await pool.query(
      "SELECT id, role FROM users WHERE LOWER(email) = $1",
      [email]
    );
    console.log('User result:', userQuery.rows);

    if (userQuery.rows.length === 0) {
      console.log('User not found');
      process.exit(0);
    }

    const user = userQuery.rows[0];
    console.log('Found user:', user);

    console.log('Step 2: Checking existing relation...');
    const checkQuery = await pool.query(
      "SELECT 1 FROM user_businesses WHERE user_id = $1 AND business_id = $2",
      [user.id, businessId]
    );
    console.log('Check result:', checkQuery.rows);

    if (checkQuery.rows.length > 0) {
      console.log('Already exists!');
      process.exit(0);
    }

    console.log('Step 3: Inserting...');
    await pool.query(
      "INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)",
      [user.id, businessId]
    );
    console.log('Insert OK!');

    if (user.role === 'user') {
      console.log('Step 4: Updating role...');
      await pool.query(
        "UPDATE users SET role = 'business_owner' WHERE id = $1",
        [user.id]
      );
      console.log('Role updated');
    }

    console.log('=== SUCCESS ===');
    process.exit(0);
  } catch (err) {
    console.error('=== ERROR ===');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
})();
