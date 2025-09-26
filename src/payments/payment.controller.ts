import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    Put,
    Delete,
    ParseUUIDPipe,
    UseInterceptors,
    UploadedFiles,
    UseGuards,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { BankAccountService } from './payment.service';
import { BankAccountDto, BankAccountResponseDto } from './payment.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from './../jwt/jwt-auth.guard';
import { SessionGuard } from './../jwt/session.guard';

@Controller('bank-accounts')
@UseGuards(SessionGuard, JwtAuthGuard)
export class BankAccountController {
    constructor(private readonly bankAccountService: BankAccountService) { }

    @Post('create')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FilesInterceptor('qrCodeImageUrl', 10))
    async createBankAccount(
        @Body() dto: BankAccountDto,
        @UploadedFiles() files: Express.Multer.File[],
    ): Promise<BankAccountResponseDto> {
        return this.bankAccountService.createBankAccount(dto, files);
    }

    @Get('get')
    @HttpCode(HttpStatus.OK)
    async getAllBankAccounts(): Promise<BankAccountResponseDto[]> {
        return this.bankAccountService.getAllBankAccounts();
    }

    @Get('get/:id')
    @HttpCode(HttpStatus.OK)
    async getBankAccountDetails(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<BankAccountResponseDto> {
        return this.bankAccountService.getBankAccountDetails(id);
    }

    @Put('update/:id')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FilesInterceptor('qrCodeImageUrl', 10))
    async updateBankAccount(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: BankAccountDto,
        @UploadedFiles() files: Express.Multer.File[],
    ): Promise<BankAccountResponseDto> {
        return this.bankAccountService.updateBankAccount(id, dto, files);
    }

    @Delete('delete/:id')
    @HttpCode(HttpStatus.OK)
    async deleteBankAccount(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<{ message: string }> {
        return this.bankAccountService.deleteBankAccount(id);
    }

    @Delete('remove-qr-image/:id')
    @HttpCode(HttpStatus.OK)
    async removeQrImage(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
        return this.bankAccountService.removeQrImage(id);
    }
}
