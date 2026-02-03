const express = require("express");
const router = express.Router();
const pool = require("../db");
const { getSummary, canSummarize } = require("../services/llm/summarizationService");

// helper ca în offers.js
function makeAbsoluteUrl(base, maybeUrl) {
  if (!maybeUrl) return null;
  if (
    typeof maybeUrl !== "string" ||
    maybeUrl.startsWith("http://") ||
    maybeUrl.startsWith("https://")
  ) {
    return maybeUrl;
  }
  const cleanBase = base.replace(/\/+$/, "");
  const path = maybeUrl.startsWith("/") ? maybeUrl : `/${maybeUrl}`;
  return `${cleanBase}${path}`;
}

// =======================================
// GET /businesses - listă pentru homepage
// =======================================
router.get("/", async (req, res) => {
  try {
    const { city_id, category_id, q } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (city_id) {
      const cid = parseInt(city_id, 10);
      if (!Number.isNaN(cid)) {
        filters.push(`b.city_id = $${idx}`);
        values.push(cid);
        idx++;
      }
    }

    if (category_id) {
      const catId = parseInt(category_id, 10);
      if (!Number.isNaN(catId)) {
        filters.push(`b.category_id = $${idx}`);
        values.push(catId);
        idx++;
      }
    }

    if (q && q.trim()) {
      filters.push(
        `(b.name ILIKE $${idx} OR c.name ILIKE $${idx} OR cat.name ILIKE $${idx})`
      );
      values.push(`%${q.trim()}%`);
      idx++;
    }

    const whereClause = filters.length
      ? `WHERE ${filters.join(" AND ")}`
      : "";

    const sql = `
      SELECT
        b.id,
        b.name,
        b.address,
        b.phone,
        b.website,
        b.lat,
        b.lng,
        b.city_id,
        b.category_id,
        b.logo_url,
        c.name AS city_name,
        cat.name AS category_name,
        SUM(CASE WHEN o.is_active = TRUE AND o.end_date >= CURRENT_DATE THEN 1 ELSE 0 END) AS active_offers_count,
        COALESCE(AVG(r.rating), 0) as rating_avg,
        COUNT(r.id) as rating_count
      FROM businesses b
      JOIN cities c ON c.id = b.city_id
      JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN offers o ON o.business_id = b.id
      LEFT JOIN reviews r ON r.business_id = b.id
      ${whereClause}
      GROUP BY
        b.id,
        b.name,
        b.address,
        b.phone,
        b.website,
        b.lat,
        b.lng,
        b.city_id,
        b.category_id,
        b.logo_url,
        c.id,
        c.name,
        cat.id,
        cat.name
      ORDER BY c.name, cat.name, b.name;
    `;

    const result = await pool.query(sql, values);
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const businesses = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      website: row.website,
      lat: row.lat,
      lng: row.lng,
      logo_url: makeAbsoluteUrl(baseUrl, row.logo_url),
      city: row.city_id
        ? {
          id: row.city_id,
          name: row.city_name,
        }
        : null,
      category: row.category_id
        ? {
          id: row.category_id,
          name: row.category_name,
        }
        : null,
      active_offers_count: Number(row.active_offers_count || 0),
      rating: parseFloat(parseFloat(row.rating_avg || 0).toFixed(1)),
      rating_count: parseInt(row.rating_count || 0),
    }));

    return res.json(businesses);
  } catch (err) {
    console.error("Eroare la GET /businesses:", err);
    return res
      .status(500)
      .json({ message: "Eroare server la încărcarea business-urilor" });
  }
});

// =======================================
// GET /businesses/:id - detalii complete
// =======================================
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  try {
    // 1. Date principale business + Rating Mediu + BOOKING INFO
    const businessRes = await pool.query(
      `SELECT
        b.id, b.name, b.address, b.phone, b.website, b.lat, b.lng,
        b.logo_url,
        b.cover_image_url,
        b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
        c.id as city_id, c.name as city_name,
        cat.id as cat_id, cat.name as cat_name,
        COALESCE(AVG(r.rating), 0) as rating_avg,
        COUNT(r.id) as rating_count
       FROM businesses b
       LEFT JOIN cities c ON b.city_id = c.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON b.id = r.business_id
       WHERE b.id = $1
       GROUP BY b.id, c.id, c.name, cat.id, cat.name`,
      [id]
    );

    if (businessRes.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    const b = businessRes.rows[0];

    // 2. Imagini (Galerie)
    const imagesRes = await pool.query(
      `SELECT id, image_filename, sort_order
      FROM business_images
      WHERE business_id = $1
      ORDER BY sort_order NULLS LAST, id ASC
      `,
      [id]
    );

    const images = imagesRes.rows.map((img) => ({
      id: img.id,
      url: makeAbsoluteUrl(
        baseUrl,
        `/uploads/businesses/${img.image_filename}`
      ),
      sort_order: img.sort_order,
    }));

    // 3. Locații + BOOKING INFO (de pe locații)
    const locationsRes = await pool.query(
      `SELECT
        bl.id, bl.address, bl.lat, bl.lng, bl.phone,
        bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions,
        c.id as city_id, c.name as city_name
       FROM business_locations bl
       LEFT JOIN cities c ON bl.city_id = c.id
       WHERE business_id = $1`,
      [id]
    );

    // Dacă NU există locații multiple, creăm o "locație virtuală" din datele business-ului
    let locations = [];

    if (locationsRes.rows.length > 0) {
      // Avem locații multiple definite - le folosim pe ele
      locations = locationsRes.rows.map((row) => ({
        id: row.id,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        phone: row.phone,
        city: {
          id: row.city_id,
          name: row.city_name,
        },
        booking_type: row.booking_type || "none",
        booking_phone: row.booking_phone,
        booking_whatsapp: row.booking_whatsapp,
        booking_url: makeAbsoluteUrl(baseUrl, row.booking_url),
        booking_instructions: row.booking_instructions,
      }));
    } else if (b.address) {
      // NU avem locații multiple - creăm o locație virtuală din business
      // cu booking info de pe business
      locations = [{
        id: 'main',
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        phone: b.phone,
        city: {
          id: b.city_id,
          name: b.city_name,
        },
        booking_type: b.booking_type || "none",
        booking_phone: b.booking_phone,
        booking_whatsapp: b.booking_whatsapp,
        booking_url: makeAbsoluteUrl(baseUrl, b.booking_url),
        booking_instructions: b.booking_instructions,
      }];
    }

    // Cover image priority
    const coverImage = b.cover_image_url
      ? makeAbsoluteUrl(baseUrl, b.cover_image_url)
      : (images.length > 0 ? images[0].url : makeAbsoluteUrl(baseUrl, b.logo_url));

    // 4. Review Summary (AI-generated, if available)
    let reviewSummary = null;
    
    try {
      // Check if business has enough reviews for summarization
      const summaryStatus = await canSummarize(id);
      
      if (summaryStatus.can_summarize) {
        // Try to get summary (will use cache if available, or generate new)
        const summaryResult = await getSummary(id);
        reviewSummary = {
          text: summaryResult.summary,
          review_count: summaryResult.review_count,
          generated_at: summaryResult.generated_at,
          is_cached: summaryResult.cached
        };
      }
    } catch (error) {
      // If summary generation fails, log but don't fail the entire request
      console.error(`[Business ${id}] Failed to get review summary:`, error.formatted?.code || error.message);
      // reviewSummary stays null
    }

    return res.json({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      website: b.website,
      lat: b.lat,
      lng: b.lng,
      logo_url: makeAbsoluteUrl(baseUrl, b.logo_url),
      cover_image: coverImage,
      city: {
        id: b.city_id,
        name: b.city_name,
      },
      rating: parseFloat(parseFloat(b.rating_avg).toFixed(1)),
      rating_count: parseInt(b.rating_count),
      category: {
        id: b.cat_id,
        name: b.cat_name,
      },
      images,
      locations,
      // Include booking info la nivel de business pentru referință
      booking: {
        type: b.booking_type || 'none',
        phone: b.booking_phone,
        whatsapp: b.booking_whatsapp,
        url: makeAbsoluteUrl(baseUrl, b.booking_url),
        instructions: b.booking_instructions,
      },
      // AI-generated review summary
      review_summary: reviewSummary
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// =======================================
// GET /businesses/:id/review-summary
// Endpoint dedicat pentru obținerea review summary
// =======================================
router.get("/:id/review-summary", async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if business exists and has enough reviews
    const businessCheck = await pool.query(
      'SELECT name FROM businesses WHERE id = $1',
      [id]
    );
    
    if (businessCheck.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    // Check if can summarize
    const summaryStatus = await canSummarize(id);
    
    if (!summaryStatus.can_summarize) {
      return res.status(400).json({
        error: "Insufficient reviews",
        message: `Business needs at least ${summaryStatus.min_required} reviews for summarization.`,
        current_count: summaryStatus.review_count,
        missing: summaryStatus.missing
      });
    }
    
    // Get or generate summary
    const result = await getSummary(id);
    
    return res.json({
      business_id: parseInt(id),
      business_name: businessCheck.rows[0].name,
      summary: result.summary,
      review_count: result.review_count,
      generated_at: result.generated_at,
      is_cached: result.cached,
      metadata: {
        tokens_used: result.tokens_used,
        cost_usd: result.cost_usd
      }
    });
    
  } catch (error) {
    console.error(`[GET /businesses/${id}/review-summary] Error:`, error);
    
    const formatted = error.formatted || {
      code: 'UNKNOWN_ERROR',
      userMessage: 'Eroare la generarea rezumatului.'
    };
    
    return res.status(500).json({
      error: formatted.code,
      message: formatted.userMessage
    });
  }
});

// =======================================
// POST /businesses/:id/review-summary/regenerate
// Regenerează forțat summary-ul (doar pentru admin)
// =======================================
const adminAuth = require("../middleware/adminAuth");

router.post("/:id/review-summary/regenerate", adminAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if business exists
    const businessCheck = await pool.query(
      'SELECT name FROM businesses WHERE id = $1',
      [id]
    );
    
    if (businessCheck.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    // Check if can summarize
    const summaryStatus = await canSummarize(id);
    
    if (!summaryStatus.can_summarize) {
      return res.status(400).json({
        error: "Insufficient reviews",
        message: `Business needs at least ${summaryStatus.min_required} reviews for summarization.`,
        current_count: summaryStatus.review_count,
        missing: summaryStatus.missing
      });
    }
    
    console.log(`[Admin] Forcing regeneration of summary for business ${id}`);
    
    // Force regenerate (bypass cache)
    const result = await getSummary(id, { force: true });
    
    return res.json({
      success: true,
      message: "Summary regenerated successfully",
      business_id: parseInt(id),
      business_name: businessCheck.rows[0].name,
      summary: result.summary,
      review_count: result.review_count,
      generated_at: result.generated_at,
      metadata: {
        tokens_used: result.tokens_used,
        cost_usd: result.cost_usd
      }
    });
    
  } catch (error) {
    console.error(`[POST /businesses/${id}/review-summary/regenerate] Error:`, error);
    
    const formatted = error.formatted || {
      code: 'UNKNOWN_ERROR',
      userMessage: 'Eroare la regenerarea rezumatului.'
    };
    
    return res.status(500).json({
      error: formatted.code,
      message: formatted.userMessage
    });
  }
});

module.exports = router;
