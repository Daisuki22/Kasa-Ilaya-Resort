import{aj as ve,c as he,r as N,b as ce,j as e,B as q,ak as fe}from"./index-DYILn70e.js";import{B as be}from"./badge-B_3mXynz.js";import{C as D,c as C,a as Z,b as J}from"./card-Dl7QUV-e.js";import{T as ke,a as je,b as Q,c as M,d as we,e as A}from"./table-BpkOamPw.js";import{L as Fe}from"./loader-circle-B7l-ZpbR.js";import{R as ee,T as te,C as ie,B as Ne}from"./generateCategoricalChart-C0W-d3j-.js";import{L as Ie,a as me}from"./LineChart-BnWHvTn6.js";import{C as de,X as pe,Y as re,B as Te}from"./BarChart-CxRoz3Vx.js";import{P as De,a as Ce}from"./PieChart-BtPMLhnD.js";import{a as Re,b as Pe,s as ue,e as Ae}from"./endOfWeek-DRfyPfYq.js";import{f as T,s as ge,a as $e}from"./format-C8lC30J-.js";import{a as ae}from"./addDays-COtSYi7E.js";import{a as Se}from"./addMonths-BiSfA7oH.js";import{s as Me}from"./subMonths-Tgm1qXF9.js";function _e(t){const r=ve(t),o=r.getFullYear();return r.setFullYear(o+1,0,0),r.setHours(23,59,59,999),r}function Be(t,r){return Re(t,-r)}function Ee(t,r){return Pe(t,-r)}/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oe=[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]],Xe=he("Download",Oe);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],Ke=he("Printer",Ue),Le=["Weekly","Monthly","Annually"],ze=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}),B=t=>Number(t||0),I=t=>{if(!t)return"";const r=new Date(t);return Number.isNaN(r.getTime())?String(t).slice(0,10):T(r,"yyyy-MM-dd")},Y=t=>ze.format(B(t)),U=["hsl(var(--primary))","hsl(var(--secondary))","hsl(var(--chart-3))","hsl(var(--chart-4))","hsl(var(--chart-5))","hsl(var(--muted-foreground))"],se=t=>new Date(`${t}T00:00:00`),We=(t,r,o)=>{if(!(o!=null&&o.start)||!(o!=null&&o.end))return[];if(r==="Weekly")return Array.from({length:7},(n,l)=>{const d=ae(se(o.start),l),h=I(d),i=t.filter(f=>I(f.booking_date)===h);return{label:T(d,"EEE"),revenue:i.reduce((f,u)=>f+B(u.total_amount),0),bookings:i.length}});if(r==="Annually"){const n=ge(se(o.start));return Array.from({length:12},(l,d)=>{const h=Se(n,d),i=T(h,"yyyy-MM"),f=t.filter(u=>I(u.booking_date).startsWith(i));return{label:T(h,"MMM"),revenue:f.reduce((u,k)=>u+B(k.total_amount),0),bookings:f.length}})}return Array.from({length:6},(n,l)=>{const d=ue(se(o.start)),h=ae(d,l*5),i=l===5?fe(d):ae(h,4),f=I(h),u=I(i),k=t.filter(w=>{const v=I(w.booking_date);return v>=f&&v<=u});return{label:`${T(h,"MMM d")}${l===5?"+":""}`,revenue:k.reduce((w,v)=>w+B(v.total_amount),0),bookings:k.length}})},oe=({active:t,payload:r,label:o})=>!t||!(r!=null&&r.length)?null:e.jsxs("div",{className:"rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg",children:[e.jsx("p",{className:"mb-1 font-medium text-foreground",children:o}),r.map(n=>e.jsxs("p",{className:"text-muted-foreground",children:[e.jsxs("span",{className:"font-medium text-foreground",children:[n.name,": "]}),n.dataKey==="revenue"?Y(n.value):n.value]},n.dataKey||n.name))]}),He=t=>t==="Annually"?"Annual":t,ye=t=>t==="day_tour"?"Day Tour":t==="night_tour"?"Night Tour":t==="22_hours"?"22 Hours":t||"-",Ge=t=>{const r=new Date,o={Weekly:n=>{const l=Be(r,n);return{start:$e(l,{weekStartsOn:1}),end:Ae(l,{weekStartsOn:1})}},Monthly:n=>{const l=Me(r,n);return{start:ue(l),end:fe(l)}},Annually:n=>{const l=Ee(r,n);return{start:ge(l),end:_e(l)}}};return[0,1,2,3].map(n=>{const l=o[t](n);return{label:t==="Annually"?T(l.start,"yyyy"):`${T(l.start,"MMM d, yyyy")} - ${T(l.end,"MMM d, yyyy")}`,start:I(l.start),end:I(l.end)}})},G=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"),ne=t=>{let r=t,o="";for(;r>0;){const n=(r-1)%26;o=String.fromCharCode(65+n)+o,r=Math.floor((r-n)/26)}return o},Ve=(t,r)=>`${ne(t)}${r}`,c=(t,r,o,n,l=0)=>{t.has(r)||t.set(r,[]),t.get(r).push({column:o,value:n,style:l})},Ye=({column:t,row:r,value:o,style:n})=>{const l=Ve(t,r),d=n?` s="${n}"`:"";return typeof o=="number"&&Number.isFinite(o)?`<c r="${l}"${d}><v>${o}</v></c>`:`<c r="${l}" t="inlineStr"${d}><is><t>${G(o)}</t></is></c>`},xe=({rows:t,columns:r=[],drawingRelId:o})=>{const n=[...t.entries()].sort((d,h)=>d[0]-h[0]);return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${r.length?`<cols>${r.map((d,h)=>`<col min="${h+1}" max="${h+1}" width="${d}" customWidth="1"/>`).join("")}</cols>`:""}
  <sheetData>
    ${n.map(([d,h])=>`<row r="${d}">${h.sort((i,f)=>i.column-f.column).map(i=>Ye({...i,row:d})).join("")}</row>`).join("")}
  </sheetData>
  ${o?`<drawing r:id="${o}"/>`:""}
</worksheet>`},qe=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</Types>`,Ze=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,Je=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Dashboard" sheetId="1" r:id="rId1"/>
    <sheet name="Bookings" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`,Qe=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,et=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</styleSheet>`,_=(t,r,o,n,l)=>`'${t}'!$${ne(r)}$${o}:$${ne(n)}$${l}`,tt=({title:t,categoryRef:r,revenueRef:o,bookingsRef:n})=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${G(t)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Revenue</c:v></c:tx><c:cat><c:strRef><c:f>${r}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${o}</c:f></c:numRef></c:val></c:ser>
        <c:ser><c:idx val="1"/><c:order val="1"/><c:tx><c:v>Bookings</c:v></c:tx><c:cat><c:strRef><c:f>${r}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${n}</c:f></c:numRef></c:val></c:ser>
        <c:axId val="1001"/><c:axId val="1002"/>
      </c:lineChart>
      <c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="1002"/></c:catAx>
      <c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="1001"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`,rt=({title:t,categoryRef:r,valueRef:o})=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${G(t)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/><c:grouping val="clustered"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Revenue</c:v></c:tx><c:cat><c:strRef><c:f>${r}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${o}</c:f></c:numRef></c:val></c:ser>
        <c:axId val="2001"/><c:axId val="2002"/>
      </c:barChart>
      <c:catAx><c:axId val="2001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="2002"/></c:catAx>
      <c:valAx><c:axId val="2002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="2001"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`,at=({title:t,categoryRef:r,valueRef:o})=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${G(t)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Status</c:v></c:tx><c:cat><c:strRef><c:f>${r}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${o}</c:f></c:numRef></c:val></c:ser>
      </c:pieChart>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`,st=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${[{id:1,name:"Revenue Trend",rel:"rId1",fromCol:4,fromRow:8,toCol:12,toRow:23},{id:2,name:"Package Performance",rel:"rId2",fromCol:4,fromRow:25,toCol:12,toRow:40},{id:3,name:"Booking Status",rel:"rId3",fromCol:4,fromRow:42,toCol:12,toRow:57}].map(r=>`
    <xdr:twoCellAnchor>
      <xdr:from><xdr:col>${r.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${r.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:graphicFrame macro="">
        <xdr:nvGraphicFramePr><xdr:cNvPr id="${r.id}" name="${G(r.name)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${r.rel}"/></a:graphicData></a:graphic>
      </xdr:graphicFrame>
      <xdr:clientData/>
    </xdr:twoCellAnchor>
  `).join("")}
</xdr:wsDr>`,ot=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart3.xml"/>
</Relationships>`,nt=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`,lt=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Kasa Ilaya Sales Report</dc:title>
  <dc:creator>Kasa Ilaya Resort</dc:creator>
  <cp:lastModifiedBy>Kasa Ilaya Resort</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`,ct=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Kasa Ilaya Resort</Application>
</Properties>`;let H;const it=()=>{if(H)return H;H=new Uint32Array(256);for(let t=0;t<256;t+=1){let r=t;for(let o=0;o<8;o+=1)r=r&1?3988292384^r>>>1:r>>>1;H[t]=r>>>0}return H},mt=t=>{const r=it();let o=4294967295;for(let n=0;n<t.length;n+=1)o=r[(o^t[n])&255]^o>>>8;return(o^4294967295)>>>0},x=t=>{const r=new Uint8Array(2);return new DataView(r.buffer).setUint16(0,t,!0),r},j=t=>{const r=new Uint8Array(4);return new DataView(r.buffer).setUint32(0,t,!0),r},dt=t=>{const r=new TextEncoder,o=[],n=[];let l=0;t.forEach(i=>{const f=r.encode(i.name),u=r.encode(i.content),k=mt(u),w=[j(67324752),x(20),x(2048),x(0),x(0),x(0),j(k),j(u.length),j(u.length),x(f.length),x(0),f];w.forEach(v=>o.push(v)),o.push(u),n.push({nameBytes:f,crc:k,size:u.length,offset:l}),l+=w.reduce((v,$)=>v+$.length,0)+u.length});const d=l;n.forEach(i=>{const f=[j(33639248),x(20),x(20),x(2048),x(0),x(0),x(0),j(i.crc),j(i.size),j(i.size),x(i.nameBytes.length),x(0),x(0),x(0),x(0),j(0),j(i.offset),i.nameBytes];f.forEach(u=>o.push(u)),l+=f.reduce((u,k)=>u+k.length,0)});const h=l-d;return[j(101010256),x(0),x(0),x(t.length),x(t.length),j(h),j(d),x(0)].forEach(i=>o.push(i)),new Blob(o,{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})},pt=({rows:t,period:r,selectedRange:o,packageFilter:n,generatedAt:l,totalRevenue:d,totalBookings:h,confirmed:i,pending:f,averageBooking:u,mostBookedPackage:k,timelineData:w,packageChartData:v,statusChartData:$})=>{const m=new Map,y=new Map,b=T(new Date,"yyyy-MM-dd");c(m,1,1,"Kasa Ilaya Resort - Modern Sales Report",1),c(m,2,1,`Period: ${r}`),c(m,2,2,`Date Covered: ${(o==null?void 0:o.label)||"All dates"}`),c(m,2,3,`Package: ${n==="All"?"All Packages":n}`),c(m,2,4,`Generated: ${l}`),[["Total Revenue",d,6],["Total Bookings",h,7],["Confirmed",i,7],["Pending",f,7],["Average Booking",u,6],["Top Package",k.name,5]].forEach(([s,p,g],le)=>{c(m,4,le+1,s,4),c(m,5,le+1,p,g)});const E=9,F=E+1;c(m,8,1,"Revenue Trend Data",3),["Period","Revenue","Bookings"].forEach((s,p)=>c(m,E,p+1,s,2)),w.forEach((s,p)=>{const g=F+p;c(m,g,1,s.label),c(m,g,2,s.revenue,6),c(m,g,3,s.bookings,7)});const K=27,R=K+1;c(m,26,1,"Package Performance Data",3),["Package","Revenue","Bookings"].forEach((s,p)=>c(m,K,p+1,s,2)),v.forEach((s,p)=>{const g=R+p;c(m,g,1,s.name),c(m,g,2,s.revenue,6),c(m,g,3,s.count,7)});const L=44,S=L+1;c(m,43,1,"Booking Status Data",3),["Status","Count"].forEach((s,p)=>c(m,L,p+1,s,2)),$.forEach((s,p)=>{const g=S+p;c(m,g,1,s.name),c(m,g,2,s.value,7)}),["Reference","Customer","Package","Type","Date","Amount","Status"].forEach((s,p)=>{c(y,1,p+1,s,2)}),t.forEach((s,p)=>{const g=p+2;c(y,g,1,s.booking_reference||s.id||""),c(y,g,2,s.customer_name||""),c(y,g,3,s.package_name||""),c(y,g,4,ye(s.tour_type)),c(y,g,5,I(s.booking_date)),c(y,g,6,B(s.total_amount),6),c(y,g,7,s.status||"")});const O=Math.max(F,F+w.length-1),z=Math.max(R,R+v.length-1),W=Math.max(S,S+$.length-1),V=[{name:"[Content_Types].xml",content:qe()},{name:"_rels/.rels",content:Ze()},{name:"docProps/core.xml",content:lt()},{name:"docProps/app.xml",content:ct()},{name:"xl/workbook.xml",content:Je()},{name:"xl/_rels/workbook.xml.rels",content:Qe()},{name:"xl/styles.xml",content:et()},{name:"xl/worksheets/sheet1.xml",content:xe({rows:m,columns:[22,16,14,26,16,18,16,16,16,16,16,16],drawingRelId:"rId1"})},{name:"xl/worksheets/_rels/sheet1.xml.rels",content:nt()},{name:"xl/worksheets/sheet2.xml",content:xe({rows:y,columns:[24,26,26,16,14,14,16]})},{name:"xl/drawings/drawing1.xml",content:st()},{name:"xl/drawings/_rels/drawing1.xml.rels",content:ot()},{name:"xl/charts/chart1.xml",content:tt({title:"Revenue Trend",categoryRef:_("Dashboard",1,F,1,O),revenueRef:_("Dashboard",2,F,2,O),bookingsRef:_("Dashboard",3,F,3,O)})},{name:"xl/charts/chart2.xml",content:rt({title:"Package Performance",categoryRef:_("Dashboard",1,R,1,z),valueRef:_("Dashboard",2,R,2,z)})},{name:"xl/charts/chart3.xml",content:at({title:"Booking Status",categoryRef:_("Dashboard",1,S,1,W),valueRef:_("Dashboard",2,S,2,W)})}],X=dt(V),P=URL.createObjectURL(X),a=document.createElement("a");a.href=P,a.download=`kasa-ilaya-modern-sales-report-${b}.xlsx`,a.click(),URL.revokeObjectURL(P)};function xt(){const[t,r]=N.useState("Weekly"),[o,n]=N.useState(0),[l,d]=N.useState("All"),[h,i]=N.useState([]),[f,u]=N.useState([]),[k,w]=N.useState(!0),[v,$]=N.useState(null),m=N.useMemo(()=>Ge(t),[t]),y=m[o]||m[0];N.useEffect(()=>{n(0)},[t]),N.useEffect(()=>{let a=!0;return w(!0),$(null),Promise.all([ce.entities.Booking.list("-created_date",1e3),ce.entities.Package.list("name",1e3)]).then(([s,p])=>{a&&(i(Array.isArray(s)?s:[]),u(Array.isArray(p)?p:[]))}).catch(s=>{a&&$((s==null?void 0:s.message)||"Unable to load report data.")}).finally(()=>{a&&w(!1)}),()=>{a=!1}},[]);const b=N.useMemo(()=>h.filter(a=>{const s=I(a.booking_date),p=y&&s>=y.start&&s<=y.end,g=l==="All"||a.package_name===l;return p&&g}),[h,l,y]),E=b.reduce((a,s)=>a+B(s.total_amount),0),F=b.length,K=b.filter(a=>a.status==="confirmed").length,R=b.filter(a=>a.status==="pending").length,L=F?E/F:0,S=He(t),O=T(new Date,"MMM d, yyyy h:mm a"),z=f.map(a=>({name:a.name,count:b.filter(s=>s.package_name===a.name).length,revenue:b.filter(s=>s.package_name===a.name).reduce((s,p)=>s+B(p.total_amount),0)})),W=z.reduce((a,s)=>s.count>a.count?s:a,{name:"None",count:0}),V=We(b,t,y),X=z.filter(a=>a.count>0||a.revenue>0).sort((a,s)=>s.revenue-a.revenue).slice(0,6),P=["confirmed","pending","completed","cancelled"].map(a=>({name:a.replace(/_/g," "),value:b.filter(s=>s.status===a).length})).filter(a=>a.value>0);return e.jsxs("div",{className:"report-print-area w-full max-w-none space-y-8 px-2 py-6 sm:px-3 lg:px-4",children:[e.jsxs("div",{className:"print-only report-print-header",children:[e.jsx("p",{className:"report-print-kicker",children:"Kasa Ilaya Resort"}),e.jsxs("h1",{children:[S," Sales Report"]}),e.jsxs("div",{className:"report-print-meta",children:[e.jsxs("span",{children:["Period: ",t]}),e.jsxs("span",{children:["Date covered: ",(y==null?void 0:y.label)||"All dates"]}),e.jsxs("span",{children:["Package: ",l==="All"?"All Packages":l]}),e.jsxs("span",{children:["Generated: ",O]})]})]}),e.jsxs("div",{className:"report-screen-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"font-display text-3xl font-bold text-foreground",children:"Sales Reports"}),e.jsx("p",{className:"mt-1 text-muted-foreground",children:"View reservation revenue, booking volume, and package performance."})]}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs(q,{variant:"outline",className:"gap-2",onClick:()=>window.print(),children:[e.jsx(Ke,{className:"h-4 w-4"}),"Print"]}),e.jsxs(q,{className:"gap-2",onClick:()=>pt({rows:b,period:t,selectedRange:y,packageFilter:l,generatedAt:O,totalRevenue:E,totalBookings:F,confirmed:K,pending:R,averageBooking:L,mostBookedPackage:W,timelineData:V,packageChartData:X,statusChartData:P}),disabled:!b.length,children:[e.jsx(Xe,{className:"h-4 w-4"}),"Export Excel"]})]})]}),e.jsxs("div",{className:"report-screen-filters flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",children:[e.jsx("div",{className:"inline-flex rounded-md border border-border bg-background p-1",children:Le.map(a=>e.jsx(q,{type:"button",variant:t===a?"default":"ghost",size:"sm",onClick:()=>r(a),children:a},a))}),e.jsxs("div",{className:"flex flex-col gap-3 sm:flex-row",children:[e.jsx("select",{className:"h-10 rounded-md border border-input bg-background px-3 text-sm",value:o,onChange:a=>n(Number(a.target.value)),children:m.map((a,s)=>e.jsx("option",{value:s,children:a.label},a.label))}),e.jsxs("select",{className:"h-10 rounded-md border border-input bg-background px-3 text-sm",value:l,onChange:a=>d(a.target.value),children:[e.jsx("option",{value:"All",children:"All Packages"}),f.map(a=>e.jsx("option",{value:a.name,children:a.name},a.id||a.name))]})]})]}),k?e.jsx("div",{className:"flex justify-center py-20",children:e.jsx(Fe,{className:"h-8 w-8 animate-spin text-primary"})}):v?e.jsx(D,{children:e.jsx(C,{className:"p-6 text-sm text-destructive",children:v})}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"report-print-summary grid gap-4 md:grid-cols-2 xl:grid-cols-4",children:[e.jsx(D,{children:e.jsxs(C,{className:"p-5 sm:p-6 sm:pt-6",children:[e.jsx("p",{className:"text-sm text-muted-foreground",children:"Total Revenue"}),e.jsx("p",{className:"mt-2 text-2xl font-bold text-foreground",children:Y(E)})]})}),e.jsx(D,{children:e.jsxs(C,{className:"p-5 sm:p-6 sm:pt-6",children:[e.jsx("p",{className:"text-sm text-muted-foreground",children:"Total Bookings"}),e.jsx("p",{className:"mt-2 text-2xl font-bold text-foreground",children:F})]})}),e.jsx(D,{children:e.jsxs(C,{className:"p-5 sm:p-6 sm:pt-6",children:[e.jsx("p",{className:"text-sm text-muted-foreground",children:"Confirmed"}),e.jsx("p",{className:"mt-2 text-2xl font-bold text-foreground",children:K}),e.jsxs("p",{className:"mt-1 text-xs text-muted-foreground",children:[R," pending"]})]})}),e.jsx(D,{children:e.jsxs(C,{className:"p-5 sm:p-6 sm:pt-6",children:[e.jsx("p",{className:"text-sm text-muted-foreground",children:"Average Booking"}),e.jsx("p",{className:"mt-2 text-2xl font-bold text-foreground",children:Y(L)}),e.jsxs("p",{className:"mt-1 text-xs text-muted-foreground",children:["Top package: ",W.name]})]})})]}),e.jsxs("div",{className:"report-screen-filters grid gap-4 xl:grid-cols-[1.35fr_0.85fr]",children:[e.jsxs(D,{className:"border-border/80 shadow-sm",children:[e.jsxs(Z,{className:"pb-3",children:[e.jsx(J,{className:"font-display text-xl",children:"Revenue Trend"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Revenue and booking volume for the selected report period."})]}),e.jsx(C,{children:e.jsx("div",{className:"h-80",children:e.jsx(ee,{width:"100%",height:"100%",children:e.jsxs(Ie,{data:V,margin:{top:10,right:16,left:0,bottom:0},children:[e.jsx(de,{stroke:"hsl(var(--border))",strokeDasharray:"3 3"}),e.jsx(pe,{dataKey:"label",tick:{fontSize:12},stroke:"hsl(var(--muted-foreground))"}),e.jsx(re,{yAxisId:"left",tick:{fontSize:12},stroke:"hsl(var(--muted-foreground))",tickFormatter:a=>`P${Number(a)/1e3}k`}),e.jsx(re,{yAxisId:"right",orientation:"right",tick:{fontSize:12},stroke:"hsl(var(--muted-foreground))",allowDecimals:!1}),e.jsx(te,{content:e.jsx(oe,{})}),e.jsx(me,{yAxisId:"left",type:"monotone",dataKey:"revenue",name:"Revenue",stroke:"hsl(var(--primary))",strokeWidth:3,dot:{r:3}}),e.jsx(me,{yAxisId:"right",type:"monotone",dataKey:"bookings",name:"Bookings",stroke:"hsl(var(--secondary))",strokeWidth:3,dot:{r:3}})]})})})})]}),e.jsxs(D,{className:"border-border/80 shadow-sm",children:[e.jsxs(Z,{className:"pb-3",children:[e.jsx(J,{className:"font-display text-xl",children:"Booking Status"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Current mix for this filtered report."})]}),e.jsxs(C,{children:[e.jsx("div",{className:"h-80",children:P.length?e.jsx(ee,{width:"100%",height:"100%",children:e.jsxs(De,{children:[e.jsx(Ce,{data:P,dataKey:"value",nameKey:"name",innerRadius:64,outerRadius:104,paddingAngle:3,children:P.map((a,s)=>e.jsx(ie,{fill:U[s%U.length]},a.name))}),e.jsx(te,{content:e.jsx(oe,{})})]})}):e.jsx("div",{className:"flex h-full items-center justify-center text-sm text-muted-foreground",children:"No status data to chart."})}),e.jsx("div",{className:"grid gap-2",children:P.map((a,s)=>e.jsxs("div",{className:"flex items-center justify-between text-sm",children:[e.jsxs("span",{className:"flex items-center gap-2 capitalize text-muted-foreground",children:[e.jsx("span",{className:"h-2.5 w-2.5 rounded-full",style:{backgroundColor:U[s%U.length]}}),a.name]}),e.jsx("span",{className:"font-semibold text-foreground",children:a.value})]},a.name))})]})]})]}),e.jsxs(D,{className:"report-screen-filters border-border/80 shadow-sm",children:[e.jsxs(Z,{className:"pb-3",children:[e.jsx(J,{className:"font-display text-xl",children:"Package Performance"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Top packages by revenue within the selected filters."})]}),e.jsx(C,{children:e.jsx("div",{className:"h-80",children:X.length?e.jsx(ee,{width:"100%",height:"100%",children:e.jsxs(Te,{data:X,margin:{top:10,right:16,left:0,bottom:0},children:[e.jsx(de,{stroke:"hsl(var(--border))",strokeDasharray:"3 3"}),e.jsx(pe,{dataKey:"name",tick:{fontSize:12},stroke:"hsl(var(--muted-foreground))",interval:0}),e.jsx(re,{tick:{fontSize:12},stroke:"hsl(var(--muted-foreground))",tickFormatter:a=>`P${Number(a)/1e3}k`}),e.jsx(te,{content:e.jsx(oe,{})}),e.jsx(Ne,{dataKey:"revenue",name:"Revenue",radius:[6,6,0,0],children:X.map((a,s)=>e.jsx(ie,{fill:U[s%U.length]},a.name))})]})}):e.jsx("div",{className:"flex h-full items-center justify-center text-sm text-muted-foreground",children:"No package revenue to chart."})})})]}),e.jsx(D,{className:"report-print-table",children:e.jsx(C,{className:"overflow-x-auto p-0",children:e.jsxs(ke,{children:[e.jsx(je,{children:e.jsxs(Q,{children:[e.jsx(M,{children:"Reference"}),e.jsx(M,{children:"Customer"}),e.jsx(M,{children:"Package"}),e.jsx(M,{children:"Type"}),e.jsx(M,{children:"Date"}),e.jsx(M,{children:"Amount"}),e.jsx(M,{children:"Status"})]})}),e.jsx(we,{children:b.length?b.map(a=>e.jsxs(Q,{children:[e.jsx(A,{className:"report-reference font-mono text-sm",children:a.booking_reference||a.id}),e.jsx(A,{className:"report-customer",children:a.customer_name||"-"}),e.jsx(A,{className:"report-package",children:a.package_name||"-"}),e.jsx(A,{className:"report-type",children:ye(a.tour_type)}),e.jsx(A,{className:"report-date",children:I(a.booking_date)||"-"}),e.jsx(A,{className:"report-amount font-semibold",children:Y(a.total_amount)}),e.jsx(A,{className:"report-status-cell",children:e.jsx(be,{className:"report-status-badge",variant:"outline",children:a.status||"unknown"})})]},a.id)):e.jsx(Q,{children:e.jsx(A,{colSpan:7,className:"py-10 text-center text-sm text-muted-foreground",children:"No bookings found for this report."})})})]})})})]})]})}const Dt=()=>e.jsx(xt,{});export{Dt as default};
