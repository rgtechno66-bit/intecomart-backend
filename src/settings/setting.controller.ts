// src/faq/faq.controller.ts

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Put,
  HttpStatus,
  Res,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  BannerService,
  ContactUsService,
  FaqService,
  GalleryService,
  LogoService,
  PrivacyPolicyService,
  SyncControlSettingsService,
  TallyPathService,
  TallySettingsService,
  TermsConditionsService,
} from './setting.service';
import {
  CreateBannerDto,
  CreateContactDto,
  CreateFaqDto,
  CreateGalleryDto,
  CreateOrUpdateLogoDto,
  CreatePrivacyPolicyDto,
  CreateSettingDto,
  CreateTermsConditionsDto,
  UpdateBannerDto,
  UpdateFaqDto,
  UpdateGalleryDto,
  UpdateSyncControlSettingsDto,
  UpdateTallySettingsDto,
} from './setting.dto';
import {
  ContactUs,
  PrivacyPolicy,
  TallyPathEntity,
  TermsConditions,
} from './setting.entity';
import { Response } from 'express';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';

// FAQ Controller
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post('create')
  async create(@Body() createFaqDto: CreateFaqDto, @Res() response: Response) {
    const result = await this.faqService.create(createFaqDto);
    return response.status(HttpStatus.OK).json({
      message: result.message,
      data: result.data,
    });
  }

  @Get()
  async findAll(@Res() response: Response) {
    const result = await this.faqService.findAll();
    return response.status(HttpStatus.OK).json({
      length: result.length,
      data: result,
    });
  }

  // Delete multiple faq data
  @Delete('/delete/multiple')
  async deleteMultipleFaqData(@Body('ids') ids: string[]) {
    return this.faqService.deleteMultipleFaqData(ids);
  }
  
  @Get(':id')
  async findOne(@Param('id') id: string, @Res() response: Response) {
    const result = await this.faqService.findOne(id);
    return response.status(HttpStatus.OK).json({
      data: result,
    });
  }

  @Put('update/:id')
  async update(
    @Param('id') id: string,
    @Res() response: Response,
    @Body() updateFaqDto: UpdateFaqDto,
  ) {
    const result = await this.faqService.update(id, updateFaqDto);
    return response.status(HttpStatus.OK).json({
      message: result.message,
      data: result.data,
    });
  }

  @Delete('delete/:id')
  async remove(@Param('id') id: string, @Res() response: Response) {
    const result = await this.faqService.remove(id);
    return response.status(HttpStatus.OK).json(result);
  }
}

@Controller('privacy-policies')
export class PrivacyPolicyController {
  constructor(private readonly privacyPolicyService: PrivacyPolicyService) {}

  @Post('create')
  async create(
    @Body() createPrivacyPolicyDto: CreatePrivacyPolicyDto,
  ): Promise<{ message: string; data: PrivacyPolicy }> {
    return this.privacyPolicyService.create(createPrivacyPolicyDto);
  }

  @Get()
  async findAll(): Promise<PrivacyPolicy[]> {
    return this.privacyPolicyService.findAll();
  }

  @Get('get/:id')
  async findOne(@Param('id') id: string): Promise<PrivacyPolicy> {
    return this.privacyPolicyService.findOne(id);
  }

  @Put('update/:id')
  async update(
    @Param('id') id: string,
    @Body() updatePrivacyPolicyDto: CreatePrivacyPolicyDto,
  ): Promise<{ message: string; data: PrivacyPolicy }> {
    return this.privacyPolicyService.update(id, updatePrivacyPolicyDto);
  }

  @Delete('delete/:id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.privacyPolicyService.remove(id);
  }
}
//terms-conditions

@Controller('terms-conditions')
export class TermsConditionsController {
  constructor(
    private readonly termsConditionsService: TermsConditionsService,
  ) {}

  @Get()
  async getOrShow(): Promise<TermsConditions | { message: string }> {
    const termsConditions = await this.termsConditionsService.getOrShow();
    if (!termsConditions) {
      return { message: 'No terms and conditions found' };
    }
    return termsConditions;
  }

  @Post()
  async createOrUpdate(
    @Body() createTermsConditionsDto: CreateTermsConditionsDto,
  ): Promise<{ message: string; data: TermsConditions }> {
    return this.termsConditionsService.createOrUpdate(createTermsConditionsDto);
  }
}
// contact as Controller
@Controller('contact')
export class ContactUsController {
  constructor(private readonly contactService: ContactUsService) {}

  @Get()
  async getOrShow(): Promise<ContactUs | { message: string }> {
    const contact = await this.contactService.getOrShow();
    if (!contact) {
      return { message: 'No contact found' };
    }
    return contact;
  }

  @Post()
  async createOrUpdate(
    @Body() createContactDto: CreateContactDto,
  ): Promise<{ message: string; data: ContactUs }> {
    return this.contactService.createOrUpdate(createContactDto);
  }
}

@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post('/create')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'bannerImages', maxCount: 10 }]),
  ) // Allow up to 10 images
  async createBanner(
    @UploadedFiles() files: { bannerImages?: Express.Multer.File[] },
    @Body() createBannerDto: CreateBannerDto,
  ) {
    return this.bannerService.createBannerWithImages(
      files.bannerImages || [],
      createBannerDto,
    );
  }

  @Put('/update/:id')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'bannerImages', maxCount: 10 }]),
  )
  async updateBanner(
    @Param('id') id: string,
    @UploadedFiles() files: { bannerImages?: Express.Multer.File[] },
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return this.bannerService.updateBannerImages(
      id,
      files.bannerImages || [],
      updateBannerDto,
    );
  }

  // Retrieve all banners
  @Get('/all')
  async getAllBanners() {
    return this.bannerService.getAllBanners();
  }

  // Delete multiple banner data
  @Delete('/delete/multiple')
  async deleteMultipleBannerData(@Body('ids') ids: string[]) {
    return this.bannerService.deleteMultipleBannerData(ids);
  }

  // Retrieve a specific banner by ID
  @Get('/:id')
  async getBannerById(@Param('id') id: string) {
    return this.bannerService.getBannerById(id);
  }

  // Delete a specific banner by ID
  @Delete('/delete/:id')
  async deleteBanner(@Param('id') id: string) {
    return this.bannerService.deleteBanner(id);
  }

  // Delete specific images in a banner
  @Delete('/images/:bannerId')
  async deleteBannerImages(
    @Param('bannerId') bannerId: string,
    @Body('bannerImages') bannerImages?: string[],
  ) {
    return this.bannerService.deleteBannerImages(bannerId, bannerImages);
  }

  // Delete all images in a banner
  @Delete('/images-all/:bannerId')
  async deleteAllBannerImages(
    @Param('bannerId') bannerId: string,
    @Res() response: Response,
  ) {
    try {
      const result = await this.bannerService.deleteAllBannerImages(bannerId);
      return response.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .json({ message: error.message });
      }
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'An error occurred while deleting banner images.' });
    }
  }
}

// Controller: api_control_settings.controller.ts
@Controller('sync-control-settings')
export class SyncControlSettingsController {
  constructor(private readonly service: SyncControlSettingsService) {}

  @Post()
  async createOrUpdate(@Body() dto: UpdateSyncControlSettingsDto) {
    return this.service.createOrUpdate(dto);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateSyncControlSettingsDto,
  ) {
    return this.service.createOrUpdate(dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: number) {
    await this.service.delete(id);
    return { message: 'Sync setting deleted successfully' };
  }
}

@Controller('tally-settings')
export class TallySettingsController {
  constructor(private readonly service: TallySettingsService) {}

  @Post()
  async createOrUpdate(@Body() dto: UpdateTallySettingsDto) {
    return this.service.createOrUpdate(dto);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTallySettingsDto) {
    return this.service.createOrUpdate(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const setting = await this.service.findById(id);
    if (!setting) {
      throw new NotFoundException('Tally setting not found');
    }
    return setting;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { message: 'Tally setting deleted successfully' };
  }
}

@Controller('logo')
export class LogoController {
  constructor(private readonly logoService: LogoService) {}

  @Post('/upload') // Single API for both create and update
  @UseInterceptors(FileInterceptor('logoFile')) // Handle single file upload
  async createOrUpdateLogo(
    @UploadedFile() file: Express.Multer.File,
    @Body() createOrUpdateLogoDto: CreateOrUpdateLogoDto,
  ) {
    return this.logoService.createOrUpdateLogo(file, createOrUpdateLogoDto);
  }

  @Get() // Endpoint to get the current logo
  async getLogo() {
    return this.logoService.getLogo();
  }
}

@Controller('tally-path')
export class TallyPathController {
  constructor(private readonly tallyPathService: TallyPathService) {}

  // Create or update a setting
  @Post()
  async createOrUpdateSetting(
    @Body() createSettingDto: CreateSettingDto,
  ): Promise<TallyPathEntity> {
    return this.tallyPathService.createOrUpdateSetting(createSettingDto);
  }

  @Get() // Endpoint to get the current logo
  async getTally() {
    return this.tallyPathService.getTallyPath();
  }
}

// Gallery
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post('/create')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'galleryImages', maxCount: 10 }]),
  ) // Allow up to 10 images
  async createGallery(
    @UploadedFiles() files: { galleryImages?: Express.Multer.File[] },
    @Body() createGalleryDto: CreateGalleryDto,
  ) {
    return this.galleryService.createGalleryWithImages(
      files.galleryImages || [],
      createGalleryDto,
    );
  }

  @Put('/update/:id')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'galleryImages', maxCount: 10 }]),
  )
  async updateGallery(
    @Param('id') id: string,
    @UploadedFiles() files: { galleryImages?: Express.Multer.File[] },
    @Body() updateGalleryDto: UpdateGalleryDto,
  ) {
    return this.galleryService.updateGalleryImages(
      id,
      files.galleryImages || [],
      updateGalleryDto,
    );
  }

  // Retrieve all banners
  @Get('/all')
  async getAllGallery() {
    return this.galleryService.getAllGallery();
  }

  // Delete multiple gallery data
  @Delete('/delete/multiple')
  async deleteMultipleGalleryData(@Body('ids') ids: string[]) {
    return this.galleryService.deleteMultipleGalleryData(ids);
  }

  // Retrieve a specific banner by ID
  @Get('/:id')
  async getGalleryById(@Param('id') id: string) {
    return this.galleryService.getGalleryById(id);
  }

  // Delete a specific banner by ID
  @Delete('/delete/:id')
  async deleteGallery(@Param('id') id: string) {
    return this.galleryService.deleteGallery(id);
  }

  // Delete specific images in a gallery
  @Delete('/images/:galleryId')
  async deleteGalleryImages(
    @Param('galleryId') galleryId: string,
    @Body('galleryImages') galleryImages: string[],
  ) {
    return this.galleryService.deleteGalleryImages(galleryId, galleryImages);
  }

  // Delete all images in a gallery
  @Delete('/images-all/:galleryId')
  async deleteAllGalleryImages(@Param('galleryId') galleryId: string) {
    return this.galleryService.deleteAllGalleryImages(galleryId);
  }
}
