import {
  Controller,
  HttpStatus,
  Post,
  Get,
  Res,
  Param,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Delete,
  Body,
  NotFoundException,
  UseGuards,
  Put,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express'; // Import Response from express
import { ItemService } from './item.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ItemEntity } from './item.entity';
import { ItemDto } from './item.dto';

@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  // Only for telly

  @Post('create')
  async create(@Body() createItemDto: ItemDto, @Res() response: Response) {
    try {
      const newItem = await this.itemService.create(createItemDto);
      return response.status(HttpStatus.CREATED).json({
        message: 'Item created successfully',
        data: newItem,
      });
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: error.message,
        });
      }
      return response.status(HttpStatus.BAD_REQUEST).json({
        message: 'Failed to create item',
      });
    }
  }

  @Put('update-prod/:id')
  async update(
    @Param('id') id: string,
    @Body() updateItemDto: ItemDto,
    @Res() response: Response,
  ) {
    try {
      const updatedItem = await this.itemService.update(id, updateItemDto);
      return response.status(HttpStatus.OK).json({
        message: 'Item updated successfully',
        data: updatedItem,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        return response.status(HttpStatus.NOT_FOUND).json({
          message: error.message,
        });
      }
      if (error instanceof InternalServerErrorException) {
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: error.message,
        });
      }
      return response.status(HttpStatus.BAD_REQUEST).json({
        message: 'Failed to update item',
      });
    }
  }

  @Post('/fetch')
  async fetchItems() {
    await this.itemService.fetchAndStoreItems();
    return { message: 'Items fetched and stored successfully' };
  }

  @Get() // Get all items
  async findAll(@Res() response: Response) {
    const items = await this.itemService.findAll();
    return response.status(HttpStatus.OK).json({
      length: items.length,
      data: items,
    });
  }

  @Get('popularity') // Get all items
  async findPopularity(@Res() response: Response) {
    const items = await this.itemService.findAllPopularity();
    return response.status(HttpStatus.OK).json({
      length: items.length,
      data: items,
    });
  }

  @Get('get/:id') // Get item by ID
  async getById(@Param('id') id: string, @Res() response: Response) {
    const item = await this.itemService.findById(id);
    if (!item) {
      return response.status(HttpStatus.NOT_FOUND).json({
        message: 'Item not found',
      });
    }
    return response.status(HttpStatus.OK).json({
      data: item,
    });
  }

  @Post('/upload-files/:id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'productImages', maxCount: 20 },
        { name: 'dimensionalFiles', maxCount: 20 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB limit
          files: 20, // Total files limit
        },
      },
    ),
  )
  async uploadFiles(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      productImages?: Express.Multer.File[];
      dimensionalFiles?: Express.Multer.File[];
    },
    @Body('applyToAllProductImages') applyToAllProductImages: string, // Separate option for images
    @Body('applyToAllDimensionalFiles') applyToAllDimensionalFiles: string, // Separate option for dimensional files
  ) {
    // Convert apply options to booleans
    const shouldApplyToAllProductImages = applyToAllProductImages === 'true';
    const shouldApplyToAllDimensionalFiles =
      applyToAllDimensionalFiles === 'true';

    // Provide default empty arrays if undefined
    const productImages: Express.Multer.File[] = files.productImages || [];
    const dimensionalFiles: Express.Multer.File[] =
      files.dimensionalFiles || [];

    return await this.itemService.uploadFilesToCloudinary(
      id,
      productImages,
      dimensionalFiles,
      shouldApplyToAllProductImages,
      shouldApplyToAllDimensionalFiles,
    );
  }
// Product delete
  @Delete('delete/item/:id')
  async delete(@Param('id') id: string, @Res() response: Response) {
    try {
      const result = await this.itemService.delete(id);
      return response.status(HttpStatus.OK).json(result);
    } catch (error) {
      // Handle the error appropriately
      if (error instanceof NotFoundException) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .json({ message: error.message });
      }
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'An error occurred while deleting the product.' });
    }
  }

//  all image Delete
  @Delete('delete/:id')
  async deleteImages(
    @Param('id') itemId: string,
    @Body()
    imagesToDelete: { productImages?: string[]; dimensionalFiles?: string[] },
  ): Promise<ItemEntity> {
    return this.itemService.deleteImages(itemId, imagesToDelete);
  }

  // all product delete
  @Delete('delete/items/all')
  async deleteMultiple(@Body('ids') ids: string[], @Res() response: Response) {
    try {
      const result = await this.itemService.deleteMultiple(ids);
      return response.status(HttpStatus.OK).json(result);
    } catch (error) {
      // Handle the error appropriately
      if (error instanceof NotFoundException) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .json({ message: error.message });
      }
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'An error occurred while deleting the products.' });
    }
  }
}
