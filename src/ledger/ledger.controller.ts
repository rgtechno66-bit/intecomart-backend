import { Body, Controller, Delete, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from './../jwt/jwt-auth.guard';
import { RolesGuard } from './../jwt/roles.guard';
import { isAdmin, isVendor } from './../utils/auth.utils';
import { SessionGuard } from './../jwt/session.guard';

@Controller('ledgers')
@UseGuards(SessionGuard,JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) { }

  @Post('/receivable/fetch')
  async fetchLedgers(@Res() res: Response): Promise<void> {
    try {
      await this.ledgerService.fetchAndStoreLedgers();
      res.status(HttpStatus.OK).json({ message: 'receivable statements fetched and stored successfully.' });
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }


  @Get('/receivable')
  async findAll(@Req() req: Request, @Res() res: Response): Promise<Response> {  // Explicitly return Response
    const user = req.user;
    const userRole = user?.role;
    const userName = user?.name;
    const vendorId = user?.id;
    try {
      if (isAdmin(userRole)) {
        const ledgers = await this.ledgerService.findAll();
        return res.status(HttpStatus.OK).json({ data: ledgers });
      }
      if (isVendor(userRole) && userName) {
        const ledgers = await this.ledgerService.findAllDataByUserName(userName);
        return res.status(HttpStatus.OK).json({ data: ledgers });
      }

      return res.status(HttpStatus.FORBIDDEN).json({ message: 'Unauthorized access' });
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Get('/receivable/:id')
  async findById(@Param('id') id: string, @Res() response: Response) {
    const ledger = await this.ledgerService.findById(id);
    if (!ledger) {
      throw new NotFoundException('Ledger not found');
    }
    return response.status(200).json({ data: ledger });
  }

  @Delete('/receivable/:id')
  async deleteById(@Param('id') id: string, @Res() response: Response) {
    const deleted = await this.ledgerService.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('Ledger not found');
    }
    return response.status(200).json({ message: 'Ledger deleted successfully.' });
  }

  @Delete('delete/all')
  async deleteMultiple(@Body('ids') ids: string[], @Res() response: Response) {
    try {
      const result = await this.ledgerService.deleteMultiple(ids);
      return response.status(HttpStatus.OK).json(result);
    } catch (error) {
      // Handle the error appropriately
      if (error instanceof NotFoundException) {
        return response.status(HttpStatus.NOT_FOUND).json({ message: error.message });
      }
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'An error occurred while deleting the data.' });
    }
  }


  // Fetch data from Tally and store in the database
  @Post('/fetch')
  async fetchAndStoreLedgers(@Res() res: Response): Promise<void> {
    try {
      await this.ledgerService.fetchAndLedgers();
      res.status(HttpStatus.OK).json({ message: 'Ledger statements fetched and stored successfully.' });
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  // Retrieve all ledger statements
  @Get('/get-all')
  async findLedgerAll(@Req() req: Request, @Res() res: Response): Promise<Response> {  // Explicitly return Response
    const user = req.user;
    const userRole = user?.role;
    const userName = user?.name;
    const vendorId = user?.id;
    try {
      if (isAdmin(userRole)) {
        const statements = await this.ledgerService.findLedgerData();
        return res.status(HttpStatus.OK).json({ data: statements });
      }

      if (isVendor(userRole) && userName) {
        const statements = await this.ledgerService.findLedgerDataByUserName(userName);
        return res.status(HttpStatus.OK).json({ data: statements });
      }

      return res.status(HttpStatus.FORBIDDEN).json({ message: 'Unauthorized access' });
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }


  // Retrieve a specific ledger statement by ID
  @Get('/get/:id')
  async findByIdLedger(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      const statement = await this.ledgerService.findByIdLedgerData(id);
      res.status(HttpStatus.OK).json({ data: statement });
    } catch (error: any) {
      if (error instanceof HttpException) {
        res.status(error.getStatus()).json({ message: error.message });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
      }
    }
  }

}
