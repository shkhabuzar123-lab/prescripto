import multer from "multer";

// Medical reports are analysed in memory and never written to disk.
// Limits keep the request under Gemini's 20 MB inline request cap once base64-encoded.
const MAX_FILES = 3
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB each (Gemini inline requests are capped at 20 MB total)

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
    fileFilter: (req, file, cb) => {
        if (ALLOWED.includes(file.mimetype)) return cb(null, true)
        cb(new Error("Only JPG, PNG, WEBP, GIF images or PDF files are supported."))
    },
}).array("reports", MAX_FILES)

// Wrapper so multer errors come back as JSON in the same
// { success, message } shape the rest of the API uses.
const reportUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (!err) return next()
        const message = err.code === "LIMIT_FILE_SIZE"
            ? "Each file must be 4 MB or smaller."
            : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
                ? `You can upload up to ${MAX_FILES} files.`
                : err.message
        res.json({ success: false, message })
    })
}

export default reportUpload
