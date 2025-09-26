// src/faq/faq.service.ts

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Banner,
  ContactUs,
  Faq,
  Gallery,
  Logo,
  PrivacyPolicy,
  SyncControlSettings,
  TallyPathEntity,
  TallySettings,
  TermsConditions,
} from './setting.entity';
import {
  CreateBannerDto,
  CreateContactDto,
  CreateFaqDto,
  CreateGalleryDto,
  CreateLogoDto,
  CreateOrUpdateLogoDto,
  CreatePrivacyPolicyDto,
  CreateSettingDto,
  CreateTermsConditionsDto,
  UpdateBannerDto,
  UpdateFaqDto,
  UpdateGalleryDto,
  UpdateLogoDto,
  UpdateSyncControlSettingsDto,
  UpdateTallySettingsDto,
} from './setting.dto';
import { CloudinaryService } from '../service/cloudinary.service';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(Faq)
    private faqRepository: Repository<Faq>,
  ) {}

  async create(
    createFaqDto: CreateFaqDto,
  ): Promise<{ message: string; data: Faq }> {
    try {
      const faq = this.faqRepository.create(createFaqDto);
      const data = await this.faqRepository.save(faq);
      return { message: 'FAQ Create successfully', data: data };
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error creating FAQ',
        error.message,
      );
    }
  }

  async findAll(): Promise<Faq[]> {
    try {
      return await this.faqRepository.find();
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error retrieving FAQs',
        error.message,
      );
    }
  }

  async findOne(id: string): Promise<Faq> {
    try {
      const faq = await this.faqRepository.findOneBy({ id });
      if (!faq) {
        throw new NotFoundException(`FAQ with ID ${id} not found`);
      }
      return faq;
    } catch (error: any) {
      throw error;
    }
  }

  async update(
    id: string,
    updateFaqDto: UpdateFaqDto,
  ): Promise<{ message: string; data: Faq }> {
    try {
      const faq = await this.findOne(id); // This will throw if not found
      Object.assign(faq, updateFaqDto);
      const result = await this.faqRepository.save(faq);
      return { message: 'FAQ Updated successfully', data: result };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw the not found exception
      }
      throw new InternalServerErrorException(
        'Error updating FAQ',
        error.message,
      );
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      const faq = await this.findOne(id); // This will throw if not found
      await this.faqRepository.delete(faq.id);
      return { message: 'FAQ deleted successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw the not found exception
      }
      throw new InternalServerErrorException(
        'Error deleting FAQ',
        error.message,
      );
    }
  }

  // Delete multiple faq data
  async deleteMultipleFaqData(ids: string[]): Promise<{ message: string }> {
    const notFoundIds: string[] = [];
    for (const id of ids) {
      const faq = await this.faqRepository.findOne({ where: { id } });
      if (!faq) {
        notFoundIds.push(id);
        continue;
      }
      await this.faqRepository.remove(faq);
    }
    if (notFoundIds.length > 0) {
      return { message: 'Some FAQs not found' };
    }
    return { message: 'FAQs deleted successfully' };  }
}
// Privacy policy

@Injectable()
export class PrivacyPolicyService {
  constructor(
    @InjectRepository(PrivacyPolicy)
    private privacyPolicyRepository: Repository<PrivacyPolicy>,
  ) {}

  async create(
    createPrivacyPolicyDto: CreatePrivacyPolicyDto,
  ): Promise<{ message: string; data: PrivacyPolicy }> {
    try {
      const privacyPolicy = this.privacyPolicyRepository.create(
        createPrivacyPolicyDto,
      );
      const savedPolicy =
        await this.privacyPolicyRepository.save(privacyPolicy);
      return {
        message: 'Privacy Policy created successfully',
        data: savedPolicy,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error creating privacy policy',
        error.message,
      );
    }
  }

  async findAll(): Promise<PrivacyPolicy[]> {
    try {
      return await this.privacyPolicyRepository.find();
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error retrieving privacy policies',
        error.message,
      );
    }
  }

  async findOne(id: string): Promise<PrivacyPolicy> {
    try {
      const privacyPolicy = await this.privacyPolicyRepository.findOneBy({
        id,
      });
      if (!privacyPolicy) {
        throw new NotFoundException(`Privacy Policy with ID ${id} not found`);
      }
      return privacyPolicy;
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error retrieving the privacy policy',
        error.message,
      );
    }
  }

  async update(
    id: string,
    updatePrivacyPolicyDto: CreatePrivacyPolicyDto,
  ): Promise<{ message: string; data: PrivacyPolicy }> {
    try {
      const privacyPolicy = await this.findOne(id); // This will throw if not found

      // Merge and save updated privacy policy
      const updatedPolicy = this.privacyPolicyRepository.merge(
        privacyPolicy,
        updatePrivacyPolicyDto,
      );
      const result = await this.privacyPolicyRepository.save(updatedPolicy);

      return { message: 'Privacy Policy updated successfully', data: result };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw the not found exception
      }
      throw new InternalServerErrorException(
        'Error updating privacy policy',
        error.message,
      );
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      const privacyPolicy = await this.findOne(id); // This will throw if not found
      await this.privacyPolicyRepository.delete(privacyPolicy.id);
      return { message: 'content deleted successfully' };
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error deleting privacy policy',
        error.message,
      );
    }
  }
}

// term And Condition

@Injectable()
export class TermsConditionsService {
  constructor(
    @InjectRepository(TermsConditions)
    private termsConditionsRepository: Repository<TermsConditions>,
  ) {}

  async getOrShow(): Promise<TermsConditions | null> {
    try {
      // Use `find` with `take: 1` to get the first Terms and Conditions entry
      const [termsConditions] = await this.termsConditionsRepository.find({
        take: 1,
        order: { id: 'ASC' }, // Adjust ordering if necessary
      });

      return termsConditions || null; // Return null if no entry is found
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error retrieving terms and conditions',
        error.message,
      );
    }
  }

  async createOrUpdate(
    createTermsConditionsDto: CreateTermsConditionsDto,
  ): Promise<{ message: string; data: TermsConditions }> {
    try {
      // Use `find` with `take: 1` to get the first Terms and Conditions entry
      const [termsConditions] = await this.termsConditionsRepository.find({
        take: 1,
        order: { id: 'ASC' }, // Adjust ordering if necessary
      });

      if (termsConditions) {
        // Update existing Terms and Conditions
        const updatedTerms = this.termsConditionsRepository.merge(
          termsConditions,
          createTermsConditionsDto,
        );
        const result = await this.termsConditionsRepository.save(updatedTerms);
        return {
          message: 'Terms and Conditions updated successfully',
          data: result,
        };
      } else {
        // Create new Terms and Conditions if none exists
        const newTerms = this.termsConditionsRepository.create(
          createTermsConditionsDto,
        );
        const result = await this.termsConditionsRepository.save(newTerms);
        return {
          message: 'Terms and Conditions created successfully',
          data: result,
        };
      }
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error creating or updating terms and conditions',
        error.message,
      );
    }
  }
}

// Contact as

@Injectable()
export class ContactUsService {
  constructor(
    @InjectRepository(ContactUs)
    private contactRepository: Repository<ContactUs>,
  ) {}

  async getOrShow(): Promise<ContactUs | null> {
    try {
      // Use `find` with `take: 1` to get the first Terms and Conditions entry
      const [contactUs] = await this.contactRepository.find({
        take: 1,
        order: { id: 'ASC' }, // Adjust ordering if necessary
      });

      return contactUs || null; // Return null if no entry is found
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error retrieving contact',
        error.message,
      );
    }
  }

  async createOrUpdate(
    createContactDto: CreateContactDto,
  ): Promise<{ message: string; data: ContactUs }> {
    try {
      // Use `find` with `take: 1` to get the first contact entry
      const [contactUs] = await this.contactRepository.find({
        take: 1,
        order: { id: 'ASC' }, // Adjust ordering if necessary
      });

      if (contactUs) {
        // Update existing contact
        const update = this.contactRepository.merge(
          contactUs,
          createContactDto,
        );
        const result = await this.contactRepository.save(update);
        return { message: 'contact updated successfully', data: result };
      } else {
        // Create new contact if none exists
        const newContact = this.contactRepository.create(createContactDto);
        const result = await this.contactRepository.save(newContact);
        return { message: 'contact created successfully', data: result };
      }
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error creating or updating contact',
        error.message,
      );
    }
  }
}

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createBannerWithImages(
    bannerImages: Express.Multer.File[],
    createBannerDto: CreateBannerDto,
  ): Promise<Banner> {
    const imageUrls: string[] = [];

    for (const file of bannerImages) {
      const fileName = `${Date.now()}-${file.originalname}`;
      const imageUrl = await this.cloudinaryService.uploadImage(
        file.buffer,
        'banners',
        fileName,
      );
      imageUrls.push(imageUrl);
    }

    const newBanner = this.bannerRepository.create({
      name: createBannerDto.name,
      type: createBannerDto.type,
      BannerImages: imageUrls,
    });

    return await this.bannerRepository.save(newBanner);
  }

  async updateBannerImages(
    bannerId: string,
    newBannerImages: Express.Multer.File[],
    updateBannerDto: UpdateBannerDto,
  ): Promise<Banner> {
    const banner = await this.bannerRepository.findOne({
      where: { id: bannerId },
    });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }

    // Start with existing images
  let updatedImageUrls: string[] = banner.BannerImages || [];

  if (newBannerImages && newBannerImages.length > 0) {
    // Upload new images without deleting old ones
    const newImageUrls = await Promise.all(
      newBannerImages.map(async (file) => {
        const fileName = `${Date.now()}-${file.originalname}`;
        return await this.cloudinaryService.uploadImage(
          file.buffer,
          'banners',
          fileName,
        );
      }),
    );

    // Combine existing and new images
    updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
  }

  banner.name = updateBannerDto.name || banner.name;
  banner.type = updateBannerDto.type || banner.type;
  banner.BannerImages = updatedImageUrls;

  return await this.bannerRepository.save(banner);
  }

  // Get all banners
  async getAllBanners(): Promise<Banner[]> {
    return await this.bannerRepository.find();
  }

  // Get a specific banner by ID
  async getBannerById(bannerId: string): Promise<Banner> {
    const banner = await this.bannerRepository.findOne({
      where: { id: bannerId },
    });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  async deleteBanner(bannerId: string): Promise<{ message: string }> {
    // Find the banner by ID
    const banner = await this.bannerRepository.findOne({
      where: { id: bannerId },
    });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }

    // Check if the banner has associated images and delete them from Cloudinary
    if (banner.BannerImages && banner.BannerImages.length > 0) {
      try {
        await this.cloudinaryService.deleteFiles(banner.BannerImages);
      } catch (error) {
        throw new Error('Failed to delete associated images from Cloudinary');
      }
    }
    // Finally, delete the banner from the database
    await this.bannerRepository.delete(bannerId);
    // Return a success message
    return { message: `Banner image has been deleted successfully.` };
  }

  // Delete multiple banners by IDs
  async deleteMultipleBannerData(ids: string[]): Promise<{ message: string }> {
    const notFoundIds: string[] = [];
    for (const id of ids) {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        notFoundIds.push(id);
        continue;
      }
      if (banner.BannerImages && banner.BannerImages.length > 0) {
        try {
          await this.cloudinaryService.deleteFiles(banner.BannerImages);
        } catch (error) {
          console.error(`Failed to delete images from Cloudinary for banner ${id}:`, error);
          // Continue with database deletion even if Cloudinary fails
        }
      }
      await this.bannerRepository.remove(banner);
    }
    return { message: `Successfully deleted banners${notFoundIds.length > 0 ? `, ${notFoundIds.length} not found` : ''}` };
  }

  async deleteBannerImages(
    bannerId: string,
    bannerImages?: string[], // Array of image URLs to delete
  ): Promise<Banner> {
    // Find the existing banner
    const banner = await this.bannerRepository.findOne({
      where: { id: bannerId },
    });

    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    // Delete specified product images from Cloudinary if URLs are provided

    if (bannerImages?.length) {
      await this.cloudinaryService.deleteFiles(bannerImages);
      // Remove deleted product image URLs from the item
      banner.BannerImages = banner.BannerImages.filter(
        (url) => !bannerImages.includes(url),
      );
    }

    // Save the updated banner entity
    return await this.bannerRepository.save(banner);
  }

  // Delete multiple banners by IDs
  async deleteAllBannerImages(bannerId: string): Promise<{ message: string }> {
    const banner = await this.bannerRepository.findOne({
      where: { id: bannerId },
    });
    
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
  
    if (!banner.BannerImages || banner.BannerImages.length === 0) {
      throw new NotFoundException('No images found in the banner');
    }
  
    // Delete images from Cloudinary
    await this.cloudinaryService.deleteFiles(banner.BannerImages);
  
    // Clear the images array
    banner.BannerImages = [];
    await this.bannerRepository.save(banner);
  
    return { message: 'All banner images deleted successfully' };
  }
}

@Injectable()
export class SyncControlSettingsService {
  constructor(
    @InjectRepository(SyncControlSettings)
    private readonly repository: Repository<SyncControlSettings>,
  ) {}

  async createOrUpdate(
    dto: UpdateSyncControlSettingsDto,
  ): Promise<SyncControlSettings> {
    const { moduleName, isAutoSyncEnabled, isManualSyncEnabled } = dto;

    let setting = await this.repository.findOne({ where: { moduleName } });
    if (!setting) {
      setting = this.repository.create({
        moduleName,
        isAutoSyncEnabled,
        isManualSyncEnabled,
      });
    } else {
      setting.isAutoSyncEnabled = isAutoSyncEnabled;
      setting.isManualSyncEnabled = isManualSyncEnabled;
    }

    return this.repository.save(setting);
  }

  async findAll(): Promise<SyncControlSettings[]> {
    return this.repository.find();
  }

  async findById(id: number): Promise<SyncControlSettings> {
    const setting = await this.repository.findOne({ where: { id } });
    if (!setting) {
      throw new NotFoundException('Sync setting not found');
    }
    return setting;
  }

  async delete(id: number): Promise<void> {
    const setting = await this.findById(id);
    await this.repository.remove(setting);
  }
}

@Injectable()
export class TallySettingsService {
  constructor(
    @InjectRepository(TallySettings)
    private readonly repository: Repository<TallySettings>,
  ) {}

  async createOrUpdate(dto: UpdateTallySettingsDto): Promise<TallySettings> {
    const { name, value } = dto;

    let setting = await this.repository.findOne({ where: { name } });
    if (!setting) {
      setting = this.repository.create({ name, value });
    } else {
      setting.value = value ?? setting.value;
    }

    return this.repository.save(setting);
  }

  async findAll(): Promise<TallySettings[]> {
    return this.repository.find();
  }

  async findById(id: string): Promise<TallySettings> {
    const setting = await this.repository.findOne({ where: { id } });
    if (!setting) {
      throw new NotFoundException('Tally setting not found');
    }
    return setting;
  }

  async delete(id: string): Promise<void> {
    const setting = await this.findById(id);
    await this.repository.remove(setting);
  }
}

@Injectable()
export class LogoService {
  constructor(
    @InjectRepository(Logo)
    private logoRepository: Repository<Logo>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createOrUpdateLogo(
    logoFile: Express.Multer.File,
    createOrUpdateLogoDto: CreateOrUpdateLogoDto,
  ): Promise<Logo> {
    let logo = await this.logoRepository.findOne({ where: {} });

    if (logo && logo.logoImage) {
      await this.cloudinaryService.deleteSingleFile(logo.logoImage);
    } else {
      logo = this.logoRepository.create();
    }

    const fileName = `${Date.now()}-${logoFile.originalname}`;
    const uploadedLogoUrl = await this.cloudinaryService.uploadImage(
      logoFile.buffer,
      'logos',
      fileName,
    );

    logo.name = createOrUpdateLogoDto.name || logo.name;
    logo.logoImage = uploadedLogoUrl;

    return await this.logoRepository.save(logo);
  }

  // Retrieve the existing logo
  async getLogo(): Promise<Logo> {
    const logo = await this.logoRepository.findOne({ where: {} });
    if (!logo) {
      throw new NotFoundException('Logo not found');
    }
    return logo;
  }
}

@Injectable()
export class TallyPathService {
  constructor(
    @InjectRepository(TallyPathEntity)
    private readonly settingRepository: Repository<TallyPathEntity>,
  ) {}

  async createOrUpdateSetting(
    createSettingDto: CreateSettingDto,
  ): Promise<TallyPathEntity> {
    let setting = await this.settingRepository.findOne({
      where: { key: createSettingDto.key },
    });

    if (setting) {
      // Update the value if the key exists
      setting.value = createSettingDto.value;
    } else {
      // Create a new setting if the key does not exist
      setting = this.settingRepository.create(createSettingDto);
    }

    return this.settingRepository.save(setting);
  }

  async getTallyPath(): Promise<string> {
    const setting = await this.settingRepository.findOne({ where: {} });
    if (!setting || !setting.value) {
      throw new NotFoundException('Path not found');
    }

    // Format the path for display with single backslashes
    return setting.value.replace(/\\\\/g, '\\');
  }
}

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Gallery)
    private galleryRepository: Repository<Gallery>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createGalleryWithImages(
    galleryImages: Express.Multer.File[],
    createGalleryDto: CreateGalleryDto,
  ): Promise<Gallery> {
    try {
      const imageUrls: string[] = [];

      for (const file of galleryImages) {
        try {
          const fileName = `${Date.now()}-${file.originalname}`;
          const imageUrl = await this.cloudinaryService.uploadImage(
            file.buffer,
            'gallery',
            fileName,
          );
          imageUrls.push(imageUrl);
        } catch (error) {
          console.error(`Error uploading image: ${file.originalname}`, error);
          throw new BadRequestException(
            `Failed to upload image: ${file.originalname}`,
          );
        }
      }

      const newGallery = this.galleryRepository.create({
        name: createGalleryDto.name,
        type: createGalleryDto.type,
        GalleryImages: imageUrls,
      });

      return await this.galleryRepository.save(newGallery);
    } catch (error) {
      console.error('Error creating gallery with images', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the gallery',
      );
    }
  }

  async updateGalleryImages(
    galleryId: string,
    newGalleryImages: Express.Multer.File[],
    updateGalleryDto: UpdateGalleryDto,
  ): Promise<Gallery> {
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId },
    });
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    let updatedImageUrls: string[] = gallery.GalleryImages || [];

    if (newGalleryImages && newGalleryImages.length > 0) {
      const newImageUrls = await Promise.all(
        newGalleryImages.map(async (file) => {
          const fileName = `${Date.now()}-${file.originalname}`;
          return await this.cloudinaryService.uploadImage(
            file.buffer,
            'gallery',
            fileName,
          );
        }),
      );

      updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
    }

    gallery.name = updateGalleryDto.name || gallery.name;
    gallery.type = updateGalleryDto.type || gallery.type;
    gallery.GalleryImages = updatedImageUrls;

    return await this.galleryRepository.save(gallery);
  }

  // Get all banners
  async getAllGallery(): Promise<Gallery[]> {
    return await this.galleryRepository.find();
  }

  // Get a specific gallery by ID
  async getGalleryById(galleryId: string): Promise<Gallery> {
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId },
    });
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }
    return gallery;
  }

  async deleteGallery(galleryId: string): Promise<{ message: string }> {
    // Find the gallery by ID
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId },
    });
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    // Check if the gallery has associated images and delete them from Cloudinary
    if (gallery.GalleryImages && gallery.GalleryImages.length > 0) {
      try {
        await this.cloudinaryService.deleteFiles(gallery.GalleryImages);
      } catch (error) {
        throw new Error('Failed to delete associated images from Cloudinary');
      }
    }
    // Finally, delete the gallery from the database
    await this.galleryRepository.delete(galleryId);
    // Return a success message
    return { message: `Gallery image has been deleted successfully.` };
  }

  async deleteGalleryImages(
    galleryId: string,
    galleryImages: string[], // Array of image URLs to delete
  ): Promise<Gallery> {
    // Find the existing gallery
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId },
    });

    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    // Check if images exist in the gallery
    if (galleryImages?.length) {
      await this.cloudinaryService.deleteFiles(galleryImages);
      // Remove deleted product image URLs from the item
      gallery.GalleryImages = gallery.GalleryImages.filter(
        (url) => !galleryImages.includes(url),
      );
    }
    // Save the updated gallery entity
    return await this.galleryRepository.save(gallery);
  }

  async deleteAllGalleryImages(galleryId: string): Promise<Gallery> {
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId },
    });

    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    if (!gallery.GalleryImages || gallery.GalleryImages.length === 0) {
      throw new NotFoundException('No images found in the gallery');
    }

    await this.cloudinaryService.deleteFiles(gallery.GalleryImages);

    gallery.GalleryImages = [];

    return await this.galleryRepository.save(gallery);
  }

  // Delete multiple  Gallery data
  async deleteMultipleGalleryData(ids: string[]): Promise<{ message: string;notFoundIds: string[] }> {
    const notFoundIds: string[] = [];
   
    for (const id of ids) {
      const gallery = await this.galleryRepository.findOne({ where: { id } });
      if (!gallery) {
        notFoundIds.push(id);
        continue;
      }
  
      // Delete images from Cloudinary first
      if (gallery.GalleryImages && gallery.GalleryImages.length > 0) {
        try {
          await this.cloudinaryService.deleteFiles(gallery.GalleryImages);
        } catch (error) {
          console.error(`Failed to delete images from Cloudinary for gallery ${id}:`, error);
          // Continue with database deletion even if Cloudinary fails
        }
      }
  
      // Delete from database
      await this.galleryRepository.remove(gallery);
    
    }
  
    return { 
      message: `Successfully deleted galleries${notFoundIds.length > 0 ? `, ${notFoundIds.length} not found` : ''}`,
      notFoundIds
    };
  }
}
