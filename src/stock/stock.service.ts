// stock.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { StockEntity } from './stock.entity';
import { StockDto } from './stock.dto';
import { summary } from '../tally/summary';
import { Cron } from '@nestjs/schedule';

import { SyncControlSettings } from './../settings/setting.entity';
import { SyncLogEntity, SyncLogStatus } from './../sync-log/sync-log.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockEntity)
    private stockRepository: Repository<StockEntity>,

    @InjectRepository(SyncLogEntity)
    private readonly syncLogRepository: Repository<SyncLogEntity>,

    @InjectRepository(SyncControlSettings)
    private readonly syncControlSettingsRepository: Repository<SyncControlSettings>,
  ) {}

  async findAll(): Promise<StockEntity[]> {
    return this.stockRepository.find(); // Load files for all items
  }

  async deleteSelected(ids: string[]): Promise<void> {
    try {
      // Delete stocks by the given IDs
      const deleteResult = await this.stockRepository.delete(ids);

      if (deleteResult.affected === 0) {
        throw new InternalServerErrorException('No stocks found to delete');
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to delete selected stocks',
      );
    }
  }

  async findById(id: string): Promise<StockEntity | null> {
    return this.stockRepository.findOne({ where: { id } }); // Load files for the vendor by ID
  }

  async deleteMultiple(ids: string[]): Promise<{ message: string }> {
    const notFoundIds: string[] = [];

    for (const id of ids) {
      const item = await this.findById(id);
      if (!item) {
        notFoundIds.push(id);
        continue; // skip this ID if not found
      }
      await this.stockRepository.remove(item);
    }

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `stocks with ids ${notFoundIds.join(', ')} not found`,
      );
    }

    return { message: 'Stocks deleted successfully' };
  }

  async fetchAndStoreStockSummary(): Promise<void> {
    const REQUEST_TIMEOUT = 60000; // 60 seconds timeout

    // Check if "ManualSync " is enabled
    const SyncSetting = await this.syncControlSettingsRepository.findOne({
      where: { moduleName: 'Stocks' },
    });

    if (!SyncSetting || !SyncSetting.isManualSyncEnabled) {
      throw new BadRequestException('Manual Sync for Stocks is disabled.');
    }

    try {
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: {
          'Content-Type': 'text/xml',
        },
        data: summary,
        timeout: REQUEST_TIMEOUT,
      });

      if (response.data.includes('<LINEERROR>')) {
        throw new BadRequestException('Please Login The Tally');
      }

      const stockSummaries = await this.parseXmlToStockSummaries(response.data);
      const existingStocks = await this.stockRepository.find();
      const existingStockMap = new Map(
        existingStocks.map((stock) => [stock.itemName, stock]),
      );

      // batch size 500
      const batchSize = 500;
      const batches = [];

      for (let i = 0; i < stockSummaries.length; i += batchSize) {
        batches.push(stockSummaries.slice(i, i + batchSize));
      }

      // parallel processing
      await Promise.all(
        batches.map(async (batch) => {
          const updates = [];
          const inserts = [];

          for (const stock of batch) {
            const existingStock = existingStockMap.get(stock.itemName);
            if (existingStock && existingStock.quantity !== stock.quantity) {
              updates.push({ ...existingStock, ...stock });
            } else if (!existingStock) {
              inserts.push(stock);
            }
          }

          // बल्क अपडेट और इन्सर्ट
          if (updates.length > 0) {
            await this.stockRepository.save(updates);
          }
          if (inserts.length > 0) {
            await this.stockRepository.save(inserts);
          }
        }),
      );
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Tally request timed out. Please ensure Tally is open and accessible.',
        );
      }
      throw new InternalServerErrorException(
        'Make Sure Tally is Open and logged In',
      );
    }
  }

  async parseXmlToStockSummaries(xml: string): Promise<StockEntity[]> {
    // Wrap the XML with a root element
    const wrappedXml = `<STOCKSUMMARIES>${xml}</STOCKSUMMARIES>`;

    const parsedResult = await parseStringPromise(wrappedXml);

    // Access STOCKSUMMARIES.STOCKSUMMARY as an array
    const stockSummaryItems = parsedResult.STOCKSUMMARIES?.STOCKSUMMARY || [];

    return stockSummaryItems.map((item: any) => {
      const stockDto = new StockDto();

      stockDto.itemName = this.cleanString(item.ITEMNAME?.[0] || '');
      stockDto.group = this.cleanString(item.GROUP?.[0] || '');
      stockDto.subGroup1 = this.cleanString(item.SUBGROUP1?.[0] || '');
      stockDto.subGroup2 = this.cleanString(item.SUBGROUP2?.[0] || '');

      stockDto.quantity = parseFloat(item.CLOSINGSTOCK?.[0] || '0').toString();

      return this.stockRepository.create(stockDto);
    });
  }

  private hasStockSummaryChanges(
    existingStock: StockEntity,
    newStock: StockEntity,
  ): boolean {
    return (
      existingStock.itemName !== newStock.itemName ||
      existingStock.quantity !== newStock.quantity ||
      existingStock.group !== newStock.group ||
      existingStock.subGroup1 !== newStock.subGroup1 ||
      existingStock.quantity !== newStock.quantity
    );
  }

  private cleanString(value: string | undefined): string {
    return value?.replace(/\x04/g, '').trim() || '';
  }

  @Cron('0 * * * *') // hour
  async cronFetchAndStoreItems(): Promise<void> {
    console.log('Stocks sync executed at:', new Date().toISOString());
    const REQUEST_TIMEOUT = 60000; // 60 seconds timeout

    // Check if "Auto Sync" is enabled
    const syncSetting = await this.syncControlSettingsRepository.findOne({
      where: { moduleName: 'Stocks' },
    });

    if (!syncSetting?.isAutoSyncEnabled) {
      throw new BadRequestException('Auto Sync for Stocks is disabled.');
    }

    try {
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: { 'Content-Type': 'text/xml' },
        data: summary, // Replace with your dynamic XML request
        timeout: REQUEST_TIMEOUT,
      });

      // Check for specific XML error patterns in the response
      if (response.data.includes('<LINEERROR>')) {
        throw new BadRequestException('Please log in to Tally.');
      }

      const stockSummaries = await this.parseXmlToStockSummaries(response.data);
      const existingStocks = await this.stockRepository.find();
      const existingStockMap = new Map(
        existingStocks.map((stock) => [stock.itemName, stock]),
      );

      // batch size 500
      const batchSize = 500;
      const batches = [];

      for (let i = 0; i < stockSummaries.length; i += batchSize) {
        batches.push(stockSummaries.slice(i, i + batchSize));
      }

      // parallel processing
      await Promise.all(
        batches.map(async (batch) => {
          const updates = [];
          const inserts = [];

          for (const stock of batch) {
            const existingStock = existingStockMap.get(stock.itemName);
            if (existingStock && existingStock.quantity !== stock.quantity) {
              updates.push({ ...existingStock, ...stock });
            } else if (!existingStock) {
              inserts.push(stock);
            }
          }

          // बल्क अपडेट और इन्सर्ट
          if (updates.length > 0) {
            await this.stockRepository.save(updates);
          }
          if (inserts.length > 0) {
            await this.stockRepository.save(inserts);
          }
        }),
      );
    } catch (error: any) {
      await this.syncLogRepository.save({
        sync_type: 'Stocks',
        status: SyncLogStatus.FAIL,
      });

      if (error instanceof BadRequestException) throw error;
      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Tally request timed out. Ensure Tally is open and accessible.',
        );
      }
      throw new InternalServerErrorException(
        'Make sure Tally is open and logged in.',
      );
    }
  }
}
