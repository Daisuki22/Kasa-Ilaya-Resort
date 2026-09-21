import React, { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear, subMonths, subWeeks, subYears } from "date-fns";
import { Download, Loader2, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { baseClient } from "@/api/baseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PERIODS = ["Weekly", "Monthly", "Annually"];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const toAmount = (value) => Number(value || 0);

const toDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return format(date, "yyyy-MM-dd");
};

const formatCurrency = (value) => currencyFormatter.format(toAmount(value));

const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

const parseDateKey = (value) => new Date(`${value}T00:00:00`);

const buildTimelineData = (rows, period, selectedRange) => {
  if (!selectedRange?.start || !selectedRange?.end) {
    return [];
  }

  if (period === "Weekly") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(parseDateKey(selectedRange.start), index);
      const key = toDateKey(date);
      const dayRows = rows.filter((booking) => toDateKey(booking.booking_date) === key);

      return {
        label: format(date, "EEE"),
        revenue: dayRows.reduce((sum, booking) => sum + toAmount(booking.total_amount), 0),
        bookings: dayRows.length,
      };
    });
  }

  if (period === "Annually") {
    const start = startOfYear(parseDateKey(selectedRange.start));

    return Array.from({ length: 12 }, (_, index) => {
      const month = addMonths(start, index);
      const monthKey = format(month, "yyyy-MM");
      const monthRows = rows.filter((booking) => toDateKey(booking.booking_date).startsWith(monthKey));

      return {
        label: format(month, "MMM"),
        revenue: monthRows.reduce((sum, booking) => sum + toAmount(booking.total_amount), 0),
        bookings: monthRows.length,
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = startOfMonth(parseDateKey(selectedRange.start));
    const bucketStart = addDays(monthStart, index * 5);
    const bucketEnd = index === 5 ? endOfMonth(monthStart) : addDays(bucketStart, 4);
    const bucketStartKey = toDateKey(bucketStart);
    const bucketEndKey = toDateKey(bucketEnd);
    const bucketRows = rows.filter((booking) => {
      const bookingDate = toDateKey(booking.booking_date);
      return bookingDate >= bucketStartKey && bookingDate <= bucketEndKey;
    });

    return {
      label: `${format(bucketStart, "MMM d")}${index === 5 ? "+" : ""}`,
      revenue: bucketRows.reduce((sum, booking) => sum + toAmount(booking.total_amount), 0),
      bookings: bucketRows.length,
    };
  });
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} className="text-muted-foreground">
          <span className="font-medium text-foreground">{entry.name}: </span>
          {entry.dataKey === "revenue" ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

const getReportPeriodLabel = (period) => {
  if (period === "Annually") return "Annual";
  return period;
};

const getTourTypeLabel = (type) => {
  if (type === "day_tour") return "Day Tour";
  if (type === "night_tour") return "Night Tour";
  if (type === "22_hours") return "22 Hours";
  return type || "-";
};

const getPeriodOptions = (period) => {
  const now = new Date();
  const builders = {
    Weekly: (offset) => {
      const target = subWeeks(now, offset);
      return {
        start: startOfWeek(target, { weekStartsOn: 1 }),
        end: endOfWeek(target, { weekStartsOn: 1 }),
      };
    },
    Monthly: (offset) => {
      const target = subMonths(now, offset);
      return {
        start: startOfMonth(target),
        end: endOfMonth(target),
      };
    },
    Annually: (offset) => {
      const target = subYears(now, offset);
      return {
        start: startOfYear(target),
        end: endOfYear(target),
      };
    },
  };

  return [0, 1, 2, 3].map((offset) => {
    const range = builders[period](offset);
    return {
      label:
        period === "Annually"
          ? format(range.start, "yyyy")
          : `${format(range.start, "MMM d, yyyy")} - ${format(range.end, "MMM d, yyyy")}`,
      start: toDateKey(range.start),
      end: toDateKey(range.end),
    };
  });
};

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const columnName = (index) => {
  let current = index;
  let name = "";

  while (current > 0) {
    const modulo = (current - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    current = Math.floor((current - modulo) / 26);
  }

  return name;
};

const cellRef = (column, row) => `${columnName(column)}${row}`;

const addCell = (rows, row, column, value, style = 0) => {
  if (!rows.has(row)) {
    rows.set(row, []);
  }

  rows.get(row).push({ column, value, style });
};

const buildCellXml = ({ column, row, value, style }) => {
  const reference = cellRef(column, row);
  const styleAttribute = style ? ` s="${style}"` : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t>${escapeXml(value)}</t></is></c>`;
};

const buildSheetXml = ({ rows, columns = [], drawingRelId }) => {
  const sortedRows = [...rows.entries()].sort((left, right) => left[0] - right[0]);
  const columnXml = columns.length
    ? `<cols>${columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${columnXml}
  <sheetData>
    ${sortedRows.map(([row, cells]) => (
      `<row r="${row}">${cells
        .sort((left, right) => left.column - right.column)
        .map((cell) => buildCellXml({ ...cell, row }))
        .join("")}</row>`
    )).join("")}
  </sheetData>
  ${drawingRelId ? `<drawing r:id="${drawingRelId}"/>` : ""}
</worksheet>`;
};

const buildContentTypesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
  <Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/charts/chart3.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const buildRootRelsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const buildWorkbookXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Dashboard" sheetId="1" r:id="rId1"/>
    <sheet name="Bookings" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;

const buildWorkbookRelsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const buildStylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="&quot;PHP&quot; #,##0"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Arial"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="12"/><color rgb="FF14532D"/><name val="Arial"/></font>
    <font><b/><sz val="14"/><color rgb="FF111827"/><name val="Arial"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF14532D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7F5EE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

const sheetReference = (sheetName, startCol, startRow, endCol, endRow) =>
  `'${sheetName}'!$${columnName(startCol)}$${startRow}:$${columnName(endCol)}$${endRow}`;

const buildLineChartXml = ({ title, categoryRef, revenueRef, bookingsRef }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Revenue</c:v></c:tx><c:cat><c:strRef><c:f>${categoryRef}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${revenueRef}</c:f></c:numRef></c:val></c:ser>
        <c:ser><c:idx val="1"/><c:order val="1"/><c:tx><c:v>Bookings</c:v></c:tx><c:cat><c:strRef><c:f>${categoryRef}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${bookingsRef}</c:f></c:numRef></c:val></c:ser>
        <c:axId val="1001"/><c:axId val="1002"/>
      </c:lineChart>
      <c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="1002"/></c:catAx>
      <c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="1001"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;

const buildBarChartXml = ({ title, categoryRef, valueRef }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/><c:grouping val="clustered"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Revenue</c:v></c:tx><c:cat><c:strRef><c:f>${categoryRef}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${valueRef}</c:f></c:numRef></c:val></c:ser>
        <c:axId val="2001"/><c:axId val="2002"/>
      </c:barChart>
      <c:catAx><c:axId val="2001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="2002"/></c:catAx>
      <c:valAx><c:axId val="2002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="2001"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;

const buildPieChartXml = ({ title, categoryRef, valueRef }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Status</c:v></c:tx><c:cat><c:strRef><c:f>${categoryRef}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${valueRef}</c:f></c:numRef></c:val></c:ser>
      </c:pieChart>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;

const buildDrawingXml = () => {
  const anchors = [
    { id: 1, name: "Revenue Trend", rel: "rId1", fromCol: 4, fromRow: 8, toCol: 12, toRow: 23 },
    { id: 2, name: "Package Performance", rel: "rId2", fromCol: 4, fromRow: 25, toCol: 12, toRow: 40 },
    { id: 3, name: "Booking Status", rel: "rId3", fromCol: 4, fromRow: 42, toCol: 12, toRow: 57 },
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${anchors.map((anchor) => `
    <xdr:twoCellAnchor>
      <xdr:from><xdr:col>${anchor.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${anchor.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:graphicFrame macro="">
        <xdr:nvGraphicFramePr><xdr:cNvPr id="${anchor.id}" name="${escapeXml(anchor.name)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${anchor.rel}"/></a:graphicData></a:graphic>
      </xdr:graphicFrame>
      <xdr:clientData/>
    </xdr:twoCellAnchor>
  `).join("")}
</xdr:wsDr>`;
};

const buildDrawingRelsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart3.xml"/>
</Relationships>`;

const buildSheetDrawingRelsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

const buildCoreXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Kasa Ilaya Sales Report</dc:title>
  <dc:creator>Kasa Ilaya Resort</dc:creator>
  <cp:lastModifiedBy>Kasa Ilaya Resort</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;

const buildAppXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Kasa Ilaya Resort</Application>
</Properties>`;

let crcTable;
const getCrcTable = () => {
  if (crcTable) {
    return crcTable;
  }

  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  return crcTable;
};

const crc32 = (bytes) => {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value) => {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
};

const uint32 = (value) => {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value, true);
  return bytes;
};

const createZipBlob = (files) => {
  const encoder = new TextEncoder();
  const parts = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const localHeader = [
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(contentBytes.length),
      uint32(contentBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ];

    localHeader.forEach((part) => parts.push(part));
    parts.push(contentBytes);

    centralDirectory.push({
      nameBytes,
      crc,
      size: contentBytes.length,
      offset,
    });

    offset += localHeader.reduce((sum, part) => sum + part.length, 0) + contentBytes.length;
  });

  const centralOffset = offset;
  centralDirectory.forEach((entry) => {
    const header = [
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(entry.crc),
      uint32(entry.size),
      uint32(entry.size),
      uint16(entry.nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(entry.offset),
      entry.nameBytes,
    ];

    header.forEach((part) => parts.push(part));
    offset += header.reduce((sum, part) => sum + part.length, 0);
  });

  const centralSize = offset - centralOffset;
  [
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralSize),
    uint32(centralOffset),
    uint16(0),
  ].forEach((part) => parts.push(part));

  return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const downloadExcelReport = ({
  rows,
  period,
  selectedRange,
  packageFilter,
  generatedAt,
  totalRevenue,
  totalBookings,
  confirmed,
  pending,
  averageBooking,
  mostBookedPackage,
  timelineData,
  packageChartData,
  statusChartData,
}) => {
  const dashboardRows = new Map();
  const bookingsRows = new Map();
  const generatedDate = format(new Date(), "yyyy-MM-dd");

  addCell(dashboardRows, 1, 1, "Kasa Ilaya Resort - Modern Sales Report", 1);
  addCell(dashboardRows, 2, 1, `Period: ${period}`);
  addCell(dashboardRows, 2, 2, `Date Covered: ${selectedRange?.label || "All dates"}`);
  addCell(dashboardRows, 2, 3, `Package: ${packageFilter === "All" ? "All Packages" : packageFilter}`);
  addCell(dashboardRows, 2, 4, `Generated: ${generatedAt}`);

  [
    ["Total Revenue", totalRevenue, 6],
    ["Total Bookings", totalBookings, 7],
    ["Confirmed", confirmed, 7],
    ["Pending", pending, 7],
    ["Average Booking", averageBooking, 6],
    ["Top Package", mostBookedPackage.name, 5],
  ].forEach(([label, value, valueStyle], index) => {
    addCell(dashboardRows, 4, index + 1, label, 4);
    addCell(dashboardRows, 5, index + 1, value, valueStyle);
  });

  const timelineHeaderRow = 9;
  const timelineDataStart = timelineHeaderRow + 1;
  addCell(dashboardRows, 8, 1, "Revenue Trend Data", 3);
  ["Period", "Revenue", "Bookings"].forEach((label, index) => addCell(dashboardRows, timelineHeaderRow, index + 1, label, 2));
  timelineData.forEach((item, index) => {
    const row = timelineDataStart + index;
    addCell(dashboardRows, row, 1, item.label);
    addCell(dashboardRows, row, 2, item.revenue, 6);
    addCell(dashboardRows, row, 3, item.bookings, 7);
  });

  const packageHeaderRow = 27;
  const packageDataStart = packageHeaderRow + 1;
  addCell(dashboardRows, 26, 1, "Package Performance Data", 3);
  ["Package", "Revenue", "Bookings"].forEach((label, index) => addCell(dashboardRows, packageHeaderRow, index + 1, label, 2));
  packageChartData.forEach((item, index) => {
    const row = packageDataStart + index;
    addCell(dashboardRows, row, 1, item.name);
    addCell(dashboardRows, row, 2, item.revenue, 6);
    addCell(dashboardRows, row, 3, item.count, 7);
  });

  const statusHeaderRow = 44;
  const statusDataStart = statusHeaderRow + 1;
  addCell(dashboardRows, 43, 1, "Booking Status Data", 3);
  ["Status", "Count"].forEach((label, index) => addCell(dashboardRows, statusHeaderRow, index + 1, label, 2));
  statusChartData.forEach((item, index) => {
    const row = statusDataStart + index;
    addCell(dashboardRows, row, 1, item.name);
    addCell(dashboardRows, row, 2, item.value, 7);
  });

  ["Reference", "Customer", "Package", "Type", "Date", "Amount", "Status"].forEach((label, index) => {
    addCell(bookingsRows, 1, index + 1, label, 2);
  });
  rows.forEach((booking, index) => {
    const row = index + 2;
    addCell(bookingsRows, row, 1, booking.booking_reference || booking.id || "");
    addCell(bookingsRows, row, 2, booking.customer_name || "");
    addCell(bookingsRows, row, 3, booking.package_name || "");
    addCell(bookingsRows, row, 4, getTourTypeLabel(booking.tour_type));
    addCell(bookingsRows, row, 5, toDateKey(booking.booking_date));
    addCell(bookingsRows, row, 6, toAmount(booking.total_amount), 6);
    addCell(bookingsRows, row, 7, booking.status || "");
  });

  const timelineEnd = Math.max(timelineDataStart, timelineDataStart + timelineData.length - 1);
  const packageEnd = Math.max(packageDataStart, packageDataStart + packageChartData.length - 1);
  const statusEnd = Math.max(statusDataStart, statusDataStart + statusChartData.length - 1);
  const files = [
    { name: "[Content_Types].xml", content: buildContentTypesXml() },
    { name: "_rels/.rels", content: buildRootRelsXml() },
    { name: "docProps/core.xml", content: buildCoreXml() },
    { name: "docProps/app.xml", content: buildAppXml() },
    { name: "xl/workbook.xml", content: buildWorkbookXml() },
    { name: "xl/_rels/workbook.xml.rels", content: buildWorkbookRelsXml() },
    { name: "xl/styles.xml", content: buildStylesXml() },
    {
      name: "xl/worksheets/sheet1.xml",
      content: buildSheetXml({
        rows: dashboardRows,
        columns: [22, 16, 14, 26, 16, 18, 16, 16, 16, 16, 16, 16],
        drawingRelId: "rId1",
      }),
    },
    { name: "xl/worksheets/_rels/sheet1.xml.rels", content: buildSheetDrawingRelsXml() },
    {
      name: "xl/worksheets/sheet2.xml",
      content: buildSheetXml({
        rows: bookingsRows,
        columns: [24, 26, 26, 16, 14, 14, 16],
      }),
    },
    { name: "xl/drawings/drawing1.xml", content: buildDrawingXml() },
    { name: "xl/drawings/_rels/drawing1.xml.rels", content: buildDrawingRelsXml() },
    {
      name: "xl/charts/chart1.xml",
      content: buildLineChartXml({
        title: "Revenue Trend",
        categoryRef: sheetReference("Dashboard", 1, timelineDataStart, 1, timelineEnd),
        revenueRef: sheetReference("Dashboard", 2, timelineDataStart, 2, timelineEnd),
        bookingsRef: sheetReference("Dashboard", 3, timelineDataStart, 3, timelineEnd),
      }),
    },
    {
      name: "xl/charts/chart2.xml",
      content: buildBarChartXml({
        title: "Package Performance",
        categoryRef: sheetReference("Dashboard", 1, packageDataStart, 1, packageEnd),
        valueRef: sheetReference("Dashboard", 2, packageDataStart, 2, packageEnd),
      }),
    },
    {
      name: "xl/charts/chart3.xml",
      content: buildPieChartXml({
        title: "Booking Status",
        categoryRef: sheetReference("Dashboard", 1, statusDataStart, 1, statusEnd),
        valueRef: sheetReference("Dashboard", 2, statusDataStart, 2, statusEnd),
      }),
    },
  ];

  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kasa-ilaya-modern-sales-report-${generatedDate}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AdminReport() {
  const [period, setPeriod] = useState("Weekly");
  const [rangeIndex, setRangeIndex] = useState(0);
  const [packageFilter, setPackageFilter] = useState("All");
  const [bookings, setBookings] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dateRanges = useMemo(() => getPeriodOptions(period), [period]);
  const selectedRange = dateRanges[rangeIndex] || dateRanges[0];

  useEffect(() => {
    setRangeIndex(0);
  }, [period]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      baseClient.entities.Booking.list("-created_date", 1000),
      baseClient.entities.Package.list("name", 1000),
    ])
      .then(([bookingRows, packageRows]) => {
        if (!isMounted) return;
        setBookings(Array.isArray(bookingRows) ? bookingRows : []);
        setPackages(Array.isArray(packageRows) ? packageRows : []);
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || "Unable to load report data.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const bookingDate = toDateKey(booking.booking_date);
      const matchesDate = selectedRange && bookingDate >= selectedRange.start && bookingDate <= selectedRange.end;
      const matchesPackage = packageFilter === "All" || booking.package_name === packageFilter;
      return matchesDate && matchesPackage;
    });
  }, [bookings, packageFilter, selectedRange]);

  const totalRevenue = filteredBookings.reduce((sum, booking) => sum + toAmount(booking.total_amount), 0);
  const totalBookings = filteredBookings.length;
  const confirmed = filteredBookings.filter((booking) => booking.status === "confirmed").length;
  const pending = filteredBookings.filter((booking) => booking.status === "pending").length;
  const averageBooking = totalBookings ? totalRevenue / totalBookings : 0;
  const reportPeriodLabel = getReportPeriodLabel(period);
  const generatedAt = format(new Date(), "MMM d, yyyy h:mm a");

  const packageCounts = packages.map((pkg) => ({
    name: pkg.name,
    count: filteredBookings.filter((booking) => booking.package_name === pkg.name).length,
    revenue: filteredBookings
      .filter((booking) => booking.package_name === pkg.name)
      .reduce((sum, booking) => sum + toAmount(booking.total_amount), 0),
  }));
  const mostBookedPackage = packageCounts.reduce((best, item) => (item.count > best.count ? item : best), {
    name: "None",
    count: 0,
  });
  const timelineData = buildTimelineData(filteredBookings, period, selectedRange);
  const packageChartData = packageCounts
    .filter((item) => item.count > 0 || item.revenue > 0)
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 6);
  const statusChartData = ["confirmed", "pending", "completed", "cancelled"].map((status) => ({
    name: status.replace(/_/g, " "),
    value: filteredBookings.filter((booking) => booking.status === status).length,
  })).filter((item) => item.value > 0);

  return (
    <div className="report-print-area w-full max-w-none space-y-8 px-2 py-6 sm:px-3 lg:px-4">
      <div className="print-only report-print-header">
        <p className="report-print-kicker">Kasa Ilaya Resort</p>
        <h1>{reportPeriodLabel} Sales Report</h1>
        <div className="report-print-meta">
          <span>Period: {period}</span>
          <span>Date covered: {selectedRange?.label || "All dates"}</span>
          <span>Package: {packageFilter === "All" ? "All Packages" : packageFilter}</span>
          <span>Generated: {generatedAt}</span>
        </div>
      </div>

      <div className="report-screen-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Sales Reports</h1>
          <p className="mt-1 text-muted-foreground">View reservation revenue, booking volume, and package performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            className="gap-2"
            onClick={() => downloadExcelReport({
              rows: filteredBookings,
              period,
              selectedRange,
              packageFilter,
              generatedAt,
              totalRevenue,
              totalBookings,
              confirmed,
              pending,
              averageBooking,
              mostBookedPackage,
              timelineData,
              packageChartData,
              statusChartData,
            })}
            disabled={!filteredBookings.length}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="report-screen-filters flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-md border border-border bg-background p-1">
          {PERIODS.map((item) => (
            <Button
              key={item}
              type="button"
              variant={period === item ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rangeIndex}
            onChange={(event) => setRangeIndex(Number(event.target.value))}
          >
            {dateRanges.map((range, index) => (
              <option key={range.label} value={index}>
                {range.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={packageFilter}
            onChange={(event) => setPackageFilter(event.target.value)}
          >
            <option value="All">All Packages</option>
            {packages.map((pkg) => (
              <option key={pkg.id || pkg.name} value={pkg.name}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="report-print-summary grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-5 sm:p-6 sm:pt-6">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 sm:p-6 sm:pt-6">
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{totalBookings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 sm:p-6 sm:pt-6">
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{confirmed}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pending} pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 sm:p-6 sm:pt-6">
                <p className="text-sm text-muted-foreground">Average Booking</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(averageBooking)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Top package: {mostBookedPackage.name}</p>
              </CardContent>
            </Card>
          </div>

          <div className="report-screen-filters grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-xl">Revenue Trend</CardTitle>
                <p className="text-sm text-muted-foreground">Revenue and booking volume for the selected report period.</p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `P${Number(value) / 1000}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="bookings" name="Bookings" stroke="hsl(var(--secondary))" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-xl">Booking Status</CardTitle>
                <p className="text-sm text-muted-foreground">Current mix for this filtered report.</p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {statusChartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={104} paddingAngle={3}>
                          {statusChartData.map((entry, index) => (
                            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No status data to chart.</div>
                  )}
                </div>
                <div className="grid gap-2">
                  {statusChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 capitalize text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        {item.name}
                      </span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="report-screen-filters border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-xl">Package Performance</CardTitle>
              <p className="text-sm text-muted-foreground">Top packages by revenue within the selected filters.</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {packageChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={packageChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `P${Number(value) / 1000}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]}>
                        {packageChartData.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No package revenue to chart.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="report-print-table">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length ? (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="report-reference font-mono text-sm">{booking.booking_reference || booking.id}</TableCell>
                        <TableCell className="report-customer">{booking.customer_name || "-"}</TableCell>
                        <TableCell className="report-package">{booking.package_name || "-"}</TableCell>
                        <TableCell className="report-type">{getTourTypeLabel(booking.tour_type)}</TableCell>
                        <TableCell className="report-date">{toDateKey(booking.booking_date) || "-"}</TableCell>
                        <TableCell className="report-amount font-semibold">{formatCurrency(booking.total_amount)}</TableCell>
                        <TableCell className="report-status-cell">
                          <Badge className="report-status-badge" variant="outline">{booking.status || "unknown"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No bookings found for this report.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
