import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './order.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { JwtModule } from '@nestjs/jwt';
import { ItemEntity } from './../fetch-products/item.entity';
import { OrderItemEntity } from './order.item.entity';
import { CartItemEntity } from './../cart/cart.entity';
// import { InvoiceRetryService } from './../invoice/invoice-retry.service';
import { Invoice } from './../invoice/invoice.entity';
import { UserEntity } from './../user/users.entity';
import { AddressEntity } from './../addresses/addresses.entity';
import { EmailService } from './../service/email.service';
import { SyncControlSettings, TallySettings } from './../settings/setting.entity';
import { SyncLogEntity } from './../sync-log/sync-log.entity';
import { CloudinaryService } from '../service/cloudinary.service';
import { UserService } from './../user/users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity,ItemEntity,UserEntity,AddressEntity,OrderItemEntity,CartItemEntity,Invoice, SyncLogEntity,SyncControlSettings,TallySettings]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,  // Use JWT secret from .env file
      signOptions: {},  // Set token expiration
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService,EmailService,CloudinaryService,UserService],
  exports: [OrderService], // Exporting ItemService
})
export class OrderModule {}
