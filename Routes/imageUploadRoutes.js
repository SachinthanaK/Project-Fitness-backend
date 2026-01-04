const express = require("express");
const router = express.Router();
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const sharp = require("sharp");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/uploadimage", upload.single("myimage"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ ok: false, error: "No image file provided" });
  }

  try {
    // Step 1: Resize image using sharp
    const resizedBuffer = await sharp(file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .toBuffer();

    // Step 2: Upload to cloudinary using Promise wrapper
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "auto", folder: "fitness-app" },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(resizedBuffer);
    });

    res.json({
      ok: true,
      imageUrl: result.secure_url || result.url,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Image upload error:", error.message || error);
    res.status(500).json({
      ok: false,
      error: "Error uploading image: " + (error.message || "Unknown error"),
    });
  }
});
module.exports = router;
