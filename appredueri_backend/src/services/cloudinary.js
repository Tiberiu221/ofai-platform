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
 * REZOLUȚII:
 * - logo:    400x400   (pătrat, pentru avatar/logo business)
 * - cover:   1200x600  (banner landscape 2:1)
 * - gallery: 1200x800  (imagini galerie 3:2)
 * - offer:   800x600   (imagine ofertă 4:3)
 */
const IMAGE_CONFIGS = {
  logo: {
    folder: "businesses/logos",
    width: 400,
    height: 400,
    crop: "fill",
    gravity: "center",
    quality: "auto:good",
    format: "webp"
  },
  cover: {
    folder: "businesses/covers",
    width: 1200,
    height: 600,
    crop: "fill",
    gravity: "auto",
    quality: "auto:good",
    format: "webp"
  },
  gallery: {
    folder: "businesses/gallery",
    width: 1200,
    height: 800,
    crop: "fill",
    gravity: "auto",
    quality: "auto:good",
    format: "webp"
  },
  offer: {
    folder: "offers",
    width: 800,
    height: 600,
    crop: "fill",
    gravity: "auto",
    quality: "auto:good",
    format: "webp"
  },
  profile: {
    folder: "users/profiles",
    width: 300,
    height: 300,
    crop: "fill",
    gravity: "face",
    quality: "auto:good",
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

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
  getTransformedUrl,
  cloudinary,
  IMAGE_CONFIGS,
};
