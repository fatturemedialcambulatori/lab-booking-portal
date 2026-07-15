import { displayRefValueAny, isOutOfRangeAny, type StructuredRefRange } from "./refValue";
import { FIRMA_BASE64 } from "./firma-base64";
import { parseFiscalCode } from "./fiscalCode";

export type PrintExam = {
  codiceAnalisi: string;
  descrizione: string;
  colorProvetta?: string | null;
  synlab?: boolean | null;
  um?: string | null;
  metodo?: string | null;
  regola?: string | null;
  importo?: string | null;
  valoreRiferimento?: string | null;
  preparationInstructions?: string;
};

export type PrintExamSubResult = {
  codiceAnalisi: string;
  descrizione: string;
  um?: string | null;
  metodo?: string | null;
  valoreRiferimento?: string | null;
  referenceRanges?: StructuredRefRange[] | null;
  valore?: string | null;
  refertaNote?: string | null;
};

export type PrintExamWithResult = PrintExam & {
  valore?: string | null;
  refertaNote?: string | null;
  tipo?: string;
  referenceRanges?: StructuredRefRange[] | null;
  subResults?: PrintExamSubResult[];
};

export type PrintPatient = {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  codiceFiscale?: string;
  gender?: string;
  email?: string;
  phone?: string;
  notes?: string | null;
  billingAddress?: string | null;
  billingCap?: string | null;
  billingCity?: string | null;
  billingProvincia?: string | null;
};

export type PrintLegalClient = {
  nome: string;
  codiceFiscale?: string | null;
  indirizzo?: string | null;
  telefono?: string | null;
  email?: string | null;
  birthPlace?: string | null;
  dateOfBirth?: string | null;
  gender?: "M" | "F" | null;
};

const LAB_INFO = {
  name: "MEDICAL POLIAMBULATORI S.R.L.",
  piva: "04233570367",
  cf: "04233570367",
  vat: "IT04233570367",
  address: "STRADA VIGNOLESE 1164 - 41126 - MODENA (MO)",
  rea: "454032",
  pec: "medicalpoliambulatorisrl@sicurezzapostale.it",
};

function publicAssetUrl(fileName: string): string {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${window.location.origin}${baseUrl}${fileName}`;
}

function logoUrl(): string {
  return publicAssetUrl("logo-lab.png");
}

function legalLogoUrl(): string {
  return publicAssetUrl("procura-logo-studio-legale.jpeg");
}

function legalSignatureUrl(): string {
  return publicAssetUrl("procura-firma-avvocato.png");
}

function todayFormatted(): string {
  return new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatItalianDate(value?: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function legalField(value: string | null | undefined, widthMm: number): string {
  const clean = value?.trim();
  if (clean) return `<span class="filled">${escapeHtml(clean)}</span>`;
  return `<span class="blank" style="min-width:${widthMm}mm">&nbsp;</span>`;
}

function printWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { color-scheme: light; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff !important; padding: 24px 32px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 18px; background: #fff; }
  .logo { height: 64px; max-width: 220px; object-fit: contain; background: #fff; display: block; }
  .lab-info { text-align: right; font-size: 9.5px; line-height: 1.55; color: #333; }
  .lab-info strong { display: block; font-size: 11px; color: #1a1a1a; margin-bottom: 2px; }
  .doc-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #1a1a1a; letter-spacing: -0.3px; }
  .meta { font-size: 9.5px; color: #555; margin-bottom: 18px; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; margin-bottom: 6px; margin-top: 18px; }
  .patient-box { border: 1px solid #ddd; border-radius: 4px; padding: 10px 14px; margin-bottom: 20px; }
  .patient-box .row { display: flex; gap: 24px; line-height: 1.7; }
  .patient-box .row span { color: #555; }
  .patient-box .row strong { color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #f5f5f5; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 8px; text-align: left; border: 1px solid #ddd; }
  td { padding: 6px 8px; border: 1px solid #e8e8e8; vertical-align: top; font-size: 10.5px; line-height: 1.4; }
  tr:nth-child(even) td { background: #fafafa; }
  .price-col { text-align: right; white-space: nowrap; }
  .total-row td { font-weight: 700; background: #f0f0f0 !important; border-top: 2px solid #1a1a1a; }
  .total-label { text-align: right; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; white-space: nowrap; }
  .provetta { font-weight: 600; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #888; text-align: center; }
  @media print {
    body { padding: 0; }
    @page { margin: 12mm 14mm; size: A4; }
  }
`;

export function printProcuraAlleLiti(client: PrintLegalClient) {
  const fiscalInfo = parseFiscalCode(client.codiceFiscale ?? "");
  const gender = client.gender ?? fiscalInfo?.gender ?? null;
  const dateOfBirth = client.dateOfBirth ?? fiscalInfo?.dateOfBirth ?? "";
  const article = gender === "F" ? "La" : gender === "M" ? "Il" : "Il/la";
  const signed = gender === "F" ? "sottoscritta" : gender === "M" ? "sottoscritto" : "sottoscritto/a";
  const born = gender === "F" ? "nata" : gender === "M" ? "nato" : "nato/a";
  const informed = gender === "F" ? "informata" : gender === "M" ? "informato" : "informato/a";
  const signatureLabel = gender === "F" ? "Sig.ra" : gender === "M" ? "Sig." : "Sig./Sig.ra";
  const titleName = client.nome.trim() || "cliente";

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
    <title>Procura alle liti - ${escapeHtml(titleName)}</title>
    <style>
      * { box-sizing: border-box; }
      html { color-scheme: light; }
      body {
        margin: 0;
        background: #fff !important;
        color: #111;
        font-family: "Times New Roman", Times, serif;
        font-size: 10.5pt;
        line-height: 1.28;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        width: 190mm;
        min-height: 267mm;
        margin: 0 auto;
        padding: 0;
      }
      .legal-logo {
        display: block;
        width: 45mm;
        height: auto;
        margin: 0 auto 7mm;
      }
      h1 {
        margin: 0 0 6mm;
        text-align: center;
        font-size: 11pt;
        line-height: 1.2;
        font-weight: 700;
        letter-spacing: 0;
      }
      p {
        margin: 0 0 4.2mm;
        text-align: justify;
      }
      .center {
        text-align: center;
        font-weight: 700;
      }
      .filled {
        font-weight: 700;
      }
      .blank {
        display: inline-block;
        border-bottom: 1px solid #111;
        height: 1em;
        transform: translateY(0.12em);
      }
      .date-row {
        margin-top: 7mm;
      }
      .client-signature {
        width: 65mm;
        margin: 5mm 0 0 auto;
        text-align: center;
        font-weight: 700;
      }
      .client-line {
        display: block;
        border-bottom: 1px solid #111;
        height: 10mm;
        margin-top: 2mm;
      }
      .lawyer-auth {
        margin-top: 4mm;
        width: 72mm;
        margin-left: auto;
        text-align: left;
      }
      .lawyer-signature {
        width: 52mm;
        height: auto;
        display: block;
        margin: -3mm 0 -2mm 8mm;
      }
      @page {
        size: A4;
        margin: 15mm 14mm 12mm;
      }
      @media print {
        body { margin: 0; }
        .page { width: auto; min-height: auto; }
      }
    </style>
  </head><body>
    <main class="page">
      <img src="${legalLogoUrl()}" alt="Studio legale" class="legal-logo" />
      <h1>PROCURA ALLE LITI</h1>

      <p>
        ${article} ${signed} ${legalField(client.nome, 54)} ${born} a ${legalField(client.birthPlace, 28)}
        il ${legalField(formatItalianDate(dateOfBirth), 29)}, C.F. ${legalField(client.codiceFiscale, 42)}
        e residente in ${legalField(client.indirizzo, 82)}, ${informed} ai sensi dell'art. 4, comma 3, del d.
        lgs. n. 28/2010 della possibilita di ricorrere al procedimento di mediazione ivi previsto e dei benefici
        fiscali di cui agli artt. 17 e 20 delle stesso decreto, nonche ${informed} della possibilita di avvalersi
        del procedimento di negoziazione assistita di cui al D. L. 132/14, convertito in L. n. 162/14
      </p>

      <p class="center">conferisce procura</p>

      <p>
        all'avv. Maria Carmela Mangiardi del foro di Catanzaro, con studio in Brognaturo, via Mulinello, n. 41
        C.F. MNGMCR80R60C352D, Pec mariacarmela.mangiardi@avvocaticatanzaro.legalmail.it al fine di proporre
        richiesta di risarcimento danni. All'uopo si dichiara di eleggere domicilio presso l'avv. Maria Carmela
        Mangiardi, con studio in Brognaturo (VV), via Mulinello n. 41.
      </p>

      <p>
        La presente delega e efficace, altresi, per eventuali fasi successive di merito, ivi compreso l'appello,
        l'opposizione, il precetto e l'esecuzione. All'avv. <strong>Maria Carmela Mangiardi</strong> conferisce,
        inoltre, tutte le facolta previste dall'art. 84 c.p.c., nonche quelle di desistere, conciliare,
        transigere, rinunciare, ed accettare rinunzie, incassare e quietanzare, proporre domande e/o eccezioni
        riconvenzionali, chiamare terzi in causa, farli sostituire, modificare domicilio.
      </p>

      <p>
        Si dichiara di avere avuto conoscenza dell'informazione sui diritti previsti negli artt. 7 e ss. del
        D. Lgs. N. 196/2003 e mod.ni aventi ad oggetto la tutela del trattamento dei propri dati personali ed
        acconsentono al loro trattamento al fine dello svolgimento dell'attivita professionale, esprimendo altresi
        il consenso al trattamento dei dati sensibili, ex art. 22 della L. 675/96 e successive modifiche.
      </p>

      <p class="date-row">Modena, li ${legalField(todayFormatted(), 32)}</p>

      <div class="client-signature">
        ${signatureLabel}
        <span class="client-line"></span>
      </div>

      <div class="lawyer-auth">
        <img src="${legalSignatureUrl()}" alt="Firma avvocato" class="lawyer-signature" />
        <div>E' vera la firma</div>
        <strong>avv. M. Carmela Mangiardi</strong>
      </div>
    </main>
  </body></html>`;

  printWindow(html);
}

function provettaColor(color: string | null | undefined): string {
  if (!color) return "";
  const map: Record<string, string> = {
    rosso: "#d32f2f", viola: "#7b1fa2", verde: "#388e3c", giallo: "#f9a825",
    blu: "#1565c0", arancio: "#e65100", grigio: "#757575", bianco: "#aaa",
  };
  const key = color.toLowerCase().trim();
  const bg = Object.entries(map).find(([k]) => key.includes(k))?.[1] ?? "#999";
  return `<span class="badge" style="background:${bg};color:#fff;">${color}</span>`;
}

export function printPreventivo(patient: PrintPatient, exams: PrintExam[]) {
  const total = exams.reduce((s, e) => s + (e.importo ? Number(e.importo) : 0), 0);

  const billingLines = [
    patient.billingAddress,
    [patient.billingCap, patient.billingCity, patient.billingProvincia ? `(${patient.billingProvincia})` : ""].filter(Boolean).join(" "),
  ].filter(Boolean);

  const patientBlock = `
    <div class="section-title">Intestato a</div>
    <div class="patient-box">
      <div class="row">
        <div><span>Nome: </span><strong>${patient.firstName} ${patient.lastName}</strong></div>
        ${patient.dateOfBirth ? `<div><span>Data di nascita: </span><strong>${patient.dateOfBirth}</strong></div>` : ""}
        ${patient.codiceFiscale ? `<div><span>C.F.: </span><strong>${patient.codiceFiscale}</strong></div>` : ""}
        ${patient.gender ? `<div><span>Sesso: </span><strong>${patient.gender === "M" ? "Maschio" : "Femmina"}</strong></div>` : ""}
      </div>
      ${patient.email ? `<div style="margin-top:3px"><span>Email: </span><strong>${patient.email}</strong></div>` : ""}
      ${patient.phone ? `<div style="margin-top:3px"><span>Telefono: </span><strong>${patient.phone}</strong></div>` : ""}
      ${billingLines.length ? `<div style="margin-top:3px"><span>Indirizzo fatturazione: </span><strong>${billingLines.join(", ")}</strong></div>` : ""}
      ${patient.notes ? `<div style="margin-top:3px"><span>Note: </span><strong>${patient.notes}</strong></div>` : ""}
    </div>
  `;

  const rows = exams.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600">${e.codiceAnalisi}</td>
      <td>${e.descrizione}</td>
      <td class="price-col">${e.importo ? `€ ${Number(e.importo).toFixed(2)}` : "—"}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Preventivo – ${patient.firstName} ${patient.lastName}</title><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <img src="${logoUrl()}" alt="Logo" class="logo" />
      <div class="lab-info">
        <strong>${LAB_INFO.name}</strong>
        P.IVA: ${LAB_INFO.piva} &nbsp;|&nbsp; C.F.: ${LAB_INFO.cf}<br>
        VAT EU: ${LAB_INFO.vat}<br>
        ${LAB_INFO.address}<br>
        REA: ${LAB_INFO.rea}<br>
        PEC: ${LAB_INFO.pec}
      </div>
    </div>

    <div class="doc-title">Preventivo Esami</div>
    <div class="meta">Data emissione: ${todayFormatted()} &nbsp;|&nbsp; N° esami: ${exams.length}</div>

    ${patientBlock}

    <div class="section-title">Esami selezionati</div>
    <table>
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th style="width:90px">Codice</th>
          <th>Descrizione</th>
          <th style="width:80px" class="price-col">Prezzo</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" class="total-label">TOTALE</td>
          <td class="price-col">€ ${total.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      ${LAB_INFO.name} &nbsp;|&nbsp; P.IVA ${LAB_INFO.piva} &nbsp;|&nbsp; ${LAB_INFO.address} &nbsp;|&nbsp; PEC: ${LAB_INFO.pec}<br>
      Documento generato il ${todayFormatted()} — Valido come preventivo, non come ricevuta fiscale.
    </div>
  </body></html>`;

  printWindow(html);
}

function calcAgeYears(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

export function printReferto(patient: PrintPatient, exams: PrintExamWithResult[]) {
  const patientGender = patient.gender ?? null;
  const patientAge = calcAgeYears(patient.dateOfBirth);

  const billingLines = [
    patient.billingAddress,
    [patient.billingCap, patient.billingCity, patient.billingProvincia ? `(${patient.billingProvincia})` : ""].filter(Boolean).join(" "),
  ].filter(Boolean);

  let rowIndex = 0;
  const rows = exams.map((e) => {
    if (e.tipo === "pacchetto" && e.subResults?.length) {
      rowIndex++;
      const headerRow = `
        <tr style="background:#eff6ff !important;">
          <td style="font-weight:700;color:#1e40af">${rowIndex}</td>
          <td style="font-weight:700;color:#1e40af">${e.codiceAnalisi}</td>
          <td colspan="7" style="font-weight:700;color:#1e40af">
            ${e.descrizione}
            <span style="display:inline-block;margin-left:6px;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;font-size:8px;font-weight:700;padding:1px 7px;">PACCHETTO</span>
          </td>
        </tr>`;
      const subRows = e.subResults.map((sub) => {
        const oor = isOutOfRangeAny(sub.referenceRanges, sub.valoreRiferimento, sub.valore, patientGender, patientAge);
        const refDisplay = displayRefValueAny(sub.referenceRanges ?? null, sub.valoreRiferimento, patientGender, patientAge);
        return `
          <tr>
            <td style="color:#aaa;font-size:9px"></td>
            <td style="color:#888;font-size:9px">${sub.codiceAnalisi}</td>
            <td style="padding-left:18px">↳ ${sub.descrizione}</td>
            <td>${sub.um ?? "—"}</td>
            <td>${sub.metodo ?? "—"}</td>
            <td>—</td>
            <td>${refDisplay}</td>
            <td style="font-weight:700;color:${oor ? "#c62828" : sub.valore ? "#1a1a1a" : "#999"}">
              ${sub.valore ?? "—"}${oor ? ' <span style="color:#c62828;font-weight:900">!</span>' : ""}
            </td>
            <td style="font-style:italic;color:#555">${sub.refertaNote ?? ""}</td>
          </tr>`;
      }).join("");
      return headerRow + subRows;
    }
    const oor = isOutOfRangeAny(e.referenceRanges, e.valoreRiferimento, e.valore, patientGender, patientAge);
    const refDisplay = displayRefValueAny(e.referenceRanges ?? null, e.valoreRiferimento, patientGender, patientAge);
    rowIndex++;
    return `
    <tr>
      <td>${rowIndex}</td>
      <td style="font-weight:600">${e.codiceAnalisi}</td>
      <td>${e.descrizione}</td>
      <td>${e.um ?? "—"}</td>
      <td>${e.metodo ?? "—"}</td>
      <td>${e.regola ?? "—"}</td>
      <td>${refDisplay}</td>
      <td style="font-weight:700;color:${oor ? "#c62828" : e.valore ? "#1a1a1a" : "#999"}">
        ${e.valore ?? "—"}${oor ? ' <span style="color:#c62828;font-weight:900">!</span>' : ""}
      </td>
      <td style="font-style:italic;color:#555">${e.refertaNote ?? ""}</td>
    </tr>
  `;}).join("");

  const now = new Date();
  const signedAt = now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Referto – ${patient.firstName} ${patient.lastName}</title><style>
    ${BASE_CSS}
    table { font-size: 9px; }
    th { font-size: 7.5px; }
    td { padding: 4px 5px; }
    .result-col { font-weight: 700; }
  </style></head><body>
    <div class="header">
      <img src="${logoUrl()}" alt="Logo" class="logo" />
      <div class="lab-info">
        <strong>${LAB_INFO.name}</strong>
        P.IVA: ${LAB_INFO.piva} &nbsp;|&nbsp; C.F.: ${LAB_INFO.cf}<br>
        VAT EU: ${LAB_INFO.vat}<br>
        ${LAB_INFO.address}<br>
        REA: ${LAB_INFO.rea}<br>
        PEC: ${LAB_INFO.pec}
      </div>
    </div>

    <div class="doc-title">Referto di Laboratorio</div>
    <div class="meta">Data refertazione: ${todayFormatted()} &nbsp;|&nbsp; N° esami: ${exams.length}</div>

    <div class="section-title">Paziente</div>
    <div class="patient-box">
      <div class="row">
        <div><span>Nome: </span><strong>${patient.firstName} ${patient.lastName}</strong></div>
        ${patient.dateOfBirth ? `<div><span>Nato il: </span><strong>${patient.dateOfBirth}</strong></div>` : ""}
        ${patient.codiceFiscale ? `<div><span>C.F.: </span><strong>${patient.codiceFiscale}</strong></div>` : ""}
        ${patient.gender ? `<div><span>Sesso: </span><strong>${patient.gender === "M" ? "Maschio" : "Femmina"}</strong></div>` : ""}
      </div>
      ${patient.email ? `<div style="margin-top:3px"><span>Email: </span><strong>${patient.email}</strong></div>` : ""}
      ${patient.phone ? `<div style="margin-top:3px"><span>Telefono: </span><strong>${patient.phone}</strong></div>` : ""}
      ${billingLines.length ? `<div style="margin-top:3px"><span>Indirizzo: </span><strong>${billingLines.join(", ")}</strong></div>` : ""}
      ${patient.notes ? `<div style="margin-top:3px"><span>Note cliniche: </span><strong>${patient.notes}</strong></div>` : ""}
    </div>

    <div class="section-title">Risultati esami</div>
    <table>
      <thead>
        <tr>
          <th style="width:20px">#</th>
          <th style="width:72px">Codice</th>
          <th style="min-width:120px">Descrizione</th>
          <th style="width:34px">UM</th>
          <th style="width:72px">Metodo</th>
          <th style="width:60px">Regola</th>
          <th style="width:90px">Val. Riferimento</th>
          <th style="width:80px">Risultato</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="margin-top:28px; padding:14px 16px; border:1px solid #ddd; border-radius:4px; background:#fafafa;">
      <div style="font-size:9px; color:#444; line-height:1.6; margin-bottom:10px; font-style:italic;">
        Referto firmato digitalmente ai sensi del Decreto Legislativo 82/2005 S.M.I. e norme collegate, che sostituisce il documento cartaceo e la firma autografa.
      </div>
      <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:20px;">
        <div style="text-align:right;">
          <div style="font-size:9px; color:#888; margin-bottom:6px;">Medico refertante</div>
          <div style="font-size:10px; font-weight:700; color:#1a1a1a;">Dott. Ligabue Enrico</div>
          <div style="font-size:8.5px; color:#555; margin-bottom:10px;">Specialista in oncologia e traumatologia</div>
          <img src="${FIRMA_BASE64}" alt="Firma" style="height:80px; display:block; margin-left:auto; margin-bottom:0;" />
          <div style="border-top:1px solid #555; width:200px; margin-left:auto; margin-bottom:5px;"></div>
          <div style="font-size:7.5px; color:#666;">Firmato digitalmente da Ligabue Enrico</div>
          <div style="font-size:7.5px; color:#666;">in data ${signedAt}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      ${LAB_INFO.name} &nbsp;|&nbsp; P.IVA ${LAB_INFO.piva} &nbsp;|&nbsp; ${LAB_INFO.address}<br>
      Documento generato il ${todayFormatted()} — Uso interno / consegna al paziente.
    </div>
  </body></html>`;

  printWindow(html);
}

export function printSchedaLaboratorio(patient: PrintPatient, exams: PrintExam[]) {
  const rows = exams.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600">${e.codiceAnalisi}</td>
      <td>${e.descrizione}</td>
      <td>${provettaColor(e.colorProvetta)}</td>
      <td style="text-align:center">${e.synlab === true ? '<span style="color:#1565c0;font-weight:700;">✓ Sì</span>' : e.synlab === false ? '<span style="color:#555;">No</span>' : "—"}</td>
      <td>${e.um ?? "—"}</td>
      <td>${e.metodo ?? "—"}</td>
      <td>${e.regola ?? "—"}</td>
      <td>${e.preparationInstructions ?? "—"}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Scheda Lab – ${patient.firstName} ${patient.lastName}</title><style>
    ${BASE_CSS}
    table { font-size: 9px; }
    th { font-size: 7.5px; }
    td { padding: 4px 5px; }
  </style></head><body>
    <div class="header">
      <img src="${logoUrl()}" alt="Logo" class="logo" />
      <div class="lab-info">
        <strong>${LAB_INFO.name}</strong>
        P.IVA: ${LAB_INFO.piva} &nbsp;|&nbsp; C.F.: ${LAB_INFO.cf}<br>
        VAT EU: ${LAB_INFO.vat}<br>
        ${LAB_INFO.address}<br>
        REA: ${LAB_INFO.rea}<br>
        PEC: ${LAB_INFO.pec}
      </div>
    </div>

    <div class="doc-title">Scheda Laboratorio</div>
    <div class="meta">Data: ${todayFormatted()} &nbsp;|&nbsp; N° esami: ${exams.length}</div>

    <div class="section-title">Paziente</div>
    <div class="patient-box">
      <div class="row">
        <div><span>Nome: </span><strong>${patient.firstName} ${patient.lastName}</strong></div>
        ${patient.dateOfBirth ? `<div><span>Nato il: </span><strong>${patient.dateOfBirth}</strong></div>` : ""}
        ${patient.codiceFiscale ? `<div><span>C.F.: </span><strong>${patient.codiceFiscale}</strong></div>` : ""}
        ${patient.gender ? `<div><span>Sesso: </span><strong>${patient.gender === "M" ? "Maschio" : "Femmina"}</strong></div>` : ""}
      </div>
      ${patient.email ? `<div style="margin-top:3px"><span>Email: </span><strong>${patient.email}</strong></div>` : ""}
      ${patient.phone ? `<div style="margin-top:3px"><span>Telefono: </span><strong>${patient.phone}</strong></div>` : ""}
      ${[patient.billingAddress, [patient.billingCap, patient.billingCity, patient.billingProvincia ? `(${patient.billingProvincia})` : ""].filter(Boolean).join(" ")].filter(Boolean).join(", ") ? `<div style="margin-top:3px"><span>Indirizzo fatturazione: </span><strong>${[patient.billingAddress, [patient.billingCap, patient.billingCity, patient.billingProvincia ? `(${patient.billingProvincia})` : ""].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</strong></div>` : ""}
      ${patient.notes ? `<div style="margin-top:3px"><span>Note: </span><strong>${patient.notes}</strong></div>` : ""}
    </div>

    <div class="section-title">Dettaglio esami</div>
    <table>
      <thead>
        <tr>
          <th style="width:20px">#</th>
          <th style="width:72px">Codice</th>
          <th style="min-width:130px">Descrizione</th>
          <th style="width:72px">Provetta</th>
          <th style="width:48px">Synlab</th>
          <th style="width:36px">UM</th>
          <th style="width:80px">Metodo</th>
          <th style="width:72px">Regola</th>
          <th>Prep.</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">
      USO INTERNO — ${LAB_INFO.name} &nbsp;|&nbsp; Documento generato il ${todayFormatted()}
    </div>
  </body></html>`;

  printWindow(html);
}
