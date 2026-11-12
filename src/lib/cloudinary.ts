import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Uploads an in-memory image (from multer.memoryStorage) and returns its public HTTPS URL. */
export function uploadImage(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'produtos' }, (error, result?: UploadApiResponse) => {
            if (error || !result) return reject(error ?? new Error('Upload retornou vazio'));
            resolve(result.secure_url);
        });
        stream.end(buffer);
    });
}
