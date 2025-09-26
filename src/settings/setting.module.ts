// src/faq/faq.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqController, PrivacyPolicyController, TermsConditionsController, ContactUsController, BannerController, SyncControlSettingsController, TallySettingsController, LogoController, TallyPathController, GalleryController } from './setting.controller';
import { FaqService, PrivacyPolicyService, TermsConditionsService, ContactUsService, BannerService, SyncControlSettingsService, TallySettingsService, LogoService, TallyPathService, GalleryService } from './setting.service';
import { Faq, PrivacyPolicy, TermsConditions, ContactUs, Banner, SyncControlSettings, TallySettings, Logo, TallyPathEntity, Gallery } from './setting.entity';
import { CloudinaryService } from '../service/cloudinary.service';
@Module({
    imports: [TypeOrmModule.forFeature([Gallery,TallyPathEntity,Logo,Faq, PrivacyPolicy, TermsConditions, ContactUs,Banner,SyncControlSettings,TallySettings])
],
    controllers: [GalleryController,TallyPathController,LogoController,FaqController, PrivacyPolicyController, TermsConditionsController, ContactUsController,BannerController,SyncControlSettingsController,TallySettingsController],
    providers: [GalleryService,TallyPathService,LogoService,FaqService, PrivacyPolicyService, TermsConditionsService, ContactUsService,BannerService,CloudinaryService,SyncControlSettingsService,TallySettingsService],
})
export class SettingModule { }
