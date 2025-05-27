declare module 'multer-storage-cloudinary' {
    import { StorageEngine } from 'multer';
    import { UploadApiOptions, v2 as cloudinary } from 'cloudinary';

    interface CloudinaryStorageParams extends UploadApiOptions {
        folder?: string;
        allowedFormats?: string[];
        transformation?: any;
        public_id?: (req: any, file: any) => string;
    }

    interface CloudinaryStorageOptions {
        cloudinary: typeof cloudinary;
        params?: CloudinaryStorageParams | ((req: any, file: any) => CloudinaryStorageParams);
    }

    export class CloudinaryStorage implements StorageEngine {
        constructor(options: CloudinaryStorageOptions);
    }
}
