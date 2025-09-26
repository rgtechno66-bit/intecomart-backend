// stock.controller.ts
import { Body, Controller, Delete, Get, HttpStatus, NotFoundException, Post, Res, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { Response } from 'express'; // Import Response from express

import { JwtAuthGuard } from './../jwt/jwt-auth.guard';
import { SessionGuard } from './../jwt/session.guard';

@Controller('stocks')
@UseGuards(SessionGuard,JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('/fetch-summary')
  async fetchStockSummary() {
    await this.stockService.fetchAndStoreStockSummary();
    return { message: 'Stock summary fetched and stored successfully' };
  }

  @Get() // Get all items
  async findAll(@Res() response: Response) {
    const stock = await this.stockService.findAll();
    return response.status(HttpStatus.OK).json({
      length: stock.length,
      data: stock,
    });
  }

  @Delete('/delete-selected') // Delete selected stocks by IDs
  async deleteSelected(@Body() ids: string[], @Res() response: Response) {
    try {
      await this.stockService.deleteSelected(ids); // Call deleteSelected service method
      return response.status(HttpStatus.OK).json({
        message: `${ids.length} stocks have been deleted successfully`,
      });
    } catch (error:any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to delete selected stocks',
        error: error.message,
      });
    }
  }

  @Delete('/delete/stocks/all') // Delete selected stocks by IDs
  async deleteMultiple(@Body('ids') ids: string[], @Res() response: Response) {
      try {
          const result = await this.stockService.deleteMultiple(ids);
          return response.status(HttpStatus.OK).json(result);
      } catch (error) {
          // Handle the error appropriately
          if (error instanceof NotFoundException) {
              return response.status(HttpStatus.NOT_FOUND).json({ message: error.message });
          }
          return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'An error occurred while deleting the data.' });
      }
  }

}
  

