/**
 * Update Demo Images: Applies curated Pexels photos to ALL businesses
 *
 * Reads pexels-photo-catalog.json and updates:
 * 1. Business cover images (all businesses)
 * 2. Gallery images (3-5 per business)
 * 3. Offer images (all offers)
 *
 * Prerequisites: Run curate-pexels-images.js first
 * Usage: node scripts/update-demo-images.js
 */

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  statement_timeout: 60000,
});

// ─── Pexels URL helpers ───────────────────────────────────────
// Pexels original URLs look like:
//   https://images.pexels.com/photos/12345/pexels-photo-12345.jpeg
// We can add query params for resizing without downloading:
function coverUrl(photo) {
  return `${photo.src}?auto=compress&cs=tinysrgb&w=1200&h=600&fit=crop`;
}
function galleryUrl(photo) {
  return `${photo.src}?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop`;
}
function offerUrl(photo) {
  return `${photo.src}?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop`;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("=== OFAI Demo Images Update ===\n");

  // 1. Load catalog
  const catalogPath = path.join(__dirname, "pexels-photo-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("ERROR: pexels-photo-catalog.json not found!");
    console.error("Run: node scripts/curate-pexels-images.js first");
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log(`Loaded catalog: ${catalog.meta.totalPhotos} photos\n`);

  // Verify minimum photos per category
  for (const [cat, photos] of Object.entries(catalog.categories)) {
    if (!photos || photos.length < 3) {
      console.warn(`WARNING: ${cat} has only ${photos?.length || 0} photos (need at least 3)`);
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 2. Get ALL businesses with their category ──
    const { rows: businesses } = await client.query(`
      SELECT b.id, b.name, c.name as category_name
      FROM businesses b
      JOIN categories c ON b.category_id = c.id
      ORDER BY b.id
    `);
    console.log(`Found ${businesses.length} businesses\n`);

    if (businesses.length === 0) {
      console.log("No businesses found. Nothing to update.");
      await client.query("ROLLBACK");
      return;
    }

    // ── 3. Update cover images ──
    console.log("--- Updating cover images ---");
    let coverCount = 0;
    // Track index per category for round-robin
    const categoryIndex = {};

    for (const biz of businesses) {
      const photos = catalog.categories[biz.category_name];
      if (!photos || photos.length === 0) {
        continue;
      }

      // Round-robin index per category
      if (!(biz.category_name in categoryIndex)) {
        categoryIndex[biz.category_name] = 0;
      }
      const idx = categoryIndex[biz.category_name] % photos.length;
      categoryIndex[biz.category_name]++;

      const url = coverUrl(photos[idx]);
      await client.query(
        "UPDATE businesses SET cover_image_url = $1 WHERE id = $2",
        [url, biz.id]
      );
      coverCount++;
    }
    console.log(`  Updated ${coverCount} cover images\n`);

    // ── 4. Clean existing gallery images ──
    console.log("--- Cleaning old gallery images ---");
    const { rowCount: deletedGallery } = await client.query(`
      DELETE FROM business_images
    `);
    console.log(`  Deleted ${deletedGallery} old gallery images\n`);

    // ── 5. Insert gallery images (3-5 per business) ──
    console.log("--- Inserting gallery images ---");
    let galleryCount = 0;
    const categoryGalleryIndex = {};

    for (const biz of businesses) {
      const photos = catalog.categories[biz.category_name];
      if (!photos || photos.length < 3) {
        continue;
      }

      // 3-5 gallery images per business (deterministic based on id)
      const numImages = 3 + (biz.id % 3); // 3, 4, or 5

      if (!(biz.category_name in categoryGalleryIndex)) {
        categoryGalleryIndex[biz.category_name] = 0;
      }

      for (let g = 0; g < numImages; g++) {
        // Offset by 2 from cover to avoid duplicates
        const photoIdx =
          (categoryGalleryIndex[biz.category_name] + g + 2) % photos.length;
        const url = galleryUrl(photos[photoIdx]);

        await client.query(
          "INSERT INTO business_images (business_id, image_url, image_filename, sort_order) VALUES ($1, $2, $3, $4)",
          [biz.id, url, "pexels-demo.jpg", g + 1]
        );
        galleryCount++;
      }
      categoryGalleryIndex[biz.category_name] += numImages;
    }
    console.log(`  Inserted ${galleryCount} gallery images\n`);

    // ── 6. Update offer images ──
    console.log("--- Updating offer images ---");
    const { rows: offers } = await client.query(`
      SELECT o.id, o.business_id, c.name as category_name
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      JOIN categories c ON b.category_id = c.id
      ORDER BY o.id
    `);
    console.log(`  Found ${offers.length} offers`);

    let offerCount = 0;
    const categoryOfferIndex = {};

    for (const offer of offers) {
      const photos = catalog.categories[offer.category_name];
      if (!photos || photos.length === 0) {
        continue;
      }

      if (!(offer.category_name in categoryOfferIndex)) {
        categoryOfferIndex[offer.category_name] = 0;
      }
      // Offset by 5 from covers/gallery to get different photos
      const idx =
        (categoryOfferIndex[offer.category_name] + 5) % photos.length;
      categoryOfferIndex[offer.category_name]++;

      const url = offerUrl(photos[idx]);
      await client.query("UPDATE offers SET logo_url = $1 WHERE id = $2", [
        url,
        offer.id,
      ]);
      offerCount++;
    }
    console.log(`  Updated ${offerCount} offer images\n`);

    // ── 7. Commit ──
    await client.query("COMMIT");

    console.log("=== UPDATE COMPLETE ===");
    console.log(`  Covers:  ${coverCount}`);
    console.log(`  Gallery: ${galleryCount}`);
    console.log(`  Offers:  ${offerCount}`);
    console.log(`  Total:   ${coverCount + galleryCount + offerCount} image URLs updated`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR — rolled back:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
