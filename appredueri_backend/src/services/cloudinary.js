const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Configurare Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload un buffer (din multer memoryStorage) pe Cloudinary
 * @param {Buffer} buffer - File buffer din req.file.buffer
 * @param {string} folder - Folder în Cloudinary (ex: "businesses", "offers")
 * @param {string} publicId - Optional public ID pentru fișier
 * @returns {Promise<{url: string, publicId: string}>}
 */
function uploadToCloudinary(buffer, folder, publicId = null) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: `appreduceri/${folder}`,
      resource_type: "image",
      transformation: [
        { quality: "auto:good" },
        { fetch_format: "auto" }
      ]
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
      uploadOptions.overwrite = true;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Upload error:", error);
          reject(error);
        } else {
          console.log("[Cloudinary] Upload success:", result.secure_url);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
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
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    
    const pathWithVersion = parts[1];
    // Remove version (v123456789/)
    const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, "");
    // Remove extension
    const publicId = pathWithoutVersion.replace(/\.[^/.]+$/, "");
    
    return publicId;
  } catch (error) {
    console.error("[Cloudinary] Error extracting public ID:", error);
    return null;
  }
}

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
  cloudinary,
};
