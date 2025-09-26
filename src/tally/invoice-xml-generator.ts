// invoice-xml-generator.ts

import { TallySettings } from 'settings/setting.entity';
import { OrderEntity } from './../order/order.entity';
import { OrderItemEntity } from './../order/order.item.entity';

export function generateInvoiceXML(
  order: OrderEntity,
  orderItems: OrderItemEntity[],
  adminState: string | null,
  tallySettings: TallySettings[],
): string {
  const { user, address, totalPrice, orderNo, discount, createdAt } = order;
  // Check if createdAt is defined, or use the current date as fallback

  const finalAmount = (totalPrice * discount) / 100;
  const formattedAmount = `-${Math.abs(finalAmount).toFixed(2)}`;
  const formattedVatExpAmount = `-${Math.abs(finalAmount).toFixed(2)}`;

  // Map Tally settings
  const salesLedger =
    tallySettings.find((setting) => setting.name === 'Sales')?.value || 'Sales';
  const discountLedger =
    tallySettings.find((setting) => setting.name === 'Discount')?.value ||
    'Discount';
  const cgstLedger =
    tallySettings.find((setting) => setting.name === 'Central Tax Ledger')
      ?.value || 'CGST';
  const sgstLedger =
    tallySettings.find((setting) => setting.name === 'State Tax Ledger')
      ?.value || 'SGST';
  const igstLedger =
    tallySettings.find((setting) => setting.name === 'Interstate Tax Ledger')
      ?.value || 'IGST';

  // Generate XML for each product in the order
  const inventoryEntriesXML = orderItems
    .map(
      (orderItem) => `
        <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${orderItem.product.itemName}</STOCKITEMNAME>
            <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>
            <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>
            <GSTSOURCETYPE>Stock Item</GSTSOURCETYPE>
            <GSTITEMSOURCE>${orderItem.product.itemName}</GSTITEMSOURCE>
            <GSTOVRDNSTOREDNATURE/>
            <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${orderItem.product.sellingPrice}/PCS</RATE>
            <AMOUNT>${orderItem.product.sellingPrice * orderItem.quantity}</AMOUNT>
            <ACTUALQTY>${orderItem.quantity} PCS</ACTUALQTY>
            <BILLEDQTY>${orderItem.quantity} PCS</BILLEDQTY>
            <BATCHALLOCATIONS.LIST>
                <BATCHNAME>Primary Batch</BATCHNAME>
                <INDENTNO>&#4; Not Applicable</INDENTNO>
                <ORDERNO>${orderNo}</ORDERNO>
                <TRACKINGNUMBER>&#4; Not Applicable</TRACKINGNUMBER>
                <AMOUNT>${orderItem.product.sellingPrice * orderItem.quantity}</AMOUNT>
                <ACTUALQTY>${orderItem.quantity}</ACTUALQTY>
                <BILLEDQTY>${orderItem.quantity}</BILLEDQTY>
                 <ORDERDUEDATE P="${formatDate(new Date())}">${formatDate(new Date())}</ORDERDUEDATE>
            </BATCHALLOCATIONS.LIST>
            <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>${salesLedger}</LEDGERNAME>
                <GSTCLASS>&#4; Not Applicable</GSTCLASS>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${orderItem.product.sellingPrice * orderItem.quantity}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
            <DUTYHEADDETAILS.LIST></DUTYHEADDETAILS.LIST>
            ${generateRateDetails(orderItem.product.gstRate)}
        </ALLINVENTORYENTRIES.LIST>
    `,
    )
    .join('');

  // Determine tax type and amount based on adminState
  const isSameState = adminState === address.state;
  // Generate GST entries if applicable
  const gstXML = generateGSTDetails(
    isSameState,
    totalPrice,
    cgstLedger,
    sgstLedger,
    igstLedger,
  );

  return `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                 <STATICVARIABLES>
                   <SVCURRENTCOMPANY>RG TECHNO INDUSTRIAL PRODUCTS PVT LTD(2022-23)</SVCURRENTCOMPANY>
                 </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="Sales Order" ACTION="Create" OBJVIEW="Invoice Voucher View">
                        <ADDRESS.LIST TYPE="String">
                            <ADDRESS>${address.street_address}</ADDRESS>
                            <ADDRESS>${address.state}</ADDRESS>
                            <ADDRESS>${address.country}</ADDRESS>
                        </ADDRESS.LIST>
                        <BASICBUYERADDRESS.LIST TYPE="String">
                            <BASICBUYERADDRESS>${address.street_address}</BASICBUYERADDRESS>
                            <BASICBUYERADDRESS>${address.state}</BASICBUYERADDRESS>
                            <BASICBUYERADDRESS>${address.country}</BASICBUYERADDRESS>
                        </BASICBUYERADDRESS.LIST>
                        <DATE>${formatDateT(new Date())}</DATE>
                        <GUID>${orderNo}</GUID> 
                        <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
                        <VATDEALERTYPE>Regular</VATDEALERTYPE>
                        <STATENAME>${address.state}</STATENAME>
                        <COUNTRYOFRESIDENCE>${address.country}</COUNTRYOFRESIDENCE>
                        <PLACEOFSUPPLY>${address.state}</PLACEOFSUPPLY>
                        <PARTYNAME>${user.name}</PARTYNAME>
                        <CMPGSTIN>${user.gstNo}</CMPGSTIN>
                        <VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
                        <PARTYLEDGERNAME>${user.name}</PARTYLEDGERNAME>
                        <BASICBUYERNAME>${user.name}</BASICBUYERNAME>
                        <CMPGSTREGISTRATIONTYPE>Regular</CMPGSTREGISTRATIONTYPE>
                        <VOUCHERNUMBER>${orderNo}</VOUCHERNUMBER>
                        <REFERENCE>${orderNo}</REFERENCE>
                        <PARTYMAILINGNAME>${user.email}</PARTYMAILINGNAME>
                        <CONSIGNEEMAILINGNAME>${user.email}</CONSIGNEEMAILINGNAME>
                        <CONSIGNEESTATENAME>${address.state}</CONSIGNEESTATENAME>
                        <CMPGSTSTATE>${address.state}</CMPGSTSTATE>
                        <CONSIGNEECOUNTRYNAME>${address.country}</CONSIGNEECOUNTRYNAME>
                        <BASICBASEPARTYNAME>${user.name}</BASICBASEPARTYNAME>
                        <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
                        <BUYERPINNUMBER>${address.zip_code}</BUYERPINNUMBER>
                        <CONSIGNEEPINNUMBER>${address.zip_code}</CONSIGNEEPINNUMBER>
                        <EFFECTIVEDATE>${formatDateT(new Date())}</EFFECTIVEDATE>
                        <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>
                        <ISVATDUTYPAID>Yes</ISVATDUTYPAID>
                                 ${inventoryEntriesXML}
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>${user.name}</LEDGERNAME>
                            <GSTCLASS>&#4; Not Applicable</GSTCLASS>
                            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                            <LEDGERFROMITEM>No</LEDGERFROMITEM>
                            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
                            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                            <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
                            <AMOUNT>-${totalPrice}</AMOUNT>
                        </LEDGERENTRIES.LIST>

                         <LEDGERENTRIES.LIST>
                              <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>
                               <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>
                                 <LEDGERNAME>${discountLedger}</LEDGERNAME>
                                  <GSTCLASS>&#4; Not Applicable</GSTCLASS>
                                      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                                       <AMOUNT>${formattedAmount}</AMOUNT>
                                      <VATEXPAMOUNT>${formattedVatExpAmount}</VATEXPAMOUNT>
                             </LEDGERENTRIES.LIST>
                            ${gstXML}
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>
`;
}

// Helper function to generate GST details for CGST, SGST, or IGST
function generateGSTDetails(
  isSameState: boolean,
  totalPrice: number,
  cgstLedger: string,
  sgstLedger: string,
  igstLedger: string,
): string {
  return isSameState
    ? `
                             <LEDGERENTRIES.LIST>
              <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>
                <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>
                 <LEDGERNAME>${cgstLedger}</LEDGERNAME>
                            <GSTCLASS>&#4; Not Applicable</GSTCLASS>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <AMOUNT>${(totalPrice * 0.09).toFixed(2)}</AMOUNT>
                            <VATEXPAMOUNT>${(totalPrice * 0.09).toFixed(2)}</VATEXPAMOUNT>
            </LEDGERENTRIES.LIST>

            <LEDGERENTRIES.LIST>
             <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>
                <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>
               <LEDGERNAME>${sgstLedger}</LEDGERNAME>
                            <GSTCLASS>&#4; Not Applicable</GSTCLASS>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <AMOUNT>${(totalPrice * 0.09).toFixed(2)}</AMOUNT>
                            <VATEXPAMOUNT>${(totalPrice * 0.09).toFixed(2)}</VATEXPAMOUNT>
            </LEDGERENTRIES.LIST>
        `
    : `
        <LEDGERENTRIES.LIST>
                            <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>
                            <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>
                            <LEDGERNAME>${igstLedger}</LEDGERNAME>
                            <GSTCLASS>&#4; Not Applicable</GSTCLASS>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <AMOUNT>${(totalPrice * 0.18).toFixed(2)}</AMOUNT>
                            <VATEXPAMOUNT>${(totalPrice * 0.18).toFixed(2)}</VATEXPAMOUNT>
                        </LEDGERENTRIES.LIST>
        `;
}

// Helper function to generate RATEDETAILS.LIST for GST rates
function generateRateDetails(gstRate: number): string {
  return `
        <RATEDETAILS.LIST>
            <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>
            <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
            <GSTRATE>${gstRate}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
            <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>
            <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
             <GSTRATE>${gstRate}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
            <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>
            <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
             <GSTRATE>${gstRate}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
            <GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD>
            <GSTRATEVALUATIONTYPE>&#4; Not Applicable</GSTRATEVALUATIONTYPE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
            <GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD>
            <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
        </RATEDETAILS.LIST>
    `;
}

// Helper function to format date to YYYYMMDD
function formatDateT(date: Date): string {
  const isoString = date.toISOString(); // Gets "2025-06-17T09:38:29.165Z"
  return isoString.slice(0, 10).replace(/-/g, ''); // Will return "20250617"
}


function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}