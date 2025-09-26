import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { SyncLogEntity } from './sync-log.entity';
import { CreateSyncLogDto } from './create-sync-log.dto';

@Injectable()
export class SyncLogService {
  constructor(
    @InjectRepository(SyncLogEntity)
    private readonly syncLogRepository: Repository<SyncLogEntity>,
  ) {}

  // Create a new sync log
  async createSyncLog(createSyncLogDto: CreateSyncLogDto): Promise<SyncLogEntity> {
    // Explicitly cast the DTO to DeepPartial<SyncLogEntity>
    const syncLog = this.syncLogRepository.create(createSyncLogDto as DeepPartial<SyncLogEntity>);
    return this.syncLogRepository.save(syncLog);
  }

  // Get all sync logs
  async getAllSyncLogs(): Promise<SyncLogEntity[]> {
    return this.syncLogRepository.find({
      order: { created_at: 'DESC' },
    });
  }


  // async fetchAndStoreData<T extends ObjectLiteral>(
  //   url: string,
  //   dataPayload: any,
  //   parseXml: (data: any) => Promise<T[]>,
  //   repository: Repository<T>,
  //   entityName: string,
  //   syncType: string,
  //   logRepository: Repository<SyncLogEntity>
  // ): Promise<void> {
  //   const REQUEST_TIMEOUT = 20000; // 20 seconds timeout
  
  //   let successCount = 0;
  //   let failedCount = 0;
  
  //   try {
  //     const response = await axios.get(url, {
  //       headers: {
  //         'Content-Type': 'text/xml',
  //       },
  //       data: dataPayload,
  //       timeout: REQUEST_TIMEOUT,
  //     });
  
  //     const entities = await parseXml(response.data);
  //     const existingEntities = await repository.find();
  
  //     const existingEntityMap = new Map(
  //       existingEntities.map(entity => [entity['uniqueIdentifier'], entity])
  //     );
  
  //     for (const entity of entities) {
  //       const existingEntity = existingEntityMap.get(entity['uniqueIdentifier']);
  //       try {
  //         if (existingEntity) {
  //           if (this.hasChanges(existingEntity, entity)) {
  //             await repository.save({ ...existingEntity, ...entity });
  //             successCount++;
  //           } else {
  //             console.log(`No changes for ${entityName}: ${entity['name']}`);
  //           }
  //         } else {
  //           await repository.save(entity);
  //           successCount++;
  //         }
  //       } catch (error) {
  //         failedCount++;
  //         console.error(`Error saving ${entityName}:`, error);
  //       }
  //     }
  
  //     await logRepository.save({
  //       sync_type: syncType,
  //       success_count: successCount,
  //       failed_count: failedCount,
  //       total_count: entities.length,
  //       status: SyncLogStatus.SUCCESS,
  //     });
  //   } catch (error: any) {
  //     failedCount = 1;
  
  //     await logRepository.save({
  //       sync_type: syncType,
  //       success_count: successCount,
  //       failed_count: failedCount,
  //       total_count: 0,
  //       status: SyncLogStatus.FAIL,
  //     });
  
  //     if (error.code === 'ECONNABORTED') {
  //       throw new InternalServerErrorException('Request timeout: Please check Tally connection.');
  //     }
  //     throw new InternalServerErrorException('Error fetching data from Tally.');
  //   }
  // }

  // private hasChanges<T extends ObjectLiteral>(existingEntity: T, updatedEntity: T): boolean {
  //   return JSON.stringify(existingEntity) !== JSON.stringify(updatedEntity);
  // }
}
