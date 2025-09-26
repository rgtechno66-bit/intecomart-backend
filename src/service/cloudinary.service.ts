import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    // Cloudinary configuration
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // Clean file name - remove double extensions
  private cleanFileName(fileName: string): string {
    // Remove all extensions and keep only the base name
    let cleanName = fileName;
    
    // Remove all extensions (handle cases like .jpg.jpg, .jpeg.png, etc.)
    while (cleanName.includes('.')) {
      cleanName = cleanName.substring(0, cleanName.lastIndexOf('.'));
    }
    
    return cleanName;
  }

  // Upload file to Cloudinary and return the public URL
  async uploadFile(fileBuffer: Buffer, folder: string, fileName: string): Promise<string> {
    try {
      // Clean the file name first
      const cleanFileName = this.cleanFileName(fileName);
      
      // Convert buffer to base64
      const base64File = fileBuffer.toString('base64');
      const dataURI = `data:application/octet-stream;base64,${base64File}`;

      console.log(`Uploading file: ${folder}/${cleanFileName}`);

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: folder,
        public_id: cleanFileName,
        resource_type: 'auto',
      });

      return result.secure_url;
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error);
      throw new Error('Failed to upload file to Cloudinary');
    }
  }

  // Upload image with specific format
  async uploadImage(fileBuffer: Buffer, folder: string, fileName: string): Promise<string> {
    try {
      // Clean the file name first
      const cleanFileName = this.cleanFileName(fileName);
      
      const base64File = fileBuffer.toString('base64');
      const dataURI = `data:image/jpeg;base64,${base64File}`;

      console.log(`Uploading image: ${folder}/${cleanFileName}`);

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: folder,
        public_id: cleanFileName,
        resource_type: 'image',
      });

      return result.secure_url;
    } catch (error) {
      console.error('Error uploading image to Cloudinary:', error);
      throw new Error('Failed to upload image to Cloudinary');
    }
  }

  // Delete multiple files from Cloudinary by URL
  async deleteFiles(fileUrls: string[]): Promise<void> {
    const deletionPromises = fileUrls?.map(async (url) => {
      try {
        // Extract public_id from URL
        const publicId = this.extractPublicIdFromUrl(url);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Successfully deleted file: ${publicId}`);
        }
      } catch (error) {
        console.error(`Failed to delete file from URL ${url}:`, error);
      }
    });

    await Promise.all(deletionPromises);
  }

  // Delete single file from Cloudinary by URL
  async deleteSingleFile(fileUrl: string): Promise<void> {
    console.log(fileUrl);
    try {
      const publicId = this.extractPublicIdFromUrl(fileUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Successfully deleted file: ${publicId}`);
      }
    } catch (error) {
      console.error(`Failed to delete file from URL ${fileUrl}:`, error);
    }
  }

  // Extract public_id from Cloudinary URL - Improved version
  private extractPublicIdFromUrl(url: string): string | null {
    try {
      // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/file_name.jpg
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      
      if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
        // Get all parts after 'upload'
        const publicIdParts = urlParts.slice(uploadIndex + 1);
        
        // Remove version number if present (starts with 'v' followed by numbers)
        const filteredParts = publicIdParts.filter(part => !part.match(/^v\d+$/));
        
        if (filteredParts.length > 0) {
          // Join parts and remove file extension
          const publicId = filteredParts.join('/').split('.')[0];
          return publicId;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting public_id from URL:', error);
      return null;
    }
  }

  // Upload a local file to Cloudinary and return its public URL
  async uploadFileToCloudinary(folderName: string, localFilePath: string, fileName: string): Promise<string> {
    try {
      // Clean the file name first
      const cleanFileName = this.cleanFileName(fileName);
      
      const result = await cloudinary.uploader.upload(localFilePath, {
        folder: folderName,
        public_id: cleanFileName,
        resource_type: 'auto',
      });

      return result.secure_url;
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error);
      throw new Error('Failed to upload file to Cloudinary');
    }
  }
} 