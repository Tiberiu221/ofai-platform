/**
 * Verify seed data completeness and distribution
 */
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 3,
  statement_timeout: 30000,
});

async function verify() {
  const client = await pool.connect();
  try {
    // 1. Distribution check (lowest counts)
    const dist = await client.query(`
      SELECT c2.name as city, c.name as category, COUNT(*) as cnt
      FROM businesses b
      JOIN categories c ON b.category_id = c.id
      JOIN cities c2 ON b.city_id = c2.id
      GROUP BY c2.name, c.name
      ORDER BY cnt ASC
      LIMIT 10
    `);
    console.log("=== DISTRIBUTION (lowest 10 pairs) ===");
    dist.rows.forEach((r) =>
      console.log(`  ${r.city} | ${r.category}: ${r.cnt}`)
    );

    // 2. Null/empty descriptions
    const nullDesc = await client.query(
      `SELECT COUNT(*) as cnt FROM businesses WHERE description IS NULL OR description = ''`
    );
    console.log("\n=== NULL/EMPTY FIELDS ===");
    console.log(`  Businesses with null/empty description: ${nullDesc.rows[0].cnt}`);

    const nullOfferDesc = await client.query(
      `SELECT COUNT(*) as cnt FROM offers WHERE description IS NULL OR description = ''`
    );
    console.log(`  Offers with null/empty description: ${nullOfferDesc.rows[0].cnt}`);

    const nullAddr = await client.query(
      `SELECT COUNT(*) as cnt FROM businesses WHERE address IS NULL OR address = ''`
    );
    console.log(`  Businesses with null/empty address: ${nullAddr.rows[0].cnt}`);

    const nullPhone = await client.query(
      `SELECT COUNT(*) as cnt FROM businesses WHERE phone IS NULL OR phone = ''`
    );
    console.log(`  Businesses with null/empty phone: ${nullPhone.rows[0].cnt}`);

    // 3. Booking types distribution
    const bookTypes = await client.query(
      `SELECT booking_type, COUNT(*) as cnt FROM businesses WHERE logo_url LIKE '%dicebear%' GROUP BY booking_type ORDER BY cnt DESC`
    );
    console.log("\n=== BOOKING TYPES ===");
    bookTypes.rows.forEach((r) =>
      console.log(`  ${r.booking_type}: ${r.cnt}`)
    );

    // 4. Locations count
    const locCount = await client.query(
      `SELECT COUNT(*) as cnt FROM business_locations`
    );
    console.log(`\n=== LOCATIONS ===`);
    console.log(`  Total business_locations: ${locCount.rows[0].cnt}`);

    // 5. Offers per business stats
    const offerStats = await client.query(`
      SELECT MIN(c) as min_offers, MAX(c) as max_offers, ROUND(AVG(c), 1) as avg_offers
      FROM (SELECT business_id, COUNT(*) as c FROM offers GROUP BY business_id) sub
    `);
    console.log(`\n=== OFFERS PER BUSINESS ===`);
    const os = offerStats.rows[0];
    console.log(`  Min: ${os.min_offers} | Max: ${os.max_offers} | Avg: ${os.avg_offers}`);

    // 6. Booking instructions filled
    const bookInstr = await client.query(
      `SELECT COUNT(*) as cnt FROM businesses WHERE booking_instructions IS NOT NULL AND booking_instructions != '' AND logo_url LIKE '%dicebear%'`
    );
    console.log(`\n=== BOOKING INSTRUCTIONS ===`);
    console.log(`  Businesses with booking_instructions: ${bookInstr.rows[0].cnt}/450`);

    // 7. Total counts
    const bizCount = await client.query(`SELECT COUNT(*) as cnt FROM businesses`);
    const offCount = await client.query(`SELECT COUNT(*) as cnt FROM offers`);
    console.log(`\n=== TOTALS ===`);
    console.log(`  Total businesses: ${bizCount.rows[0].cnt}`);
    console.log(`  Total offers: ${offCount.rows[0].cnt}`);

    // 8. Sample business with all fields
    const sample = await client.query(
      `SELECT name, description, address, phone, website, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions
       FROM businesses WHERE logo_url LIKE '%dicebear%' LIMIT 3`
    );
    console.log(`\n=== SAMPLE BUSINESSES ===`);
    sample.rows.forEach((s, i) => {
      console.log(`\n  --- Business ${i + 1} ---`);
      console.log(`  Name: ${s.name}`);
      console.log(`  Desc: ${(s.description || "").substring(0, 100)}...`);
      console.log(`  Addr: ${s.address}`);
      console.log(`  Phone: ${s.phone}`);
      console.log(`  Web: ${s.website}`);
      console.log(`  Booking: ${s.booking_type}`);
      console.log(`  Book Phone: ${s.booking_phone || "-"}`);
      console.log(`  Book WA: ${s.booking_whatsapp || "-"}`);
      console.log(`  Book URL: ${s.booking_url || "-"}`);
      console.log(`  Instr: ${s.booking_instructions}`);
    });

    // 9. Sample offers
    const sampleOffers = await client.query(
      `SELECT o.title, o.description, o.discount_type, o.discount_value, o.conditions, o.booking_type, o.booking_instructions
       FROM offers o
       JOIN businesses b ON o.business_id = b.id
       WHERE b.logo_url LIKE '%dicebear%'
       LIMIT 3`
    );
    console.log(`\n=== SAMPLE OFFERS ===`);
    sampleOffers.rows.forEach((o, i) => {
      console.log(`\n  --- Offer ${i + 1} ---`);
      console.log(`  Title: ${o.title}`);
      console.log(`  Desc: ${(o.description || "").substring(0, 100)}...`);
      console.log(`  Discount: ${o.discount_value}${o.discount_type === "percent" ? "%" : " RON"}`);
      console.log(`  Conditions: ${o.conditions}`);
      console.log(`  Booking: ${o.booking_type || "inherit"}`);
      console.log(`  Book Instr: ${o.booking_instructions || "-"}`);
    });

    console.log("\n═══════════════════════════════════════════");
    console.log("✅ VERIFICATION COMPLETE");
    console.log("═══════════════════════════════════════════");

  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
