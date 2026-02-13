/**
 * Curate Pexels Images for OFAI Demo
 *
 * Searches Pexels API for 10 category-appropriate photos per business category
 * + 1 photo per Romanian city. Saves results to pexels-photo-catalog.json.
 *
 * Prerequisites: PEXELS_API_KEY in .env
 * Usage: node scripts/curate-pexels-images.js
 */

require("dotenv").config();

const https = require("https");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error("ERROR: PEXELS_API_KEY not found in .env");
  process.exit(1);
}

// ─── Search Keywords per Category ─────────────────────────────
const CATEGORY_QUERIES = {
  Clinica: "medical clinic interior doctor",
  Frizerie: "barber shop haircut men",
  Beauty: "beauty salon cosmetics nails",
  Auto: "auto repair car mechanic workshop",
  Restaurant: "restaurant food elegant dining",
  Cafenea: "coffee shop cafe latte art",
  Fitness: "gym fitness workout equipment",
  "Spa & Wellness": "spa massage wellness relaxation",
  Optica: "eyeglasses optician frames",
  Farmacie: "pharmacy medicine drugstore",
  Veterinar: "veterinary clinic pet dog cat",
  Stomatologie: "dental clinic dentist teeth",
  Florarie: "flower shop bouquet colorful",
  Curatatorie: "dry cleaning laundry clothes",
  "Foto & Video": "photo studio camera photography",
};

// ─── City Search Queries ──────────────────────────────────────
const CITY_QUERIES = {
  Bucuresti: "Bucharest Romania city",
  "Cluj-Napoca": "Cluj-Napoca Romania city",
  Timisoara: "Timisoara Romania city",
  Iasi: "Iasi Romania city",
  Constanta: "Constanta Romania seaside city",
  Craiova: "Craiova Romania city",
  Brasov: "Brasov Romania city mountains",
  Galati: "Galati Romania Danube city",
  Oradea: "Oradea Romania city architecture",
  Sibiu: "Sibiu Romania city medieval",
  Ploiesti: "Ploiesti Romania city",
  Arad: "Arad Romania city",
  Pitesti: "Pitesti Romania city",
  "Baia Mare": "Baia Mare Romania city",
  "Targu Mures": "Targu Mures Romania city",
};

// ─── Pexels API Request ───────────────────────────────────────
function pexelsSearch(query, perPage = 15, page = 1) {
  return new Promise((resolve, reject) => {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`;

    const options = {
      headers: { Authorization: API_KEY },
    };

    https
      .get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Pexels API ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

// ─── Rate limit helper (200 req/hour = ~3.3 req/sec) ─────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("=== Pexels Image Curation for OFAI Demo ===\n");

  const catalog = {
    categories: {},
    cities: {},
    meta: {
      curatedAt: new Date().toISOString(),
      totalPhotos: 0,
    },
  };

  // ── 1. Search categories ──
  console.log("--- Searching category photos ---");
  const categoryNames = Object.keys(CATEGORY_QUERIES);

  for (const category of categoryNames) {
    const query = CATEGORY_QUERIES[category];
    console.log(`  [${category}] searching: "${query}"...`);

    try {
      const result = await pexelsSearch(query, 15);
      // Take top 10 landscape photos with good dimensions
      const photos = result.photos
        .filter((p) => p.width >= 800 && p.height >= 400)
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          src: p.src.original,
          landscape: p.src.landscape,
          photographer: p.photographer,
          width: p.width,
          height: p.height,
        }));

      catalog.categories[category] = photos;
      catalog.meta.totalPhotos += photos.length;
      console.log(`    -> ${photos.length} photos found`);
    } catch (err) {
      console.error(`    !! ERROR: ${err.message}`);
      catalog.categories[category] = [];
    }

    await sleep(400); // Stay well within rate limit
  }

  // ── 2. Search cities ──
  console.log("\n--- Searching city photos ---");
  const cityNames = Object.keys(CITY_QUERIES);

  for (const city of cityNames) {
    const query = CITY_QUERIES[city];
    console.log(`  [${city}] searching: "${query}"...`);

    try {
      const result = await pexelsSearch(query, 5);

      if (result.photos.length > 0) {
        // Pick the best landscape photo
        const best =
          result.photos.find((p) => p.width > p.height) || result.photos[0];
        catalog.cities[city] = {
          id: best.id,
          src: best.src.original,
          landscape: best.src.landscape,
          photographer: best.photographer,
          width: best.width,
          height: best.height,
        };
        catalog.meta.totalPhotos++;
        console.log(`    -> found (by ${best.photographer})`);
      } else {
        // Fallback: try simpler query
        console.log(`    -> no results, trying fallback...`);
        const fallback = await pexelsSearch(`${city} Romania`, 3);
        if (fallback.photos.length > 0) {
          const best = fallback.photos[0];
          catalog.cities[city] = {
            id: best.id,
            src: best.src.original,
            landscape: best.src.landscape,
            photographer: best.photographer,
            width: best.width,
            height: best.height,
          };
          catalog.meta.totalPhotos++;
          console.log(`    -> fallback found (by ${best.photographer})`);
        } else {
          // Use a generic Romania photo as last resort
          console.log(`    -> no photo found, will use generic`);
          catalog.cities[city] = null;
        }
        await sleep(400);
      }
    } catch (err) {
      console.error(`    !! ERROR: ${err.message}`);
      catalog.cities[city] = null;
    }

    await sleep(400);
  }

  // ── 3. Fill missing cities with generic Romania photos ──
  const missingCities = Object.entries(catalog.cities).filter(
    ([, v]) => v === null
  );
  if (missingCities.length > 0) {
    console.log(`\n--- Filling ${missingCities.length} missing cities with generic Romania photos ---`);
    try {
      const generic = await pexelsSearch("Romania landscape city", 15);
      let idx = 0;
      for (const [city] of missingCities) {
        if (idx < generic.photos.length) {
          const p = generic.photos[idx];
          catalog.cities[city] = {
            id: p.id,
            src: p.src.original,
            landscape: p.src.landscape,
            photographer: p.photographer,
            width: p.width,
            height: p.height,
          };
          catalog.meta.totalPhotos++;
          console.log(`  [${city}] -> generic Romania photo #${idx + 1}`);
          idx++;
        }
      }
    } catch (err) {
      console.error(`  !! Generic search failed: ${err.message}`);
    }
  }

  // ── 4. Save catalog ──
  const outputPath = path.join(__dirname, "pexels-photo-catalog.json");
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));

  console.log("\n=== CURATION COMPLETE ===");
  console.log(`Total photos: ${catalog.meta.totalPhotos}`);
  console.log(`Categories: ${Object.keys(catalog.categories).length}`);
  console.log(`Cities: ${Object.keys(catalog.cities).filter((c) => catalog.cities[c]).length}`);
  console.log(`Saved to: ${outputPath}`);

  // Print summary per category
  console.log("\nPhotos per category:");
  for (const [cat, photos] of Object.entries(catalog.categories)) {
    console.log(`  ${cat}: ${photos.length}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
