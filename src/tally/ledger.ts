function getFinancialYearDates(): { fromDate: string, toDate: string } {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Financial year starts from April 1st of current year and ends March 31st of next year
    const fromYear = currentYear;
    const toYear = currentYear + 1;
    
    // Format as YYYYMMDD
    const fromDate = `${fromYear}0401`; // April 1st
    const toDate = `${toYear}0331`;     // March 31st
    
    return { fromDate, toDate };
}

// Usage in XML
const { fromDate, toDate } = getFinancialYearDates();

export const receivable =
    `
<ENVELOPE>
<HEADER>
<TALLYREQUEST>Export Data</TALLYREQUEST>
</HEADER>
<BODY>
<EXPORTDATA>
<REQUESTDESC>
<STATICVARIABLES>
<SVFROMDATE>${fromDate}</SVFROMDATE>
<SVTODATE>${toDate}</SVTODATE>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>
<REPORTNAME>Rpt_TNX_ExpOutstandings</REPORTNAME>
</REQUESTDESC>
</EXPORTDATA>
</BODY>
</ENVELOPE>
 `


export const ledger =
`
 <ENVELOPE>
<HEADER>
<TALLYREQUEST>Export Data</TALLYREQUEST>
</HEADER>
<BODY>
<EXPORTDATA>
<REQUESTDESC>
<STATICVARIABLES>
<SVFROMDATE>${fromDate}</SVFROMDATE>
<SVTODATE>${toDate}</SVTODATE>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<DBBILLEXPLODEFLAG>YES</DBBILLEXPLODEFLAG>
<EXPLODEVNUM>YES</EXPLODEVNUM>
<SHOWRUNBALANCE>Yes</SHOWRUNBALANCE>
</STATICVARIABLES>
<REPORTNAME>Rpt_TNX_ExpLedStat</REPORTNAME>
</REQUESTDESC>
</EXPORTDATA>
</BODY>
</ENVELOPE>
`

