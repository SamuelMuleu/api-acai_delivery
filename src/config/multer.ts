import * as multerStorageCloudinary from 'multer-storage-cloudinary';
import multer, { StorageEngine } from 'multer';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';



const CloudinaryStorage = (multerStorageCloudinary as any).CloudinaryStorage;

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'acai-products',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }],
    },
}) as StorageEngine;

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Apenas imagens são permitidas'));
    }
});

export default upload;