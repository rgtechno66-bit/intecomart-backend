// checkout.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutEntity } from './checkout.entity';
import { UserEntity } from '../user/users.entity';

import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { CloudinaryService } from '../service/cloudinary.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      CheckoutEntity,
      UserEntity
    ]),

  ],
  controllers: [CheckoutController],
  providers: [CheckoutService, CloudinaryService],
  exports: [CheckoutService],
})
export class CheckoutModule {} 