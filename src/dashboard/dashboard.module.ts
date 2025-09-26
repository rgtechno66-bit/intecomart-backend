// dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
// import { ItemModule } from './../fetch-products/item.module';
// import { UserModule } from './../user/users.module';
// import { OrderModule } from './../order/order.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ItemService } from './../fetch-products/item.service';
import { UserService } from './../user/users.service';
import { OrderService } from './../order/order.service';
import { ItemEntity } from './../fetch-products/item.entity';
import { UserEntity } from './../user/users.entity';
import { OrderEntity } from './../order/order.entity';
import { SyncLogEntity } from './../sync-log/sync-log.entity';
import { SyncLogService } from './../sync-log/sync-log.service';
import { Banner, ContactUs, Faq, PrivacyPolicy, SyncControlSettings, TallySettings, TermsConditions } from './../settings/setting.entity';
import { AddressEntity } from './../addresses/addresses.entity';
import { OrderItemEntity } from './../order/order.item.entity';
import { CartItemEntity } from './../cart/cart.entity';
import { Invoice } from './../invoice/invoice.entity';
import { CloudinaryService } from '../service/cloudinary.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemEntity, UserEntity, OrderEntity, SyncLogEntity, Faq, PrivacyPolicy,TallySettings, TermsConditions, ContactUs, Banner, SyncControlSettings, AddressEntity, OrderItemEntity, CartItemEntity, Invoice]),
  JwtModule.register({
    secret: process.env.JWT_SECRET,  // Use JWT secret from .env file
    signOptions: {},  // Set token expiration
  }),
  ],
  providers: [DashboardService, ItemService, UserService, OrderService, CloudinaryService, SyncLogService],
  controllers: [DashboardController],
})
export class DashboardModule {}
