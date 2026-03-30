const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Configurare Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret || cloudName === 'your_cloud_name') {
  console.warn("⚠️ [Cloudinary] Missing configuration in .env file! Uploads will fail.");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

/**
 * Configurații de transformare pentru diferite tipuri de imagini
 *
 * REZOLUȚII (2x retina-ready):
 * - logo:    800x800   (pătrat, pentru avatar/logo business)
 * - cover:   2400x1200 (banner landscape 2:1, retina)
 * - gallery: 1920x1280 (imagini galerie 3:2, retina)
 * - offer:   1200x900  (imagine ofertă 4:3, retina)
 * - profile: 600x600   (avatar utilizator, retina)
 */
const IMAGE_CONFIGS = {
  logo: {
    folder: "businesses/logos",
    width: 800,
    height: 800,
    crop: "fill",
    gravity: "center",
    quality: "auto:best",
    format: "webp"
  },
  cover: {
    folder: "businesses/covers",
    width: 2400,
    height: 1200,
    crop: "fill",
    gravity: "auto",
    quality: "auto:best",
    format: "webp"
  },
  gallery: {
    folder: "businesses/gallery",
    width: 1920,
    height: 1280,
    crop: "fill",
    gravity: "auto",
    quality: "auto:best",
    format: "webp"
  },
  offer: {
    folder: "offers",
    width: 1200,
    height: 900,
    crop: "fill",
    gravity: "auto",
    quality: "auto:best",
    format: "webp"
  },
  profile: {
    folder: "users/profiles",
    width: 600,
    height: 600,
    crop: "fill",
    gravity: "face",
    quality: "auto:best",
    format: "webp"
  }
};

/**
 * Upload un buffer (din multer memoryStorage) pe Cloudinary
 * Cu transformare imediată (eager) pentru rezoluția specificată
 * 
 * @param {Buffer} buffer - File buffer din req.file.buffer
 * @param {string} imageType - Tipul imaginii: "logo", "cover", "gallery", "offer"
 * @param {string} publicId - Optional public ID pentru fișier
 * @returns {Promise<{url: string, publicId: string, width: number, height: number}>}
 */
function uploadToCloudinary(buffer, imageType, publicId = null) {
  return new Promise((resolve, reject) => {
    // Obține configurația pentru tipul de imagine
    const config = IMAGE_CONFIGS[imageType];

    if (!config) {
      console.error(`[Cloudinary] Unknown image type: ${imageType}`);
      return reject(new Error(`Unknown image type: ${imageType}`));
    }

    // Transformare eager - procesează imediat la upload
    const eagerTransformation = {
      width: config.width,
      height: config.height,
      crop: config.crop,
      gravity: config.gravity,
      quality: config.quality,
      format: config.format
    };

    const uploadOptions = {
      folder: `ofai/${config.folder}`,
      resource_type: "image",
      // Eager transformation - procesează imaginea imediat la dimensiunile dorite
      eager: [eagerTransformation],
      eager_async: false, // Așteaptă procesarea
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
      uploadOptions.overwrite = true;
    }

    console.log(`[Cloudinary] Uploading ${imageType} image`);
    console.log(`[Cloudinary] Target size: ${config.width}x${config.height}`);
    console.log(`[Cloudinary] Folder: ${uploadOptions.folder}`);

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Upload error:", error);
          reject(error);
        } else {
          // Folosește URL-ul din eager transformation (imaginea procesată)
          let finalUrl = result.secure_url;
          let finalWidth = result.width;
          let finalHeight = result.height;

          // Dacă eager a funcționat, folosește URL-ul transformed
          if (result.eager && result.eager.length > 0) {
            finalUrl = result.eager[0].secure_url;
            finalWidth = result.eager[0].width;
            finalHeight = result.eager[0].height;
            console.log(`[Cloudinary] Eager transform applied: ${finalWidth}x${finalHeight}`);
          } else {
            // Fallback: construiește URL-ul cu transformări on-the-fly
            // Înlocuiește /upload/ cu /upload/w_400,h_400,c_fill/
            const transformString = `w_${config.width},h_${config.height},c_${config.crop},g_${config.gravity},q_${config.quality},f_${config.format}`;
            finalUrl = result.secure_url.replace('/upload/', `/upload/${transformString}/`);
            finalWidth = config.width;
            finalHeight = config.height;
            console.log(`[Cloudinary] Using on-the-fly transformation`);
          }

          console.log(`[Cloudinary] Upload success!`);
          console.log(`[Cloudinary] Original: ${result.width}x${result.height}`);
          console.log(`[Cloudinary] Final: ${finalWidth}x${finalHeight}`);
          console.log(`[Cloudinary] URL: ${finalUrl}`);

          resolve({
            url: finalUrl,
            publicId: result.public_id,
            width: finalWidth,
            height: finalHeight,
            originalWidth: result.width,
            originalHeight: result.height,
          });
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Șterge o imagine din Cloudinary
 * @param {string} publicId - Public ID-ul imaginii de șters
 * @returns {Promise<boolean>}
 */
async function deleteFromCloudinary(publicId) {
  try {
    if (!publicId) return false;

    console.log(`[Cloudinary] Deleting image: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("[Cloudinary] Delete result:", result);
    return result.result === "ok";
  } catch (error) {
    console.error("[Cloudinary] Delete error:", error);
    return false;
  }
}

/**
 * Extrage public ID dintr-un URL Cloudinary
 * @param {string} url - URL-ul complet Cloudinary
 * @returns {string|null} - Public ID sau null
 */
function getPublicIdFromUrl(url) {
  if (!url || !url.includes("cloudinary.com")) return null;

  try {
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/folder/filename.ext
    // SAU cu transformări: https://res.cloudinary.com/cloud_name/image/upload/w_400,h_400/v123/folder/filename.ext

    const parts = url.split("/upload/");
    if (parts.length < 2) return null;

    let pathPart = parts[1];

    // Elimină transformările (orice înainte de v123456789/ sau direct folderul)
    // Pattern: poate avea transformări ca w_400,h_400,c_fill/ înainte de versiune
    pathPart = pathPart.replace(/^[^v]*v\d+\//, ''); // Elimină tot până la și inclusiv v123/

    // Dacă nu a găsit versiune, încearcă să elimine transformările
    if (pathPart.includes(',')) {
      // Are transformări, caută primul segment care e folder
      const segments = pathPart.split('/');
      const folderIndex = segments.findIndex(s => !s.includes(',') && !s.match(/^v\d+$/));
      if (folderIndex >= 0) {
        pathPart = segments.slice(folderIndex).join('/');
      }
    }

    // Elimină extensia
    const publicId = pathPart.replace(/\.[^/.]+$/, "");

    return publicId;
  } catch (error) {
    console.error("[Cloudinary] Error extracting public ID:", error);
    return null;
  }
}

/**
 * Generează URL cu transformări pentru o imagine existentă
 * Util pentru a obține diferite dimensiuni din aceeași imagine
 * 
 * @param {string} publicId - Public ID-ul imaginii
 * @param {string} imageType - Tipul de transformare dorit
 * @returns {string} URL-ul cu transformări
 */
function getTransformedUrl(publicId, imageType) {
  const config = IMAGE_CONFIGS[imageType];
  if (!config) return null;

  return cloudinary.url(publicId, {
    width: config.width,
    height: config.height,
    crop: config.crop,
    gravity: config.gravity,
    quality: config.quality,
    format: config.format,
    secure: true
  });
}

/**
 * Upload a raw file (PDF, DOCX, etc.) to Cloudinary.
 * Uses resource_type: 'raw' so no image transformations are applied.
 *
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} originalFilename - Original file name for Cloudinary public_id hint
 * @returns {Promise<{url: string, publicId: string, bytes: number}>}
 */
function uploadRawToCloudinary(buffer, originalFilename) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'ofai/businesses/onboarding',
      resource_type: 'raw',
      use_filename: true,
      unique_filename: true,
    };

    if (originalFilename) {
      // Strip extension for public_id, Cloudinary adds it back
      uploadOptions.public_id = originalFilename.replace(/\.[^/.]+$/, '');
    }

    console.log(`[Cloudinary] Uploading raw file: ${originalFilename || 'unknown'}`);

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Raw upload error:', error);
          reject(error);
        } else {
          console.log(`[Cloudinary] Raw upload success: ${result.secure_url}`);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            bytes: result.bytes,
          });
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Find orphaned Cloudinary images not referenced in any DB table.
 * @param {Object} pool - PG pool instance
 * @param {boolean} dryRun - If true, only log (don't delete)
 * @returns {Promise<{checked: number, orphaned: number, deleted: number}>}
 */
async function cleanupOrphanedImages(pool, dryRun = true) {
  try {
    // 1. Collect all referenced Cloudinary URLs from DB
    const queries = [
      "SELECT image_url AS url FROM business_images WHERE image_url LIKE '%cloudinary%'",
      "SELECT logo_url AS url FROM businesses WHERE logo_url LIKE '%cloudinary%'",
      "SELECT cover_image_url AS url FROM businesses WHERE cover_image_url LIKE '%cloudinary%'",
      "SELECT logo_url AS url FROM offers WHERE logo_url LIKE '%cloudinary%'",
    ];
    const referencedIds = new Set();
    for (const q of queries) {
      const res = await pool.query(q);
      res.rows.forEach(r => {
        const pid = getPublicIdFromUrl(r.url);
        if (pid) referencedIds.add(pid);
      });
    }

    // 2. List all images in Cloudinary ofai/ folder
    let allCloudinary = [];
    let nextCursor = null;
    do {
      const opts = { type: 'upload', prefix: 'ofai/', max_results: 500 };
      if (nextCursor) opts.next_cursor = nextCursor;
      const result = await cloudinary.api.resources(opts);
      allCloudinary = allCloudinary.concat(result.resources.map(r => r.public_id));
      nextCursor = result.next_cursor;
    } while (nextCursor);

    // 3. Find orphans
    const orphaned = allCloudinary.filter(pid => !referencedIds.has(pid));

    console.log(`[Cloudinary Cleanup] Checked: ${allCloudinary.length}, Referenced: ${referencedIds.size}, Orphaned: ${orphaned.length}`);

    // 4. Delete orphans (unless dry run)
    let deleted = 0;
    if (!dryRun && orphaned.length > 0) {
      // Delete in batches of 100 (Cloudinary API limit)
      for (let i = 0; i < orphaned.length; i += 100) {
        const batch = orphaned.slice(i, i + 100);
        await cloudinary.api.delete_resources(batch);
        deleted += batch.length;
      }
      console.log(`[Cloudinary Cleanup] Deleted ${deleted} orphaned images`);
    } else if (orphaned.length > 0) {
      console.log(`[Cloudinary Cleanup] DRY RUN — would delete:`, orphaned.slice(0, 10), orphaned.length > 10 ? `... and ${orphaned.length - 10} more` : '');
    }

    return { checked: allCloudinary.length, orphaned: orphaned.length, deleted };
  } catch (err) {
    console.error('[Cloudinary Cleanup] Error:', err.message);
    return { checked: 0, orphaned: 0, deleted: 0 };
  }
}

module.exports = {
  uploadToCloudinary,
  uploadRawToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
  getTransformedUrl,
  cleanupOrphanedImages,
  cloudinary,
  IMAGE_CONFIGS,
};
