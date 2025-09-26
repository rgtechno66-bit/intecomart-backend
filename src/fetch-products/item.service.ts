// product.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { parseStringPromise } from 'xml2js'; // Library for parsing XML to JSON
import { ItemEntity } from './item.entity';
import { ItemDto } from './item.dto';
import { CloudinaryService } from '../service/cloudinary.service';
import { products } from '../tally/products';
import { Cron } from '@nestjs/schedule';
import { SyncLogEntity, SyncLogStatus } from './../sync-log/sync-log.entity';
import { SyncControlSettings } from './../settings/setting.entity';

@Injectable()
export class ItemService {
  constructor(
    @InjectRepository(ItemEntity)
    private itemRepository: Repository<ItemEntity>,
    private cloudinaryService: CloudinaryService,

    @InjectRepository(SyncLogEntity)
    private readonly syncLogRepository: Repository<SyncLogEntity>,

    @InjectRepository(SyncControlSettings)
    private readonly syncControlSettingsRepository: Repository<SyncControlSettings>,
  ) {}

  // For telly --------------------------------------------------------------------------------------------

  async create(createItemDto: ItemDto): Promise<ItemEntity> {
    try {
      const newItem = this.itemRepository.create(createItemDto);
      return await this.itemRepository.save(newItem);
    } catch (error) {
      throw new InternalServerErrorException('Failed to create item');
    }
  }

  async update(id: string, updateItemDto: ItemDto): Promise<ItemEntity> {
    try {
      const item = await this.itemRepository.findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException(`Item with ID ${id} not found`);
      }

      // Update the item with new values
      Object.assign(item, updateItemDto);
      return await this.itemRepository.save(item);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update item');
    }
  }

  //-------------------------------------------------------------------------------------------------------------------

  async fetchAndStoreItems(): Promise<void> {
    const REQUEST_TIMEOUT = 120000; // 2 minutes timeout
    const BATCH_SIZE = 500;

    const productSyncSetting = await this.syncControlSettingsRepository.findOne(
      {
        where: { moduleName: 'Products' },
      },
    );

    if (!productSyncSetting || !productSyncSetting.isManualSyncEnabled) {
      throw new BadRequestException('Manual Sync for Products is disabled.');
    }

    try {
      // First get all existing items from database
      const existingItems = await this.itemRepository.find();
      // Create Map of existing items for quick lookup
      const existingItemMap = new Map(
        existingItems.map((item) => [item.itemName, item]),
      );
      // Fetch data from Tally
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: {
          'Content-Type': 'text/xml',
        },
        data: products,
        timeout: REQUEST_TIMEOUT,
      });

      // Parse XML response into items
      const items = await this.parseXmlToItems(response.data);
      // Find only new items to insert (items in Tally but not in database)
      const itemsToInsert: ItemEntity[] = [];
      for (const item of items) {
        if (!existingItemMap.has(item.itemName)) {
          itemsToInsert.push(item);
        }
      }

      // Check if there are any new items to insert
      if (itemsToInsert.length === 0) {
        throw new BadRequestException('Data already up to date - No new items to sync');
      }

      // Insert new items in batches
      if (itemsToInsert.length > 0) {
        for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
          const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
          await this.itemRepository.save(batch);
          console.log(
            `Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(itemsToInsert.length / BATCH_SIZE)} (${batch.length} items)`,
          );
        }
      }
    } catch (error: any) {

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Make Sure Tally is Open and logged In',
      );
    }
  }

  async parseXmlToItems(xml: string): Promise<ItemEntity[]> {
    const parsedResult = await parseStringPromise(xml);
    const stockItems = parsedResult.ENVELOPE.STOCKITEM || [];

    return stockItems.map((item: any) => {
      const itemDto = new ItemDto();

      itemDto.itemName = this.cleanString(item.ITEMNAME?.[0]);
      itemDto.alias = this.cleanString(item.ALIAS?.[0]);
      itemDto.partNo = this.cleanString(item.PARTNO?.[0]);
      itemDto.description = this.cleanString(item.DESCRIPTION?.[0]);
      itemDto.group = this.cleanString(item.GROUP?.[0]);
      itemDto.subGroup1 = this.cleanString(item.SUBGROUP1?.[0]);
      itemDto.subGroup2 = this.cleanString(item.SUBGROUP2?.[0]);
      itemDto.stdPkg = parseInt(item.STDPKG?.[0]) || 0;
      itemDto.stdWeight = parseInt(item.STDWEIGHT?.[0]) || 0;
      itemDto.baseUnit = this.cleanString(item.BASEUNIT?.[0]);
      itemDto.alternateUnit = this.cleanString(item.ALTERNATEUNIT?.[0]);
      itemDto.conversion = this.cleanString(item.CONVERSION?.[0]);
      itemDto.denominator = parseInt(item.DENOMINATOR?.[0], 10) || 1;
      itemDto.sellingPriceDate = this.cleanString(item.SELLINGPRICEDATE?.[0]);
      itemDto.sellingPrice = parseFloat(item.SELLINGPRICE?.[0]) || 0;
      itemDto.gstApplicable = this.cleanString(item.GSTAPPLICABLE?.[0]);
      itemDto.gstApplicableDate = this.cleanString(item.GSTAPPLICABLEDATE?.[0]);
      itemDto.taxability = this.cleanString(item.TAXABILITY?.[0]);
      itemDto.gstRate = parseFloat(item.GSTRATE?.[0]) || 0;

      // Convert DTO to Entity
      return this.itemRepository.create(itemDto);
    });
  }

  private cleanString(value: string | undefined): string {
    return value?.replace(/\x04/g, '').trim() || '';
  }

  // Function to check if the existing product has changes
  private hasChanges(
    existingProduct: ItemEntity,
    newItem: ItemEntity,
  ): boolean {
    return (
      existingProduct.itemName !== newItem.itemName ||
      existingProduct.partNo !== newItem.partNo ||
      existingProduct.description !== newItem.description ||
      existingProduct.group !== newItem.group ||
      existingProduct.subGroup1 !== newItem.subGroup1 ||
      existingProduct.subGroup2 !== newItem.subGroup2 ||
      existingProduct.stdPkg !== newItem.stdPkg ||
      existingProduct.stdWeight !== newItem.stdWeight ||
      existingProduct.baseUnit !== newItem.baseUnit ||
      existingProduct.alternateUnit !== newItem.alternateUnit ||
      existingProduct.conversion !== newItem.conversion ||
      existingProduct.denominator !== newItem.denominator ||
      existingProduct.sellingPriceDate !== newItem.sellingPriceDate || // For dates, compare using getTime()
      existingProduct.sellingPrice !== newItem.sellingPrice ||
      existingProduct.gstApplicable !== newItem.gstApplicable ||
      existingProduct.gstApplicableDate !== newItem.gstApplicableDate ||
      existingProduct.taxability !== newItem.taxability ||
      existingProduct.gstRate !== newItem.gstRate
    );
  }

  async findAll(): Promise<ItemEntity[]> {
    return this.itemRepository.find(); // Load files for all items
  }

  async findAllPopularity(): Promise<ItemEntity[]> {
    return this.itemRepository.find({
      order: {
        popularity: 'DESC', // Order by popularity descending
      },
      take: 100, // Limit to top 100 products
    });
  }

  async findById(id: string): Promise<ItemEntity | null> {
    return this.itemRepository.findOne({ where: { id } }); // Load files for the item by ID
  }

  async delete(id: string): Promise<{ message: string }> {
    const items = await this.findById(id);
    // Check if the item exists
    if (!items) {
      throw new NotFoundException(`Item with id ${id} not found`); // or handle it differently
    }
    await this.itemRepository.remove(items);
    return { message: 'Product deleted successfully' };
  }

  async uploadFilesToCloudinary(
    itemId: string,
    productImages: Express.Multer.File[],
    dimensionalFiles: Express.Multer.File[],
    applyToAllProductImages: boolean,
    applyToAllDimensionalFiles: boolean,
  ): Promise<ItemEntity[]> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const newImageUrls: string[] = [];
    const newDimensionalUrls: string[] = [];
    const updatedItems: ItemEntity[] = [];

    // Upload product images
    if (productImages && productImages.length > 0) {
      for (const file of productImages) {
        const fileName = `${Date.now()}-${file.originalname}`;
        const imageUrl = await this.cloudinaryService.uploadImage(file.buffer, 'images', fileName);
        newImageUrls.push(imageUrl);
      }
    }

    // Upload dimensional files
    if (dimensionalFiles && dimensionalFiles.length > 0) {
      for (const file of dimensionalFiles) {
        const fileName = `${Date.now()}-${file.originalname}`;
        const fileUrl = await this.cloudinaryService.uploadFile(file.buffer, 'documents', fileName);
        newDimensionalUrls.push(fileUrl);
      }
    }

    // Define items to update
    let itemsToUpdate: ItemEntity[];

    if (applyToAllProductImages || applyToAllDimensionalFiles) {
      // Fetch all items with the same subGroup1 if any applyToAll flag is true
      itemsToUpdate = await this.itemRepository.find({
        where: { subGroup2: item.subGroup2 },
      });

      for (const currentItem of itemsToUpdate) {
        // Apply new images to all items in the subgroup if applyToAllProductImages is true
        if (applyToAllProductImages) {
          currentItem.productImages = [
            ...(item.productImages || []),
            ...newImageUrls,
          ]; // Replace with combined images from specified item
        }

        // Apply new dimensional files to all items in the subgroup if applyToAllDimensionalFiles is true
        if (applyToAllDimensionalFiles) {
          currentItem.dimensionalFiles = [
            ...(item.dimensionalFiles || []),
            ...newDimensionalUrls,
          ]; // Replace with combined dimensional files from specified item
        }

        // Save each updated item
        const savedItem = await this.itemRepository.save(currentItem);
        updatedItems.push(savedItem);
      }
    } else {
      // Only update the specified item if no applyToAll flag is true
      if (newImageUrls.length > 0) {
        item.productImages = [...(item.productImages || []), ...newImageUrls];
      }

      if (newDimensionalUrls.length > 0) {
        item.dimensionalFiles = [
          ...(item.dimensionalFiles || []),
          ...newDimensionalUrls,
        ];
      }

      // Save the specified item
      const savedItem = await this.itemRepository.save(item);
      updatedItems.push(savedItem);
    }

    return updatedItems; // Return the list of updated items
  }

  // Method to delete specific images from Cloudinary
  async deleteImages(
    itemId: string,
    imagesToDelete: { productImages?: string[]; dimensionalFiles?: string[] },
  ): Promise<ItemEntity> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Delete specified product images from Cloudinary if URLs are provided
    const productImages = imagesToDelete.productImages;
    if (productImages?.length) {
      await this.cloudinaryService.deleteFiles(productImages);
      // Remove deleted product image URLs from the item
      item.productImages = item.productImages.filter(
        (url) => !productImages.includes(url),
      );
    }

    // Delete specified dimensional files from Cloudinary if URLs are provided
    const dimensionalFiles = imagesToDelete.dimensionalFiles;
    if (dimensionalFiles?.length) {
      await this.cloudinaryService.deleteFiles(dimensionalFiles);
      // Remove deleted dimensional file URLs from the item
      item.dimensionalFiles = item.dimensionalFiles.filter(
        (url) => !dimensionalFiles.includes(url),
      );
    }

    return await this.itemRepository.save(item); // Save the updated item entity
  }

  async deleteMultiple(ids: string[]): Promise<{ message: string }> {
    const notFoundIds: string[] = [];

    for (const id of ids) {
      const item = await this.findById(id);
      if (!item) {
        notFoundIds.push(id);
        continue; // skip this ID if not found
      }
      await this.itemRepository.remove(item);
    }

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Items with ids ${notFoundIds.join(', ')} not found`,
      );
    }

    return { message: 'Products deleted successfully' };
  }

  //Cron Job Set

  // @Cron('0 * * * *') // hour
  async cronFetchAndStoreItems(): Promise<void> {
    console.log('Item executed at:', new Date().toISOString());
    const REQUEST_TIMEOUT = 120000; // 2 minutes timeout
    const BATCH_SIZE = 500;

    const productSyncSetting = await this.syncControlSettingsRepository.findOne(
      {
        where: { moduleName: 'Products' },
      },
    );

    if (!productSyncSetting || !productSyncSetting.isAutoSyncEnabled) {
      throw new BadRequestException('Auto Sync for Products is disabled.');
    }

    try {
        // First get all existing items from database
        const existingItems = await this.itemRepository.find();
        // Create Map of existing items for quick lookup
        const existingItemMap = new Map(
          existingItems.map((item) => [item.itemName, item]),
        );
        // Fetch data from Tally
        const response = await axios.get(process.env.TALLY_URL as string, {
          headers: {
            'Content-Type': 'text/xml',
          },
          data: products,
          timeout: REQUEST_TIMEOUT,
        });
  
        // Parse XML response into items
        const items = await this.parseXmlToItems(response.data);
        // Find only new items to insert (items in Tally but not in database)
        const itemsToInsert: ItemEntity[] = [];
        for (const item of items) {
          if (!existingItemMap.has(item.itemName)) {
            itemsToInsert.push(item);
          }
        }
  
        // Insert new items in batches
        if (itemsToInsert.length > 0) {
          for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
            const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
            await this.itemRepository.save(batch);
            console.log(
              `Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(itemsToInsert.length / BATCH_SIZE)} (${batch.length} items)`,
            );
          }
        }

      await this.syncLogRepository.save({
        sync_type: 'Products',
        status: SyncLogStatus.SUCCESS,
      });
    } catch (error: any) {
      await this.syncLogRepository.save({
        sync_type: 'Products',
        status: SyncLogStatus.FAIL, // Enum value
      });

      throw new InternalServerErrorException('Open Tally to fetch items');
    }
  }

  @Cron('0 0 * * 0') // Runs weekly at midnight on Sunday to delete logs older than two minutes.
  async cleanupAllLogs(): Promise<void> {
    console.log('Complete log cleanup started:', new Date().toISOString());

    try {
      // Delete all logs without any condition
      const result = await this.syncLogRepository.delete({});

      console.log(
        `Complete log cleanup completed. Deleted ${result.affected} logs.`,
      );
    } catch (error) {
      console.error('Complete log cleanup failed:', error);
    }
  }
}
