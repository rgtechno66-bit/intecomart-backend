import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseStringPromise } from 'xml2js';
import { BillEntity, LedgerEntity, LedgerStatementEntity, LedgerVoucherEntity } from './ledger.entity';
import { LedgerDto, LedgerStatementDto, LedgerVoucherDto } from './ledger.dto';
import axios from 'axios';
import { ledger, receivable } from '../tally/ledger';
import { SyncControlSettings } from './../settings/setting.entity';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(SyncControlSettings)
    private readonly syncControlSettingsRepository: Repository<SyncControlSettings>,

    @InjectRepository(LedgerEntity)
    private readonly ledgerRepository: Repository<LedgerEntity>,
    @InjectRepository(BillEntity)
    private readonly billRepository: Repository<BillEntity>,

    @InjectRepository(LedgerStatementEntity)
    private readonly ledgerStatementRepo: Repository<LedgerStatementEntity>,

    @InjectRepository(LedgerVoucherEntity)
    private readonly ledgerVoucherRepo: Repository<LedgerVoucherEntity>,

  ) { }



  // OutStanding Receivables
  async fetchAndStoreLedgers(): Promise<void> {
    const REQUEST_TIMEOUT = 60000;

    const SyncSetting = await this.syncControlSettingsRepository.findOne({
      where: { moduleName: 'Outstanding Amount' },
    });

    if (!SyncSetting || !SyncSetting.isManualSyncEnabled) {
      throw new BadRequestException('Manual Sync for Outstanding is disabled.');
    }

    try {
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: { 'Content-Type': 'text/xml' },
        data: receivable,
        timeout: REQUEST_TIMEOUT,
      });

      if (response.data.includes('<LINEERROR>')) {
        throw new BadRequestException('Please Login to Tally');
      }

      const outstandingData = await this.parseXmlToOutstanding(response.data);
      const existingOutstandings = await this.ledgerRepository.find();

      const existingOutstandingMap = new Map(
        existingOutstandings.map((outstanding) => [outstanding.customerName, outstanding]),
      );

      // Batch size 1500
      const batchSize = 1500;
      const batches = [];
      
      for (let i = 0; i < outstandingData.length; i += batchSize) {
        batches.push(outstandingData.slice(i, i + batchSize));
      }

      // Parallel processing
      await Promise.all(
        batches.map(async (batch) => {
          const updates = [];
          const inserts = [];

          for (const outstanding of batch) {
            const existingOutstanding = existingOutstandingMap.get(outstanding.customerName);

            if (existingOutstanding) {
              if (this.hasStatementChanges(existingOutstanding, outstanding)) {
                updates.push({
                  ...existingOutstanding,
                  ...outstanding,
                  bills: await this.processBills(existingOutstanding, outstanding.bills),
                });
              }
            } else {
              inserts.push(outstanding);
            }
          }

          // Bulk update
          if (updates.length > 0) {
            await this.ledgerRepository.save(updates);
          }

          // Bulk insert and bills processing
          if (inserts.length > 0) {
            for (const outstanding of inserts) {
              const saved = await this.ledgerRepository.save(outstanding);
              
              if (outstanding.bills) {
                const billPromises = outstanding.bills.map(async (bill) => {
                  bill.ledger = saved;
                  return this.saveIfNotDuplicate(bill);
                });
                
                await Promise.all(billPromises);
              }
            }
          }
        }),
      );
    } catch (error: any) {
      console.error('Error syncing outstanding data:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Tally request timed out. Please ensure Tally is open and accessible.',
        );
      }

      throw new InternalServerErrorException('Make sure Tally is open and logged in.');
    }
  }

  async parseXmlToOutstanding(xml: string): Promise<LedgerEntity[]> {
    const wrappedXml = `<OUTSTANDINGS>${xml}</OUTSTANDINGS>`;
    const parsedResult = await parseStringPromise(wrappedXml);

    const outstandingItems = parsedResult.OUTSTANDINGS?.OUTSTANDING || [];

    return outstandingItems.map((item: any) => {
      const outstandingDto = new LedgerEntity();

      outstandingDto.customerName = this.cleanString(item.CUSTOMERNAME?.[0] || '');
      outstandingDto.creditLimit = parseFloat(item.CREDITLIMIT?.[0] || '0');
      outstandingDto.closingBalance = parseFloat(item.CLOSINGBALANCE?.[0] || '0');

      outstandingDto.bills = item.BILLS?.map((bill: any) => {
        const ledgerBill = new BillEntity();
        ledgerBill.tallyOrdId = this.cleanString(bill.TALLYORDID?.[0] || '');
        ledgerBill.nxOrderId = this.cleanString(bill.NXORDERID?.[0] || '');
        ledgerBill.tallyInvNo = this.cleanString(bill.TALLYINVNO?.[0] || '');
        ledgerBill.billDate = this.cleanString(bill.BILLDATE?.[0] || '');
        ledgerBill.openingBalance = parseFloat(bill.OPENINGBALANCE?.[0] || '0');
        ledgerBill.closingBalance = parseFloat(bill.CLOSINGBALANCE?.[0] || '0');
        ledgerBill.creditPeriod = this.cleanString(bill.CREDITPERIOD?.[0] || '0');

        return ledgerBill;
      }) || [];

      return outstandingDto;
    });
  }


  private cleanString(value: string | undefined): string {
    return value?.replace(/\x04/g, '').trim() || '';
  }

  private async processBills(
    existingBills: LedgerDto,
    newBills: BillEntity[]): Promise<BillEntity[]> {
    const existing = existingBills.bills;
    const processed: BillEntity[] = [];

    for (const newBill of newBills) {
      const isDuplicate = existing.some(
        (existing) =>
          existing.tallyOrdId === newBill.tallyOrdId &&
          existing.tallyInvNo === newBill.tallyInvNo &&
          existing.nxOrderId === newBill.nxOrderId &&
          existing.tallyInvNo === newBill.tallyInvNo &&
          existing.billDate === newBill.billDate &&
          existing.openingBalance === newBill.openingBalance &&
          existing.closingBalance === newBill.closingBalance &&
          existing.creditPeriod === newBill.creditPeriod);

      if (!isDuplicate) {
        processed.push(newBill);
      }
    }

    return processed;
  }

  private async saveIfNotDuplicate(bill: BillEntity): Promise<void> {
    const duplicateVoucher = await this.billRepository.findOne({
      where: {
        tallyOrdId: bill.tallyOrdId,
        tallyInvNo: bill.tallyInvNo,
        nxOrderId: bill.nxOrderId,
        billDate: bill.billDate,
        openingBalance: bill.openingBalance,
        closingBalance: bill.closingBalance,
        creditPeriod: bill.creditPeriod
      },
    });

    if (!duplicateVoucher) {
      await this.billRepository.save(bill);
    } else {
      console.log(`Duplicate bill detected and skipped`);
    }
  }

  private hasStatementChanges(
    existingBill: LedgerEntity,
    newBill: LedgerEntity,
  ): boolean {
    return (

      existingBill.customerName === newBill.customerName &&
      existingBill.creditLimit === newBill.creditLimit,
      existingBill.closingBalance === newBill.closingBalance,
      this.hasChanges(existingBill.bills, newBill.bills)
    );
  }

  private hasChanges(
    existingBills: BillEntity[],
    newBills: BillEntity[],
  ): boolean {
    if (existingBills.length !== newBills.length) return true;

    for (const newBill of newBills) {
      const isExisting = existingBills.some(
        (existingVoucher) =>
          existingVoucher.tallyOrdId === newBill.tallyOrdId &&
          existingVoucher.nxOrderId === newBill.nxOrderId &&
          existingVoucher.tallyInvNo === newBill.tallyInvNo &&
          existingVoucher.billDate === newBill.billDate &&
          existingVoucher.openingBalance === newBill.openingBalance &&
          existingVoucher.closingBalance === newBill.closingBalance &&
          existingVoucher.creditPeriod === newBill.creditPeriod,
      );

      if (!isExisting) {
        return true;
      }
    }

    return false;
  }


  async deleteMultiple(ids: string[]): Promise<{ message: string }> {
    const notFoundIds: string[] = [];

    for (const id of ids) {
      const ledger = await this.findById(id);
      if (!ledger) {
        notFoundIds.push(id);
        continue; // skip this ID if not found
      }
      await this.ledgerRepository.remove(ledger);
    }

    if (notFoundIds.length > 0) {
      throw new NotFoundException(`outstanding with ids ${notFoundIds.join(', ')} not found`);
    }

    return { message: 'outstanding deleted successfully' };
  }

  async findAll(): Promise<LedgerEntity[]> {
    return this.ledgerRepository.find();
  }

  // Retrieve ledger data by user's name (for regular users)
  async findAllDataByUserName(userName: string): Promise<LedgerEntity[]> {
    return this.ledgerRepository.find({ where: { customerName: userName } }); // Match by name
  }

  async findById(id: string): Promise<LedgerEntity | null> {
    return this.ledgerRepository.findOne({ where: { id }, relations: ['bills'] });
  }

  async deleteById(id: string): Promise<boolean> {
    const ledger = await this.ledgerRepository.findOne({ where: { id }, relations: ['bills'] });
    if (!ledger) {
      return false;
    }

    // Remove associated bills first
    if (ledger.bills.length > 0) {
      await this.billRepository.remove(ledger.bills);
    }

    // Remove ledger
    await this.ledgerRepository.remove(ledger);
    return true;
  }



  // Ledger Statements
  async fetchAndLedgers(): Promise<void> {
    const REQUEST_TIMEOUT = 60000;

    const SyncSetting = await this.syncControlSettingsRepository.findOne({
      where: { moduleName: 'Ledger Statement' },
    });

    if (!SyncSetting || !SyncSetting.isManualSyncEnabled) {
      throw new BadRequestException('Manual Sync for Ledger is disabled.');
    }

    try {
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: { 'Content-Type': 'text/xml' },
        data: ledger,
        timeout: REQUEST_TIMEOUT,
      });

      if (response.data.includes('<LINEERROR>')) {
        throw new BadRequestException('Please Login to Tally');
      }

      const ledgerData = await this.parseXmlToLedger(response.data);
      const existingLedgers = await this.ledgerStatementRepo.find();

      const existingLedgerMap = new Map(
        existingLedgers.map((ledger) => [ledger.party, ledger]),
      );

      // Batch size 1500
      const batchSize = 1500;
      const batches = [];
      
      for (let i = 0; i < ledgerData.length; i += batchSize) {
        batches.push(ledgerData.slice(i, i + batchSize));
      }

      // parallel processing
      await Promise.all(
        batches.map(async (batch) => {
          const updates = [];
          const inserts = [];

          for (const ledger of batch) {
            const existingLedger = existingLedgerMap.get(ledger.party);

            if (existingLedger) {
              if (this.hasLedgerStatementChanges(existingLedger, ledger)) {
                updates.push({
                  ...existingLedger,
                  ...ledger,
                  vouchers: await this.processVouchers(existingLedger, ledger.vouchers),
                });
              }
            } else {
              inserts.push(ledger);
            }
          }

          // update
          if (updates.length > 0) {
            await this.ledgerStatementRepo.save(updates);
          }

          // insert and voucher processing
          if (inserts.length > 0) {
            for (const ledger of inserts) {
              const savedLedger = await this.ledgerStatementRepo.save(ledger);
              
              if (ledger.vouchers) {
                const voucherPromises = ledger.vouchers.map(async (voucher) => {
                  voucher.ledgerStatement = savedLedger;
                  return this.saveVoucherIfNotDuplicate(voucher);
                });
                
                await Promise.all(voucherPromises);
              }
            }
          }
        }),
      );
    } catch (error: any) {
      console.error('Error syncing ledger:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Tally request timed out. Please ensure Tally is open and accessible.',
        );
      }

      throw new InternalServerErrorException('Make sure Tally is open and logged in.');
    }
  }

  async parseXmlToLedger(xml: string): Promise<LedgerStatementEntity[]> {
    const wrappedXml = `<LEDGERSTATEMENTS>${xml}</LEDGERSTATEMENTS>`;
    const parsedResult = await parseStringPromise(wrappedXml);

    const ledgerItems = parsedResult.LEDGERSTATEMENTS?.LEDGERSTATEMENT || [];

    return ledgerItems.map((item: any) => {
      const ledgerEntity = new LedgerStatementEntity();
      ledgerEntity.party = this.cleanString(item.PARTY?.[0] || '');
      ledgerEntity.alias = this.cleanString(item.ALIAS?.[0] || '');
      ledgerEntity.openingBalance = parseFloat(item.OPENINGBALANCE?.[0] || '0');
      ledgerEntity.closingBalance = parseFloat(item.CLOSINGBALANCE?.[0] || '0');
      ledgerEntity.totalDebitAmount = parseFloat(item.TOTADEBITAMT?.[0] || '0');
      ledgerEntity.totalCreditAmount = parseFloat(item.TOTALCREDITAMT?.[0] || '0');

      ledgerEntity.vouchers = item.LEDGERVOUCHERS?.map((voucher: any) => {
        const ledgerVoucher = new LedgerVoucherEntity();
        ledgerVoucher.date = this.cleanString(voucher.DATE?.[0] || '');
        ledgerVoucher.ledger = this.cleanString(voucher.LEDGER?.[0] || '');
        ledgerVoucher.voucherType = this.cleanString(voucher.VCHTYPE?.[0] || '');
        ledgerVoucher.voucherNo = this.cleanString(voucher.VCHNO?.[0] || '');
        ledgerVoucher.debitAmount = parseFloat(voucher.DEBITAMT?.[0] || '0');
        ledgerVoucher.creditAmount = parseFloat(voucher.CREDITAMT?.[0] || '0');
        return ledgerVoucher;
      }) || [];

      return ledgerEntity;
    });
  }

  private async processVouchers(
    existingLedger: LedgerStatementEntity,
    newVouchers: LedgerVoucherEntity[],
  ): Promise<LedgerVoucherEntity[]> {
    const existingVouchers = existingLedger.vouchers;

    const processedVouchers: LedgerVoucherEntity[] = [];

    for (const newVoucher of newVouchers) {
      const isDuplicate = existingVouchers.some(
        (existingVoucher) =>
          existingVoucher.voucherNo === newVoucher.voucherNo &&
          existingVoucher.date === newVoucher.date &&
          existingVoucher.debitAmount === newVoucher.debitAmount &&
          existingVoucher.creditAmount === newVoucher.creditAmount,
      );

      if (!isDuplicate) {
        processedVouchers.push(newVoucher);
      }
    }

    return processedVouchers;
  }

  private async saveVoucherIfNotDuplicate(voucher: LedgerVoucherEntity): Promise<void> {
    const duplicateVoucher = await this.ledgerVoucherRepo.findOne({
      where: {
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        debitAmount: voucher.debitAmount,
        creditAmount: voucher.creditAmount,
      },
    });

    if (!duplicateVoucher) {
      await this.ledgerVoucherRepo.save(voucher);
    } else {
      console.log(`Duplicate voucher detected and skipped: ${voucher.voucherNo}`);
    }
  }

  private hasLedgerStatementChanges(
    existingLedger: LedgerStatementEntity,
    newLedger: LedgerStatementEntity,
  ): boolean {
    return (
      existingLedger.party !== newLedger.party ||
      existingLedger.alias !== newLedger.alias ||
      existingLedger.openingBalance !== newLedger.openingBalance ||
      existingLedger.closingBalance !== newLedger.closingBalance ||
      existingLedger.totalDebitAmount !== newLedger.totalDebitAmount ||
      existingLedger.totalCreditAmount !== newLedger.totalCreditAmount ||
      this.hasVoucherChanges(existingLedger.vouchers, newLedger.vouchers)
    );
  }

  private hasVoucherChanges(
    existingVouchers: LedgerVoucherEntity[],
    newVouchers: LedgerVoucherEntity[],
  ): boolean {
    if (existingVouchers.length !== newVouchers.length) return true;

    for (const newVoucher of newVouchers) {
      const isExisting = existingVouchers.some(
        (existingVoucher) =>
          existingVoucher.voucherNo === newVoucher.voucherNo &&
          existingVoucher.date === newVoucher.date &&
          existingVoucher.debitAmount === newVoucher.debitAmount &&
          existingVoucher.creditAmount === newVoucher.creditAmount,
      );

      if (!isExisting) {
        return true;
      }
    }

    return false;
  }

  // Retrieve all ledger statements
  async findLedgerData(): Promise<LedgerStatementEntity[]> {
    return this.ledgerStatementRepo.find();
  }

  // Retrieve ledger data by user's name (for regular users)
  async findLedgerDataByUserName(userName: string): Promise<LedgerStatementEntity[]> {
    return this.ledgerStatementRepo.find({ where: { party: userName } }); // Match by name
  }

  // Retrieve a specific ledger statement by ID
  async findByIdLedgerData(id: string): Promise<LedgerStatementEntity> {
    const statement = await this.ledgerStatementRepo.findOne({ where: { id } });
    if (!statement) {
      throw new NotFoundException('Ledger statement not found.');
    }
    return statement;
  }



  @Cron('0 * * * *') // hour
  async cronFetchAndStoreLedgers(): Promise<void> {
    console.log('Complete Receivables cleanup started:', new Date().toISOString());
    const REQUEST_TIMEOUT = 60000; // 15 seconds timeout

    // Check if "ManualSync" is enabled for outstanding data
    const SyncSetting = await this.syncControlSettingsRepository.findOne({
      where: { moduleName: 'Outstanding Amount' },
    });

    if (!SyncSetting || !SyncSetting.isAutoSyncEnabled) {
      throw new BadRequestException('Auto Sync for Outstanding is disabled.');
    }

    try {
      // Fetch the data from Tally (this can be dynamic depending on the data you're fetching)
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: {
          'Content-Type': 'text/xml',
        },
        data: receivable, // Replace with your dynamic XML request
        timeout: REQUEST_TIMEOUT,
      });

      // Check for specific error patterns in the response (like login error)
      if (response.data.includes('<LINEERROR>')) {
        throw new BadRequestException('Please Login to Tally');
      }

      // Parse the XML data to your required DTO or entity structure
      const outstandingData = await this.parseXmlToOutstanding(response.data);
      const existingOutstandings = await this.ledgerRepository.find();

      // Create a map for quick lookup by customer name
      const existingOutstandingMap = new Map(
        existingOutstandings.map((outstanding) => [outstanding.customerName, outstanding]),
      );

        // Batch size 1500
        const batchSize = 1500;
        const batches = [];
        
        for (let i = 0; i < outstandingData.length; i += batchSize) {
          batches.push(outstandingData.slice(i, i + batchSize));
        }
  
        // Parallel processing
        await Promise.all(
          batches.map(async (batch) => {
            const updates = [];
            const inserts = [];
  
            for (const outstanding of batch) {
              const existingOutstanding = existingOutstandingMap.get(outstanding.customerName);
  
              if (existingOutstanding) {
                if (this.hasStatementChanges(existingOutstanding, outstanding)) {
                  updates.push({
                    ...existingOutstanding,
                    ...outstanding,
                    bills: await this.processBills(existingOutstanding, outstanding.bills),
                  });
                }
              } else {
                inserts.push(outstanding);
              }
            }
  
            // Bulk update
            if (updates.length > 0) {
              await this.ledgerRepository.save(updates);
            }
  
            // Bulk insert and bills processing
            if (inserts.length > 0) {
              for (const outstanding of inserts) {
                const saved = await this.ledgerRepository.save(outstanding);
                
                if (outstanding.bills) {
                  const billPromises = outstanding.bills.map(async (bill) => {
                    bill.ledger = saved;
                    return this.saveIfNotDuplicate(bill);
                  });
                  
                  await Promise.all(billPromises);
                }
              }
            }
          }),
        );
    } catch (error: any) {
      console.error('Error syncing outstanding data:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Tally request timed out. Please ensure Tally is open and accessible.',
        );
      }

      throw new InternalServerErrorException('Make sure Tally is open and logged in.');
    }
  }

  @Cron('0 * * * *') // hour
  // @Cron('*/10 * * * * *')
  async cronFetchAndLedgers(): Promise<void> {
    console.log('Complete Ledger started:', new Date().toISOString());
    const REQUEST_TIMEOUT = 60000;

    const SyncSetting = await this.syncControlSettingsRepository.findOne({
      where: { moduleName: 'Ledger Statement' },
    });

    if (!SyncSetting || !SyncSetting.isAutoSyncEnabled) {
      throw new BadRequestException('Auto Sync for Ledger is disabled.');
    }

    try {
      const response = await axios.get(process.env.TALLY_URL as string, {
        headers: { 'Content-Type': 'text/xml' },
        data: ledger,
        timeout: REQUEST_TIMEOUT,
      });

      if (response.data.includes('<LINEERROR>')) {
        throw new BadRequestException('Please Login to Tally');
      }

      const ledgerData = await this.parseXmlToLedger(response.data);
      const existingLedgers = await this.ledgerStatementRepo.find();

      const existingLedgerMap = new Map(
        existingLedgers.map((ledger) => [ledger.party, ledger]),
      );

        // Batch size 1500
        const batchSize = 1500;
        const batches = [];
        
        for (let i = 0; i < ledgerData.length; i += batchSize) {
          batches.push(ledgerData.slice(i, i + batchSize));
        }
  
        // parallel processing
        await Promise.all(
          batches.map(async (batch) => {
            const updates = [];
            const inserts = [];
  
            for (const ledger of batch) {
              const existingLedger = existingLedgerMap.get(ledger.party);
  
              if (existingLedger) {
                if (this.hasLedgerStatementChanges(existingLedger, ledger)) {
                  updates.push({
                    ...existingLedger,
                    ...ledger,
                    vouchers: await this.processVouchers(existingLedger, ledger.vouchers),
                  });
                }
              } else {
                inserts.push(ledger);
              }
            }
  
            // update
            if (updates.length > 0) {
              await this.ledgerStatementRepo.save(updates);
            }
  
            // insert and voucher processing
            if (inserts.length > 0) {
              for (const ledger of inserts) {
                const savedLedger = await this.ledgerStatementRepo.save(ledger);
                
                if (ledger.vouchers) {
                  const voucherPromises = ledger.vouchers.map(async (voucher) => {
                    voucher.ledgerStatement = savedLedger;
                    return this.saveVoucherIfNotDuplicate(voucher);
                  });
                  
                  await Promise.all(voucherPromises);
                }
              }
            }
          }),
        );
    } catch (error: any) {
      console.error('Error syncing ledger:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'Tally request timed out. Please ensure Tally is open and accessible.',
        );
      }

      throw new InternalServerErrorException('Make sure Tally is open and logged in.');
    }
  }

}




