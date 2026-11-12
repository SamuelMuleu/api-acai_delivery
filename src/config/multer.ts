import multer from 'multer';

// Keeps the file in memory; it is streamed to Cloudinary afterwards
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) return cb(null, true);
        // Reported as a 400 by the error handler
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'imagem: envie JPG, PNG, GIF ou WebP'));
    },
});

export default upload;
