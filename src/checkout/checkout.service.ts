// checkout.service.ts
import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckoutEntity } from './checkout.entity';
import {
  CreateCheckoutDto,
  UpdateCheckoutStatusDto,
  GetCheckoutDto,
} from './checkout.dto';
import { PdfEmailUtils } from '../utils/pdf-email.utils';
import { CloudinaryService } from '../service/cloudinary.service';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectRepository(CheckoutEntity)
    private readonly checkoutRepository: Repository<CheckoutEntity>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createCheckout(
    userId: string,
    createCheckoutDto: CreateCheckoutDto,
  ): Promise<CheckoutEntity> {
    // Create checkout record with only body data
    const checkout = this.checkoutRepository.create({
      userId,
      name: createCheckoutDto.address.name,
      email: createCheckoutDto.address.email,
      mobile: createCheckoutDto.address.mobile,
      address: createCheckoutDto.address.address,
      state: createCheckoutDto.address.state,
      country: createCheckoutDto.address.country,
      pincode: createCheckoutDto.address.pincode,
      subtotal: createCheckoutDto.subtotal || 0,
      discount: createCheckoutDto.discount || 0,
      total: createCheckoutDto.total || 0,
      status: 'pending',
      products: createCheckoutDto.products, // Store complete product information
    });

    const savedCheckout = await this.checkoutRepository.save(checkout);

    // Convert decimal strings to numbers for response
    savedCheckout.subtotal = parseFloat(savedCheckout.subtotal as any) || 0;
    savedCheckout.discount = parseFloat(savedCheckout.discount as any) || 0;
    savedCheckout.total = parseFloat(savedCheckout.total as any) || 0;

    // Send email with PDF and upload to Cloudinary
    const cloudinaryUrl = await PdfEmailUtils.sendEmailWithPDF(
      savedCheckout, 
      createCheckoutDto,
      this.cloudinaryService
    );

    // Update checkout with Cloudinary URL if upload was successful
    if (cloudinaryUrl) {
      await this.checkoutRepository.update(
        { id: savedCheckout.id },
        { emailPdf: cloudinaryUrl }
      );
      savedCheckout.emailPdf = cloudinaryUrl;
    }

    return savedCheckout;
  }

  async getCheckoutById(checkoutId: string): Promise<CheckoutEntity> {
    const checkout = await this.checkoutRepository.findOne({
      where: { id: checkoutId },
    });

    if (!checkout) {
      throw new NotFoundException('Checkout not found');
    }

    // Convert decimal strings to numbers
    checkout.subtotal = parseFloat(checkout.subtotal as any) || 0;
    checkout.discount = parseFloat(checkout.discount as any) || 0;
    checkout.total = parseFloat(checkout.total as any) || 0;

    return checkout;
  }
}
