import * as nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { CheckoutEntity } from '../checkout/checkout.entity';
import { CreateCheckoutDto } from '../checkout/checkout.dto';
import { EmailService } from '../service/email.service';
import { CloudinaryService } from '../service/cloudinary.service';

export class PdfEmailUtils {
  /**
   * Generate Professional PDF for order details with proper ₹ symbol
   */
  static async generatePDF(
    checkout: CheckoutEntity,
    createCheckoutDto: CreateCheckoutDto,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 40, 
          autoFirstPage: true,
          font: 'Helvetica'
        });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (error) => reject(error));

        let y = 40;

        // Header with Company Info
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Intecomart', { align: 'center' });
        y += 25;
        doc.fontSize(10).font('Helvetica').fillColor('#000000').text('RG TECHNO INDUSTRIAL PRODUCTS PVT LTD F-471 SECTOR-63, NOIDA-201301 Uttar Pradesh, INDIA', { align: 'center' });
        y += 15;
        doc.text('Phone: +91 9811068569 | Email: intecomart.com', { align: 'center' });
        y += 30;

        // Invoice Title
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000').text('INVOICE', { align: 'center' });
        y += 30;

        // Order and Customer Info in two columns
        const leftX = 40;
        const rightX = 300;

        // Left Column - Order Info
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Order Information:', leftX, y);
        y += 20;
        doc.fontSize(10).font('Helvetica').fillColor('#000000')
           .text(`Order ID: ${checkout.id || 'N/A'}`, leftX, y)
           .text(`Date: ${new Date(checkout.createdAt || Date.now()).toLocaleDateString()}`, leftX, y + 15)
           .text(`Payment: Online`, leftX, y + 30)
           .text(`Status: Confirmed`, leftX, y + 45);

        // Right Column - Customer Info
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Customer Information:', rightX, y);
        y += 20;
        doc.fontSize(10).font('Helvetica').fillColor('#000000')
           .text(`Name: ${checkout.name || 'N/A'}`, rightX, y)
           .text(`Email: ${checkout.email || 'N/A'}`, rightX, y + 15)
           .text(`Mobile: ${checkout.mobile || 'N/A'}`, rightX, y + 30)
           .text(`Address: ${checkout.address || 'N/A'}`, rightX, y + 45)
           .text(`City: ${checkout.state || 'N/A'}`, rightX, y + 60)
           .text(`Pincode: ${checkout.pincode || 'N/A'}`, rightX, y + 75);

        y += 100;

        // Products Table Header
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Order Items:', 40, y);
        y += 25;

        // Table header with background
        doc.rect(40, y, 520, 25).fillColor('#e0e0e0').fill();
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
           .text('Sr.', 50, y + 5)
           .text('Product Name', 80, y + 5)
           .text('Qty', 350, y + 5)
           .text('Price', 400, y + 5)
           .text('Total', 470, y + 5);
        y += 30;

        // Products List
        let totalAmount = 0;
        createCheckoutDto.products.forEach((product, index) => {
          const qty = product.quantity || product.noOfPkg || 0;
          const price = product.sellingPrice || 0;
          const total = qty * price;
          totalAmount += total;

          // Alternate row colors
          if (index % 2 === 0) {
            doc.rect(40, y - 5, 520, 20).fillColor('#f5f5f5').fill();
          }

          doc.fontSize(10).font('Helvetica').fillColor('#000000')
             .text(`${index + 1}`, 50, y)
             .text(product.itemName || 'N/A', 80, y, { width: 260 })
             .text(`${qty}`, 350, y)
             .text(`Rs. ${Number(price).toLocaleString('en-IN')}`, 400, y)
             .text(`Rs. ${Number(total).toLocaleString('en-IN')}`, 470, y);
          y += 20;
        });

        y += 20;

        // Summary Box
        const summaryWidth = 200;
        const summaryX = 400;
        
        doc.rect(summaryX, y, summaryWidth, 100).fillColor('#f8f9fa').fill().strokeColor('#000000').lineWidth(1).stroke();
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Order Summary', summaryX + 10, y + 10);
        y += 30;

        const discount = Number(checkout.discount) || 0;
        const total = Number(checkout.total) || totalAmount - discount;

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
           .text('Subtotal:', summaryX + 10, y)
           .text('Discount:', summaryX + 10, y + 20)
           .text('Total:', summaryX + 10, y + 40);

        doc.font('Helvetica').fillColor('#000000')
           .text(`Rs. ${Number(totalAmount).toLocaleString('en-IN')}`, summaryX + 100, y)
           .text(`-Rs. ${Number(discount).toLocaleString('en-IN')}`, summaryX + 100, y + 20)
           .font('Helvetica-Bold').fontSize(12)
           .text(`Rs. ${Number(total).toLocaleString('en-IN')}`, summaryX + 100, y + 40);

        // Amount in words
        y += 60;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('Amount in Words:', 40, y);
        doc.font('Helvetica').fillColor('#000000').text(this.numberToWords(total), 40, y + 15, { width: 350 });

        // Footer
        y += 40;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('Terms & Conditions:', 40, y);
        doc.fontSize(8).font('Helvetica').fillColor('#000000')
           .text('• Payment is due within 30 days', 40, y + 15)
           .text('• Goods once sold will not be taken back', 40, y + 25)
           .text('• This is a computer generated invoice', 40, y + 35);

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Thank you for your business!', { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private static numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero Rupees Only';
    
    let rupees = Math.floor(num);
    let paise = Math.round((num - rupees) * 100);

    let result = '';

    if (rupees > 0) {
      if (rupees >= 10000000) {
        result += this.numberToWords(Math.floor(rupees / 10000000)) + ' Crore ';
        rupees %= 10000000;
      }
      if (rupees >= 100000) {
        result += this.numberToWords(Math.floor(rupees / 100000)) + ' Lakh ';
        rupees %= 100000;
      }
      if (rupees >= 1000) {
        result += this.numberToWords(Math.floor(rupees / 1000)) + ' Thousand ';
        rupees %= 1000;
      }
      if (rupees >= 100) {
        result += ones[Math.floor(rupees / 100)] + ' Hundred ';
        rupees %= 100;
      }
      if (rupees >= 20) {
        result += tens[Math.floor(rupees / 10)] + ' ';
        rupees %= 10;
      }
      if (rupees >= 10) {
        result += teens[rupees - 10] + ' ';
      } else if (rupees > 0) {
        result += ones[rupees] + ' ';
      }
      result += 'Rupees ';
    }

    if (paise > 0) {
      if (paise >= 20) {
        result += tens[Math.floor(paise / 10)] + ' ';
        paise %= 10;
      }
      if (paise >= 10) {
        result += teens[paise - 10] + ' ';
      } else if (paise > 0) {
        result += ones[paise] + ' ';
      }
      result += 'Paise ';
    }

    return result.trim() + ' Only';
  }

  /**
   * Send email with PDF attachment and upload to Cloudinary
   */
  static async sendEmailWithPDF(
    checkout: CheckoutEntity, 
    createCheckoutDto: CreateCheckoutDto, 
    cloudinaryService: CloudinaryService,
  ): Promise<string | null> {
    try {
      // Create PDF
      const pdfBuffer = await this.generatePDF(checkout, createCheckoutDto);

      // Send email using EmailService
      const emailService = new EmailService();
      await emailService.sendEmailPDF(pdfBuffer, checkout, createCheckoutDto);
      
      // Upload PDF to Cloudinary
      let cloudinaryUrl: string | null = null;
      try {
        const fileName = `invoice-${checkout.id}-${Date.now()}.pdf`;
        cloudinaryUrl = await cloudinaryService.uploadFile(
          pdfBuffer, 
          'invoices', 
          fileName
        );
        console.log('PDF uploaded to Cloudinary:', cloudinaryUrl);
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        // Don't throw error, just log it - email was still sent successfully
      }
      
      console.log('Email sent successfully');
      return cloudinaryUrl;
    } catch (error: any) {
      console.error('Email sending failed:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
} 