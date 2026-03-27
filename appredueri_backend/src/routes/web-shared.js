/**
 * Web Routes — Shared State
 * Multer config and constants used by multiple web sub-routers.
 */

const multer = require("multer");
const { createImageFilter } = require("../helpers/validate");

const portalUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: createImageFilter(), // Whitelist: JPEG, PNG, WebP, GIF
});

const SALT_ROUNDS = 10;

module.exports = { portalUpload, SALT_ROUNDS };
