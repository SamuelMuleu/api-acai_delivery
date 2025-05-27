import * as multerStorageCloudinary from 'multer-storage-cloudinary';
import multer, { StorageEngine } from 'multer';
import path from 'path';
import cloudinary from 'cloudinary';

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const CloudinaryStorage = (multerStorageCloudinary as any).CloudinaryStorage;

const storage = new CloudinaryStorage({
    cloudinary: cloudinary.v2,
    params: {
        folder: 'acai-products',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }],
    },
}) as StorageEngine;

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Apenas imagens são permitidas'));
    },
});

export default upload;
