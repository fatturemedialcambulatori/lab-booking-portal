import React from "react";
import Papa from "papaparse";
import {
  AlertTriangle,
  CalendarClock,
  Download,
  FileText,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { printProcuraAlleLiti } from "@/lib/printDocs";

type StatoCertificato = "caricato" | "da-caricare" | "in-scadenza" | "scaduto";

type ClienteInfortunistica = {
  id: string;
  nome: string;
  codiceFiscale: string;
  telefono: string;
  email: string;
  indirizzo: string;
  luogoNascita?: string;
  dataNascita?: string;
};

type PraticaSinistro = {
  id: string;
  clienteId: string;
  compagnia: string;
  numeroSinistro: string;
  dataSinistro: string;
  referente: string;
  stato: "aperta" | "chiusa";
};

type CertificatoSinistro = {
  id: string;
  clienteId: string;
  praticaId: string;
  tipo: string;
  emissione: string;
  prognosiGiorni: number;
  scadenza: string;
  stato: StatoCertificato;
  fileName?: string;
  fileUrl?: string;
  storagePath?: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  note: string;
};

type InfortunisticaState = {
  clienti: ClienteInfortunistica[];
  pratiche: PraticaSinistro[];
  certificati: CertificatoSinistro[];
};

type CertificatoFileMetadata = {
  certificatoId: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

type PeriodoScoperto = {
  pratica: PraticaSinistro;
  dal: string;
  al: string;
};

const CLIENTI_INIZIALI: ClienteInfortunistica[] = [
  {
    id: "cliente-rossi",
    nome: "Mario Rossi",
    codiceFiscale: "RSSMRA80A01F257X",
    telefono: "333 1234567",
    email: "mario.rossi@email.it",
    indirizzo: "Via Emilia 120, Modena",
    luogoNascita: "Modena",
    dataNascita: "1980-01-01",
  },
  {
    id: "cliente-ferri",
    nome: "Laura Ferri",
    codiceFiscale: "FRRLRU78C44I462Q",
    telefono: "349 9988776",
    email: "laura.ferri@email.it",
    indirizzo: "Via Radici 18, Sassuolo",
    luogoNascita: "Sassuolo",
    dataNascita: "1978-03-04",
  },
];

const PRATICHE_INIZIALI: PraticaSinistro[] = [
  {
    id: "sinistro-001",
    clienteId: "cliente-rossi",
    compagnia: "UnipolSai",
    numeroSinistro: "US-2026-1044",
    dataSinistro: "2026-07-02",
    referente: "Studio legale Bianchi",
    stato: "aperta",
  },
  {
    id: "sinistro-002",
    clienteId: "cliente-rossi",
    compagnia: "Generali",
    numeroSinistro: "GEN-88921",
    dataSinistro: "2026-05-21",
    referente: "Avv. Riccardo Neri",
    stato: "chiusa",
  },
  {
    id: "sinistro-003",
    clienteId: "cliente-ferri",
    compagnia: "Allianz",
    numeroSinistro: "ALZ-7712",
    dataSinistro: "2026-07-08",
    referente: "Avv. Martina Costa",
    stato: "aperta",
  },
];

const CERTIFICATI_INIZIALI: CertificatoSinistro[] = [
  {
    id: "cert-001",
    clienteId: "cliente-rossi",
    praticaId: "sinistro-001",
    tipo: "Primo certificato",
    emissione: "2026-07-02",
    prognosiGiorni: 10,
    scadenza: "2026-07-12",
    stato: "caricato",
    fileName: "certificato-rossi-0207.pdf",
    note: "Accesso per cervicalgia post tamponamento.",
  },
  {
    id: "cert-002",
    clienteId: "cliente-rossi",
    praticaId: "sinistro-001",
    tipo: "Continuazione malattia",
    emissione: "2026-07-15",
    prognosiGiorni: 12,
    scadenza: "2026-07-27",
    stato: "in-scadenza",
    fileName: "continuazione-rossi-1507.pdf",
    note: "Persistenza dolore rachide cervicale.",
  },
  {
    id: "cert-003",
    clienteId: "cliente-ferri",
    praticaId: "sinistro-003",
    tipo: "Primo certificato",
    emissione: "2026-07-08",
    prognosiGiorni: 7,
    scadenza: "2026-07-15",
    stato: "da-caricare",
    note: "File da ricevere dal cliente.",
  },
];

const formatData = (date: string) => new Intl.DateTimeFormat("it-IT").format(new Date(`${date}T12:00:00`));

const giorniAllaScadenza = (date: string) => {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(`${date}T12:00:00`).getTime();
  return Math.ceil((target - base) / 86_400_000);
};

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const giorniInclusivi = (dal: string, al: string) => {
  const start = new Date(`${dal}T12:00:00`).getTime();
  const end = new Date(`${al}T12:00:00`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000) + 1);
};

const certificatoAttivoOggi = (certificato: CertificatoSinistro) => {
  const today = new Date();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  const start = new Date(`${certificato.emissione}T12:00:00`).getTime();
  const end = new Date(`${certificato.scadenza}T12:00:00`).getTime();
  return start <= todayTime && todayTime <= end;
};

const calcolaPeriodiScoperti = (
  praticheDaControllare: PraticaSinistro[],
  certificatiDaControllare: CertificatoSinistro[],
): PeriodoScoperto[] =>
  praticheDaControllare.flatMap((pratica) => {
    const lista = certificatiDaControllare
      .filter((certificato) => certificato.praticaId === pratica.id)
      .sort((a, b) => a.emissione.localeCompare(b.emissione));

    return lista.flatMap((certificato, index) => {
      const prossimo = lista[index + 1];
      if (!prossimo) return [];
      const giornoDopoScadenza = addDays(certificato.scadenza, 1);
      const giornoPrimaProssimaEmissione = addDays(prossimo.emissione, -1);
      if (giornoDopoScadenza > giornoPrimaProssimaEmissione) return [];
      return [
        {
          pratica,
          dal: giornoDopoScadenza,
          al: giornoPrimaProssimaEmissione,
        },
      ];
    });
  });

const calcolaSommarioMalattie = (certificatiDaControllare: CertificatoSinistro[], periodi: PeriodoScoperto[]) => ({
  certificati: certificatiDaControllare.length,
  giorniMalattia: certificatiDaControllare.reduce((sum, certificato) => sum + certificato.prognosiGiorni, 0),
  malattieAttive: certificatiDaControllare.filter(certificatoAttivoOggi).length,
  periodiScoperti: periodi.length,
  giorniScoperti: periodi.reduce((sum, periodo) => sum + giorniInclusivi(periodo.dal, periodo.al), 0),
});

const safeFileName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "certificato";

const csvCell = (value: string | number | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const isPraticaAttiva = (pratica: PraticaSinistro) => pratica.stato === "aperta";

const certFileUrl = (certificatoId: string) =>
  `/api/infortunistica-certificato-file/${encodeURIComponent(certificatoId)}`;

const isInfortunisticaState = (value: unknown): value is InfortunisticaState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<InfortunisticaState>;
  return Array.isArray(candidate.clienti) && Array.isArray(candidate.pratiche) && Array.isArray(candidate.certificati);
};

const isCertificatoFileMetadata = (value: unknown): value is CertificatoFileMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CertificatoFileMetadata>;
  return (
    typeof candidate.certificatoId === "string" &&
    typeof candidate.storagePath === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.contentType === "string" &&
    typeof candidate.sizeBytes === "number" &&
    typeof candidate.uploadedAt === "string"
  );
};

const applicaFileMetadata = (
  certificati: CertificatoSinistro[],
  files: CertificatoFileMetadata[],
): CertificatoSinistro[] => {
  const filesByCertificato = new Map(files.map((file) => [file.certificatoId, file]));

  return certificati.map((certificato) => {
    const file = filesByCertificato.get(certificato.id);
    if (!file) {
      return certificato.storagePath
        ? { ...certificato, fileUrl: certFileUrl(certificato.id), stato: "caricato" }
        : certificato;
    }

    return {
      ...certificato,
      fileName: file.fileName,
      fileUrl: certFileUrl(certificato.id),
      storagePath: file.storagePath,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.uploadedAt,
      stato: "caricato",
    };
  });
};

const scaricaBlob = (content: BlobPart, fileName: string, type = "text/plain") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const normalizeCsvHeader = (value: string) =>
  value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("it-IT").replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const cleanCsvValue = (value: unknown) => String(value ?? "").trim().replace(/^'+/, "").trim();

const readCsvValue = (row: Record<string, unknown>, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeCsvHeader);
  const entry = Object.entries(row).find(([key]) => normalizedAliases.includes(normalizeCsvHeader(key)));
  return cleanCsvValue(entry?.[1]);
};

const firstNonEmpty = (...values: string[]) => values.find((value) => value.trim())?.trim() ?? "";

const validFiscalCode = (value: string) => /^[A-Z0-9]{16}$/i.test(value.trim());

const makeImportedId = (prefix: string, value: string, index: number) =>
  `${prefix}-${safeFileName(value || `${Date.now()}-${index}`)}-${index}`;

const importedClientKey = (cliente: Pick<ClienteInfortunistica, "nome" | "codiceFiscale" | "email" | "telefono">) =>
  (cliente.codiceFiscale && `cf:${cliente.codiceFiscale.toLocaleUpperCase("it-IT")}`) ||
  (cliente.email && `email:${cliente.email.toLocaleLowerCase("it-IT")}`) ||
  (cliente.telefono && `tel:${cliente.telefono.replace(/\s+/g, "")}`) ||
  `nome:${cliente.nome.toLocaleLowerCase("it-IT")}`;

const buildImportedClient = (row: Record<string, unknown>, index: number): ClienteInfortunistica | null => {
  const firstName = readCsvValue(row, ["first name", "firstname", "nome", "fiscal first name"]);
  const lastName = readCsvValue(row, ["last name", "lastname", "cognome", "fiscal last name"]);
  const nome = firstNonEmpty(readCsvValue(row, ["cliente", "nome cliente", "name"]), [firstName, lastName].filter(Boolean).join(" "));
  if (!nome) return null;

  const fiscalCode = readCsvValue(row, ["codice fiscale", "codiceFiscale", "fiscal code", "tax code", "cf"]);
  const document = readCsvValue(row, ["document", "documento"]);
  const street = readCsvValue(row, ["address street", "indirizzo", "via"]);
  const streetNumber = readCsvValue(row, ["address number", "numero civico", "civico"]);
  const cap = readCsvValue(row, ["address postal code", "cap", "codice postale"]);
  const city = readCsvValue(row, ["address city", "citta", "città", "comune"]);
  const province = readCsvValue(row, ["address province", "address state", "provincia", "prov"]);
  const country = readCsvValue(row, ["address country", "country", "paese"]);
  const addressLine = firstNonEmpty(
    readCsvValue(row, ["indirizzo completo", "indirizzo fatturazione", "address"]),
    [
      [street, streetNumber].filter(Boolean).join(" "),
      [cap, city].filter(Boolean).join(" "),
      province,
      country,
    ].filter(Boolean).join(", "),
  );

  return {
    id: makeImportedId("cliente", firstNonEmpty(fiscalCode, document, nome), index),
    nome,
    codiceFiscale: firstNonEmpty(fiscalCode, validFiscalCode(document) ? document : "").toLocaleUpperCase("it-IT"),
    telefono: readCsvValue(row, ["telefono", "phone", "mobile", "cellulare", "additional phone"]),
    email: readCsvValue(row, ["email", "e-mail", "mail"]),
    indirizzo: addressLine,
    luogoNascita: readCsvValue(row, ["luogo nascita", "born city", "birth city", "comune nascita"]),
    dataNascita: readCsvValue(row, ["data nascita", "data di nascita", "date of birth", "dob"]),
  };
};

const mergeImportedClient = (
  current: ClienteInfortunistica,
  incoming: ClienteInfortunistica,
): ClienteInfortunistica => ({
  ...current,
  nome: incoming.nome || current.nome,
  codiceFiscale: incoming.codiceFiscale || current.codiceFiscale,
  telefono: incoming.telefono || current.telefono,
  email: incoming.email || current.email,
  indirizzo: incoming.indirizzo || current.indirizzo,
  luogoNascita: incoming.luogoNascita || current.luogoNascita,
  dataNascita: incoming.dataNascita || current.dataNascita,
});

export function AdminInfortunistica() {
  const importClientiInputRef = React.useRef<HTMLInputElement | null>(null);
  const [clienti, setClienti] = React.useState(CLIENTI_INIZIALI);
  const [pratiche, setPratiche] = React.useState(PRATICHE_INIZIALI);
  const [certificati, setCertificati] = React.useState(CERTIFICATI_INIZIALI);
  const [persistenzaAttiva, setPersistenzaAttiva] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedClienteId, setSelectedClienteId] = React.useState(CLIENTI_INIZIALI[0]?.id ?? "");
  const [nuovoSinistro, setNuovoSinistro] = React.useState({
    nome: "",
    codiceFiscale: "",
    telefono: "",
    email: "",
    indirizzo: "",
    luogoNascita: "",
    dataNascita: "",
    compagnia: "",
    numeroSinistro: "",
    dataSinistro: "",
    referente: "",
  });
  const [nuovaPratica, setNuovaPratica] = React.useState({
    compagnia: "",
    numeroSinistro: "",
    dataSinistro: "",
    referente: "",
    stato: "aperta" as PraticaSinistro["stato"],
  });
  const [nuovoCertificato, setNuovoCertificato] = React.useState({
    praticaId: "",
    tipo: "",
    emissione: "",
    prognosiGiorni: "7",
    scadenza: "",
    stato: "da-caricare" as StatoCertificato,
    note: "",
  });
  const saveTimerRef = React.useRef<number | null>(null);
  const skipFirstSaveRef = React.useRef(true);

  const mostraNotifica = React.useCallback((
    description: string,
    variant: "default" | "destructive" = "default",
  ) => {
    toast({
      title: variant === "destructive" ? "Attenzione" : "Notifica",
      description,
      variant,
    });
  }, []);

  React.useEffect(() => {
    let active = true;

    const caricaInfortunistica = async () => {
      try {
        const [stateResponse, filesResponse] = await Promise.all([
          fetch("/api/infortunistica-state"),
          fetch("/api/infortunistica-certificati-files"),
        ]);

        const stateData: unknown = stateResponse.ok ? await stateResponse.json() : null;
        const filesData: unknown = filesResponse.ok ? await filesResponse.json() : [];

        if (!active) return;

        const prossimiClienti = isInfortunisticaState(stateData) ? stateData.clienti : CLIENTI_INIZIALI;
        const prossimePratiche = isInfortunisticaState(stateData) ? stateData.pratiche : PRATICHE_INIZIALI;
        const prossimiCertificatiBase = isInfortunisticaState(stateData)
          ? stateData.certificati
          : CERTIFICATI_INIZIALI;
        const files = Array.isArray(filesData) ? filesData.filter(isCertificatoFileMetadata) : [];
        const prossimiCertificati = applicaFileMetadata(prossimiCertificatiBase, files);

        setClienti(prossimiClienti);
        setPratiche(prossimePratiche);
        setCertificati(prossimiCertificati);
        setSelectedClienteId((current) =>
          prossimiClienti.some((cliente) => cliente.id === current)
            ? current
            : prossimiClienti[0]?.id ?? "",
        );
      } catch {
        if (!active) return;
        mostraNotifica("Infortunistica non collegata al DB. Uso dati temporanei.", "destructive");
      } finally {
        if (active) setPersistenzaAttiva(true);
      }
    };

    void caricaInfortunistica();

    return () => {
      active = false;
    };
  }, [mostraNotifica]);

  React.useEffect(() => {
    if (!persistenzaAttiva) return;

    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const payload: InfortunisticaState = {
      clienti,
      pratiche,
      certificati,
    };

    saveTimerRef.current = window.setTimeout(() => {
      void fetch("/api/infortunistica-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }).catch(() => {
        mostraNotifica("Salvataggio infortunistica non riuscito. Verifica Supabase.", "destructive");
      });
    }, 700);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [certificati, clienti, persistenzaAttiva, pratiche, mostraNotifica]);

  const clientiFiltrati = React.useMemo(() => {
    const search = query.trim().toLocaleLowerCase("it-IT");
    if (!search) return clienti;
    return clienti.filter((cliente) =>
      [cliente.nome, cliente.codiceFiscale, cliente.telefono, cliente.email].some((field) =>
        field.toLocaleLowerCase("it-IT").includes(search),
      ),
    );
  }, [clienti, query]);

  const clienteSelezionato = clienti.find((cliente) => cliente.id === selectedClienteId) ?? clienti[0];
  const praticheAttive = React.useMemo(() => pratiche.filter(isPraticaAttiva), [pratiche]);
  const praticheAttiveIds = React.useMemo(
    () => new Set(praticheAttive.map((pratica) => pratica.id)),
    [praticheAttive],
  );
  const praticheCliente = React.useMemo(
    () => praticheAttive.filter((pratica) => pratica.clienteId === clienteSelezionato?.id),
    [clienteSelezionato?.id, praticheAttive],
  );
  const certificatiPraticheAttive = React.useMemo(
    () => certificati.filter((certificato) => praticheAttiveIds.has(certificato.praticaId)),
    [certificati, praticheAttiveIds],
  );
  const certificatiCliente = React.useMemo(
    () => certificatiPraticheAttive.filter((certificato) => certificato.clienteId === clienteSelezionato?.id),
    [certificatiPraticheAttive, clienteSelezionato?.id],
  );

  const certificatiInScadenza = React.useMemo(
    () =>
      certificatiPraticheAttive
        .map((certificato) => ({
          certificato,
          cliente: clienti.find((item) => item.id === certificato.clienteId),
          pratica: pratiche.find((item) => item.id === certificato.praticaId),
          giorni: giorniAllaScadenza(certificato.scadenza),
        }))
        .sort((a, b) => a.giorni - b.giorni),
    [certificatiPraticheAttive, clienti, pratiche],
  );

  const periodiScoperti = React.useMemo(
    () => (clienteSelezionato ? calcolaPeriodiScoperti(praticheCliente, certificatiPraticheAttive) : []),
    [certificatiPraticheAttive, clienteSelezionato, praticheCliente],
  );
  const periodiScopertiGlobali = React.useMemo(
    () => calcolaPeriodiScoperti(praticheAttive, certificatiPraticheAttive),
    [certificatiPraticheAttive, praticheAttive],
  );
  const sommarioCliente = React.useMemo(
    () => calcolaSommarioMalattie(certificatiCliente, periodiScoperti),
    [certificatiCliente, periodiScoperti],
  );
  const sommarioGlobale = React.useMemo(
    () => calcolaSommarioMalattie(certificatiPraticheAttive, periodiScopertiGlobali),
    [certificatiPraticheAttive, periodiScopertiGlobali],
  );

  React.useEffect(() => {
    setNuovoCertificato((current) => ({
      ...current,
      praticaId: current.praticaId && praticheCliente.some((pratica) => pratica.id === current.praticaId)
        ? current.praticaId
        : praticheCliente[0]?.id ?? "",
    }));
  }, [praticheCliente]);

  const aggiornaCliente = <K extends keyof ClienteInfortunistica>(
    id: string,
    field: K,
    value: ClienteInfortunistica[K],
  ) => {
    setClienti((current) =>
      current.map((cliente) => (cliente.id === id ? { ...cliente, [field]: value } : cliente)),
    );
  };

  const aggiornaPratica = <K extends keyof PraticaSinistro>(
    id: string,
    field: K,
    value: PraticaSinistro[K],
  ) => {
    setPratiche((current) =>
      current.map((pratica) => (pratica.id === id ? { ...pratica, [field]: value } : pratica)),
    );
  };

  const eliminaPratica = (id: string) => {
    const pratica = pratiche.find((item) => item.id === id);
    setPratiche((current) => current.filter((item) => item.id !== id));
    setCertificati((current) => current.filter((certificato) => certificato.praticaId !== id));
    setNuovoCertificato((current) => (current.praticaId === id ? { ...current, praticaId: "" } : current));
    mostraNotifica(
      pratica
        ? `Pratica ${pratica.compagnia} ${pratica.numeroSinistro} eliminata.`
        : "Pratica eliminata.",
    );
  };

  const aggiornaCertificato = <K extends keyof CertificatoSinistro>(
    id: string,
    field: K,
    value: CertificatoSinistro[K],
  ) => {
    setCertificati((current) =>
      current.map((certificato) => (certificato.id === id ? { ...certificato, [field]: value } : certificato)),
    );
  };

  const uploadCertificato = async (id: string, file: File | undefined) => {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      mostraNotifica("File troppo grande: sul piano Free il limite e 50 MB per file.", "destructive");
      return;
    }

    const certificato = certificati.find((item) => item.id === id);
    if (!certificato) return;

    try {
      const response = await fetch(certFileUrl(id), {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name),
          "x-cliente-id": certificato.clienteId,
          "x-pratica-id": certificato.praticaId,
        },
        body: file,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data && typeof data === "object" && "details" in data
          ? String(data.details)
          : "Upload certificato non riuscito.";
        mostraNotifica(message, "destructive");
        return;
      }

      const data: unknown = await response.json();
      const fileData = isCertificatoFileMetadata(data) ? data : null;
      const fileUrl =
        data && typeof data === "object" && "fileUrl" in data && typeof data.fileUrl === "string"
          ? data.fileUrl
          : certFileUrl(id);

      setCertificati((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                fileName: fileData?.fileName ?? file.name,
                fileUrl,
                storagePath: fileData?.storagePath,
                contentType: fileData?.contentType ?? file.type,
                sizeBytes: fileData?.sizeBytes ?? file.size,
                uploadedAt: fileData?.uploadedAt ?? new Date().toISOString(),
                stato: "caricato",
              }
            : item,
        ),
      );
      mostraNotifica("Certificato caricato su Supabase Storage.");
    } catch {
      mostraNotifica("Upload certificato non riuscito. Verifica la configurazione Storage.", "destructive");
    }
  };

  const creaPraticaCliente = () => {
    if (!clienteSelezionato || !nuovaPratica.compagnia.trim() || !nuovaPratica.numeroSinistro.trim()) return;

    const praticaId = `sinistro-${Date.now()}`;
    setPratiche((current) => [
      ...current,
      {
        id: praticaId,
        clienteId: clienteSelezionato.id,
        compagnia: nuovaPratica.compagnia.trim(),
        numeroSinistro: nuovaPratica.numeroSinistro.trim(),
        dataSinistro: nuovaPratica.dataSinistro || new Date().toISOString().slice(0, 10),
        referente: nuovaPratica.referente.trim(),
        stato: "aperta",
      },
    ]);
    setNuovaPratica({
      compagnia: "",
      numeroSinistro: "",
      dataSinistro: "",
      referente: "",
      stato: "aperta",
    });
    setNuovoCertificato((current) => ({ ...current, praticaId }));
  };

  const creaCertificatoCliente = () => {
    if (!clienteSelezionato || !nuovoCertificato.praticaId || !nuovoCertificato.tipo.trim()) return;
    const prognosi = Math.max(0, Number(nuovoCertificato.prognosiGiorni) || 0);
    const emissione = nuovoCertificato.emissione || new Date().toISOString().slice(0, 10);
    const scadenza = nuovoCertificato.scadenza || addDays(emissione, prognosi);

    setCertificati((current) => [
      ...current,
      {
        id: `cert-${Date.now()}`,
        clienteId: clienteSelezionato.id,
        praticaId: nuovoCertificato.praticaId,
        tipo: nuovoCertificato.tipo.trim(),
        emissione,
        prognosiGiorni: prognosi,
        scadenza,
        stato: nuovoCertificato.stato,
        note: nuovoCertificato.note.trim(),
      },
    ]);
    setNuovoCertificato({
      praticaId: nuovoCertificato.praticaId,
      tipo: "",
      emissione: "",
      prognosiGiorni: "7",
      scadenza: "",
      stato: "da-caricare",
      note: "",
    });
  };

  const creaIndiceCertificati = (lista: CertificatoSinistro[]) => {
    const righe = [
      [
        "Cliente",
        "Codice fiscale",
        "Compagnia",
        "Numero sinistro",
        "Tipo certificato",
        "Emissione",
        "Prognosi giorni",
        "Scadenza",
        "Stato",
        "File",
        "Note",
      ].map(csvCell).join(";"),
      ...lista.map((certificato) => {
        const cliente = clienti.find((item) => item.id === certificato.clienteId);
        const pratica = pratiche.find((item) => item.id === certificato.praticaId);
        return [
          cliente?.nome,
          cliente?.codiceFiscale,
          pratica?.compagnia,
          pratica?.numeroSinistro,
          certificato.tipo,
          certificato.emissione,
          certificato.prognosiGiorni,
          certificato.scadenza,
          certificato.stato,
          certificato.fileName ?? "",
          certificato.note,
        ].map(csvCell).join(";");
      }),
    ];
    return righe.join("\n");
  };

  const scaricaCertificatoSingolo = (certificato: CertificatoSinistro) => {
    if (certificato.fileUrl) {
      const link = document.createElement("a");
      link.href = certificato.fileUrl;
      link.download = certificato.fileName ?? "certificato.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    scaricaBlob(
      `Tipo: ${certificato.tipo}\nEmissione: ${certificato.emissione}\nScadenza: ${certificato.scadenza}\nNote: ${certificato.note}`,
      certificato.fileName ?? `${safeFileName(certificato.tipo)}.txt`,
    );
  };

  const downloadCertificato = (certificato: CertificatoSinistro) => {
    scaricaCertificatoSingolo(certificato);
  };

  const scaricaCertificati = (lista: CertificatoSinistro[], filePrefix: string) => {
    if (!lista.length) return;
    scaricaBlob(
      creaIndiceCertificati(lista),
      `${safeFileName(filePrefix)}-indice-certificati.csv`,
      "text/csv;charset=utf-8",
    );
    lista.forEach((certificato, index) => {
      window.setTimeout(() => scaricaCertificatoSingolo(certificato), 220 * (index + 1));
    });
  };

  const importaClientiCsv = async (file: File) => {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error("CSV non leggibile");
    }

    const nextClienti = [...clienti];
    const nextPratiche = [...pratiche];
    const nextCertificati = [...certificati];
    const clientiByKey = new Map(nextClienti.map((cliente, index) => [importedClientKey(cliente), index]));
    const praticheKeys = new Set(
      nextPratiche.map((pratica) =>
        `${pratica.clienteId}|${pratica.compagnia.toLocaleLowerCase("it-IT")}|${pratica.numeroSinistro.toLocaleLowerCase("it-IT")}`,
      ),
    );
    const baseTime = Date.now();
    let creati = 0;
    let aggiornati = 0;
    let praticheCreate = 0;
    let certificatiCreati = 0;
    let firstImportedClientId = "";

    parsed.data.forEach((row, index) => {
      const imported = buildImportedClient(row, baseTime + index);
      if (!imported) return;

      const key = importedClientKey(imported);
      const existingIndex = clientiByKey.get(key);
      const clienteId = existingIndex === undefined ? imported.id : nextClienti[existingIndex].id;

      if (!firstImportedClientId) firstImportedClientId = clienteId;

      if (existingIndex === undefined) {
        nextClienti.push({ ...imported, id: clienteId });
        clientiByKey.set(key, nextClienti.length - 1);
        creati++;
      } else {
        nextClienti[existingIndex] = mergeImportedClient(nextClienti[existingIndex], imported);
        aggiornati++;
      }

      const compagnia = readCsvValue(row, ["compagnia", "compagnia assicurativa", "insurance"]);
      const numeroSinistro = readCsvValue(row, ["numero sinistro", "numeroSinistro", "sinistro", "claim number"]);
      let praticaId = "";

      if (compagnia && numeroSinistro) {
        const praticaKey = `${clienteId}|${compagnia.toLocaleLowerCase("it-IT")}|${numeroSinistro.toLocaleLowerCase("it-IT")}`;
        const existingPratica = nextPratiche.find(
          (pratica) =>
            pratica.clienteId === clienteId &&
            pratica.compagnia.toLocaleLowerCase("it-IT") === compagnia.toLocaleLowerCase("it-IT") &&
            pratica.numeroSinistro.toLocaleLowerCase("it-IT") === numeroSinistro.toLocaleLowerCase("it-IT"),
        );
        praticaId = existingPratica?.id ?? "";

        if (!praticheKeys.has(praticaKey)) {
          praticaId = makeImportedId("sinistro", `${clienteId}-${numeroSinistro}`, baseTime + index);
          nextPratiche.push({
            id: praticaId,
            clienteId,
            compagnia,
            numeroSinistro,
            dataSinistro: readCsvValue(row, ["data sinistro", "dataSinistro", "claim date"]) || new Date().toISOString().slice(0, 10),
            referente: readCsvValue(row, ["referente", "referente legale", "legale", "lawyer"]),
            stato: readCsvValue(row, ["stato pratica", "statoPratica", "status"]).toLocaleLowerCase("it-IT") === "chiusa"
              ? "chiusa"
              : "aperta",
          });
          praticheKeys.add(praticaKey);
          praticheCreate++;
        }
      }

      const tipoCertificato = readCsvValue(row, ["tipo certificato", "tipoCertificato", "certificato", "certificate type"]);
      if (tipoCertificato && praticaId) {
        nextCertificati.push({
          id: makeImportedId("certificato", `${clienteId}-${tipoCertificato}`, baseTime + index),
          clienteId,
          praticaId,
          tipo: tipoCertificato,
          emissione: readCsvValue(row, ["emissione certificato", "emissioneCertificato", "emissione"]) || new Date().toISOString().slice(0, 10),
          prognosiGiorni: Number(readCsvValue(row, ["prognosi giorni", "prognosiGiorni", "prognosi"])) || 0,
          scadenza: readCsvValue(row, ["scadenza certificato", "scadenzaCertificato", "scadenza"]) || new Date().toISOString().slice(0, 10),
          stato: (readCsvValue(row, ["stato certificato", "statoCertificato"]) as StatoCertificato) || "da-caricare",
          note: readCsvValue(row, ["note certificato", "noteCertificato", "note"]),
        });
        certificatiCreati++;
      }
    });

    setClienti(nextClienti);
    setPratiche(nextPratiche);
    setCertificati(nextCertificati);
    if (firstImportedClientId) setSelectedClienteId(firstImportedClientId);
    mostraNotifica(
      `Import clienti completato: ${creati} creati, ${aggiornati} aggiornati, ${praticheCreate} pratiche, ${certificatiCreati} certificati.`,
    );
  };

  const apriImportClientiCsv = () => importClientiInputRef.current?.click();

  const gestisciImportClientiCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importaClientiCsv(file);
    } catch {
      mostraNotifica("Import clienti non riuscito. Controlla che il file sia un CSV valido.", "destructive");
    } finally {
      event.target.value = "";
    }
  };

  const creaSinistro = () => {
    const nome = nuovoSinistro.nome.trim();
    if (!nome || !nuovoSinistro.compagnia.trim() || !nuovoSinistro.numeroSinistro.trim()) return;

    const clienteId = `cliente-${Date.now()}`;
    const praticaId = `sinistro-${Date.now()}`;
    setClienti((current) => [
      ...current,
      {
        id: clienteId,
        nome,
        codiceFiscale: nuovoSinistro.codiceFiscale.trim(),
        telefono: nuovoSinistro.telefono.trim(),
        email: nuovoSinistro.email.trim(),
        indirizzo: nuovoSinistro.indirizzo.trim(),
        luogoNascita: nuovoSinistro.luogoNascita.trim(),
        dataNascita: nuovoSinistro.dataNascita,
      },
    ]);
    setPratiche((current) => [
      ...current,
      {
        id: praticaId,
        clienteId,
        compagnia: nuovoSinistro.compagnia.trim(),
        numeroSinistro: nuovoSinistro.numeroSinistro.trim(),
        dataSinistro: nuovoSinistro.dataSinistro || new Date().toISOString().slice(0, 10),
        referente: nuovoSinistro.referente.trim(),
        stato: "aperta",
      },
    ]);
    setSelectedClienteId(clienteId);
    setNuovoSinistro({
      nome: "",
      codiceFiscale: "",
      telefono: "",
      email: "",
      indirizzo: "",
      luogoNascita: "",
      dataNascita: "",
      compagnia: "",
      numeroSinistro: "",
      dataSinistro: "",
      referente: "",
    });
  };

  return (
    <div className="space-y-6">
      <input
        ref={importClientiInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={gestisciImportClientiCsv}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Infortunistica stradale</h1>
          <p className="text-sm text-muted-foreground">
            Gestione clienti, sinistri, certificati, scadenze e periodi di malattia scoperti.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2 sm:self-start" onClick={apriImportClientiCsv}>
          <Upload className="h-4 w-4" />
          Importa clienti CSV
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatBox label="Certificati totali" value={sommarioGlobale.certificati} />
        <StatBox label="Giorni malattia" value={sommarioGlobale.giorniMalattia} />
        <StatBox label="Malattie attive" value={sommarioGlobale.malattieAttive} />
        <StatBox
          label="Periodi scoperti"
          value={`${sommarioGlobale.periodiScoperti} / ${sommarioGlobale.giorniScoperti} gg`}
        />
      </div>

      <Tabs defaultValue="clienti" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clienti">Clienti infortunistica</TabsTrigger>
          <TabsTrigger value="scadenze">Scadenze certificati</TabsTrigger>
          <TabsTrigger value="nuovo">Nuovo sinistro</TabsTrigger>
        </TabsList>

        <TabsContent value="clienti" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-md border border-border bg-white">
              <div className="border-b border-border p-4">
                <Field label="Cerca cliente">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
                  </div>
                </Field>
              </div>
              <div className="divide-y divide-border">
                {clientiFiltrati.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => setSelectedClienteId(cliente.id)}
                    className={`w-full px-4 py-3 text-left ${
                      cliente.id === clienteSelezionato?.id ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{cliente.nome}</p>
                    <p className="text-xs text-muted-foreground">{cliente.codiceFiscale}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pratiche.filter((pratica) => pratica.clienteId === cliente.id).length} pratiche
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {clienteSelezionato && (
              <section className="space-y-4">
                <div className="rounded-md border border-border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-foreground">{clienteSelezionato.nome}</h2>
                        <p className="text-sm text-muted-foreground">
                          Modifica anagrafica cliente e dati di contatto.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 sm:self-start"
                      onClick={() =>
                        printProcuraAlleLiti({
                          ...clienteSelezionato,
                          birthPlace: clienteSelezionato.luogoNascita,
                          dateOfBirth: clienteSelezionato.dataNascita,
                        })
                      }
                    >
                      <Printer className="h-4 w-4" />
                      Stampa procura PDF
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Nome cliente">
                      <Input
                        value={clienteSelezionato.nome}
                        onChange={(event) => aggiornaCliente(clienteSelezionato.id, "nome", event.target.value)}
                      />
                    </Field>
                    <Field label="Codice fiscale">
                      <Input
                        value={clienteSelezionato.codiceFiscale}
                        onChange={(event) =>
                          aggiornaCliente(clienteSelezionato.id, "codiceFiscale", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Telefono">
                      <Input
                        value={clienteSelezionato.telefono}
                        onChange={(event) => aggiornaCliente(clienteSelezionato.id, "telefono", event.target.value)}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={clienteSelezionato.email}
                        onChange={(event) => aggiornaCliente(clienteSelezionato.id, "email", event.target.value)}
                      />
                    </Field>
                    <Field label="Indirizzo">
                      <Input
                        value={clienteSelezionato.indirizzo}
                        onChange={(event) => aggiornaCliente(clienteSelezionato.id, "indirizzo", event.target.value)}
                      />
                    </Field>
                    <Field label="Luogo nascita">
                      <Input
                        value={clienteSelezionato.luogoNascita ?? ""}
                        onChange={(event) => aggiornaCliente(clienteSelezionato.id, "luogoNascita", event.target.value)}
                      />
                    </Field>
                    <Field label="Data nascita">
                      <Input
                        type="date"
                        value={clienteSelezionato.dataNascita ?? ""}
                        onChange={(event) => aggiornaCliente(clienteSelezionato.id, "dataNascita", event.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatBox label="Certificati" value={sommarioCliente.certificati} compact />
                  <StatBox label="Giorni malattia" value={sommarioCliente.giorniMalattia} compact />
                  <StatBox label="Malattie attive" value={sommarioCliente.malattieAttive} compact />
                  <StatBox
                    label="Scoperti"
                    value={`${sommarioCliente.periodiScoperti} / ${sommarioCliente.giorniScoperti} gg`}
                    compact
                  />
                </div>

                <div className="rounded-md border border-border bg-white p-4">
                  <h3 className="text-sm font-semibold text-foreground">Pratiche attive e sinistri</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {praticheCliente.length > 0 ? praticheCliente.map((pratica) => (
                      <div key={pratica.id} className="rounded-md border border-border bg-muted/20 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">Sinistro</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Aperta</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => eliminaPratica(pratica.id)}
                              title="Elimina pratica"
                              aria-label={`Elimina pratica ${pratica.numeroSinistro}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="Compagnia">
                            <Input
                              value={pratica.compagnia}
                              onChange={(event) => aggiornaPratica(pratica.id, "compagnia", event.target.value)}
                            />
                          </Field>
                          <Field label="Numero sinistro">
                            <Input
                              value={pratica.numeroSinistro}
                              onChange={(event) => aggiornaPratica(pratica.id, "numeroSinistro", event.target.value)}
                            />
                          </Field>
                          <Field label="Data sinistro">
                            <Input
                              type="date"
                              value={pratica.dataSinistro}
                              onChange={(event) => aggiornaPratica(pratica.id, "dataSinistro", event.target.value)}
                            />
                          </Field>
                          <Field label="Stato">
                            <Select
                              value={pratica.stato}
                              onValueChange={(value: PraticaSinistro["stato"]) =>
                                aggiornaPratica(pratica.id, "stato", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aperta">Aperta</SelectItem>
                                <SelectItem value="chiusa">Chiusa</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <div className="md:col-span-2">
                            <Field label="Referente / legale">
                              <Input
                                value={pratica.referente}
                                onChange={(event) => aggiornaPratica(pratica.id, "referente", event.target.value)}
                              />
                            </Field>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
                        Nessuna pratica attiva per questo cliente.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-md border border-dashed border-border bg-muted/10 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">Aggiungi pratica / sinistro</h4>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Compagnia">
                        <Input
                          value={nuovaPratica.compagnia}
                          onChange={(event) =>
                            setNuovaPratica((current) => ({ ...current, compagnia: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Numero sinistro">
                        <Input
                          value={nuovaPratica.numeroSinistro}
                          onChange={(event) =>
                            setNuovaPratica((current) => ({ ...current, numeroSinistro: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Data sinistro">
                        <Input
                          type="date"
                          value={nuovaPratica.dataSinistro}
                          onChange={(event) =>
                            setNuovaPratica((current) => ({ ...current, dataSinistro: event.target.value }))
                          }
                        />
                      </Field>
                      <div className="flex items-end">
                        <Button type="button" onClick={creaPraticaCliente} className="w-full gap-2">
                          <Plus className="h-4 w-4" />
                          Aggiungi
                        </Button>
                      </div>
                      <div className="md:col-span-2 xl:col-span-4">
                        <Field label="Referente / legale">
                          <Input
                            value={nuovaPratica.referente}
                            onChange={(event) =>
                              setNuovaPratica((current) => ({ ...current, referente: event.target.value }))
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-white p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Nuovo certificato</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <Field label="Pratica">
                      <Select
                        value={nuovoCertificato.praticaId}
                        disabled={praticheCliente.length === 0}
                        onValueChange={(value) =>
                          setNuovoCertificato((current) => ({ ...current, praticaId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona pratica" />
                        </SelectTrigger>
                        <SelectContent>
                          {praticheCliente.map((pratica) => (
                            <SelectItem key={pratica.id} value={pratica.id}>
                              {pratica.compagnia} · {pratica.numeroSinistro}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Tipo certificato">
                      <Input
                        value={nuovoCertificato.tipo}
                        onChange={(event) =>
                          setNuovoCertificato((current) => ({ ...current, tipo: event.target.value }))
                        }
                        placeholder="Es. Continuazione"
                      />
                    </Field>
                    <Field label="Emissione">
                      <Input
                        type="date"
                        value={nuovoCertificato.emissione}
                        onChange={(event) => {
                          const emissione = event.target.value;
                          setNuovoCertificato((current) => ({
                            ...current,
                            emissione,
                            scadenza: emissione
                              ? addDays(emissione, Math.max(0, Number(current.prognosiGiorni) || 0))
                              : current.scadenza,
                          }));
                        }}
                      />
                    </Field>
                    <Field label="Prognosi">
                      <Input
                        type="number"
                        min={0}
                        value={nuovoCertificato.prognosiGiorni}
                        onChange={(event) => {
                          const prognosiGiorni = event.target.value;
                          setNuovoCertificato((current) => ({
                            ...current,
                            prognosiGiorni,
                            scadenza: current.emissione
                              ? addDays(current.emissione, Math.max(0, Number(prognosiGiorni) || 0))
                              : current.scadenza,
                          }));
                        }}
                      />
                    </Field>
                    <Field label="Scadenza">
                      <Input
                        type="date"
                        value={nuovoCertificato.scadenza}
                        onChange={(event) =>
                          setNuovoCertificato((current) => ({ ...current, scadenza: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Stato">
                      <Select
                        value={nuovoCertificato.stato}
                        onValueChange={(value: StatoCertificato) =>
                          setNuovoCertificato((current) => ({ ...current, stato: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="caricato">Caricato</SelectItem>
                          <SelectItem value="da-caricare">Da caricare</SelectItem>
                          <SelectItem value="in-scadenza">In scadenza</SelectItem>
                          <SelectItem value="scaduto">Scaduto</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="md:col-span-2 xl:col-span-5">
                      <Field label="Note">
                        <Textarea
                          value={nuovoCertificato.note}
                          onChange={(event) =>
                            setNuovoCertificato((current) => ({ ...current, note: event.target.value }))
                          }
                          className="min-h-10"
                        />
                      </Field>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={creaCertificatoCliente}
                        disabled={praticheCliente.length === 0}
                        className="w-full gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Inserisci
                      </Button>
                    </div>
                  </div>
                </div>

                <CertificatiTable
                  certificati={certificatiCliente}
                  pratiche={pratiche}
                  onUpdate={aggiornaCertificato}
                  onUpload={uploadCertificato}
                  onDownload={downloadCertificato}
                  onDownloadAll={() =>
                    scaricaCertificati(certificatiCliente, `${clienteSelezionato.nome}-certificati`)
                  }
                />

                <div className="rounded-md border border-border bg-white p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-foreground">Periodi di malattia scoperti</h3>
                  </div>
                  {periodiScoperti.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {periodiScoperti.map((periodo) => (
                        <div key={`${periodo.pratica.id}-${periodo.dal}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          {periodo.pratica.compagnia} · sinistro {periodo.pratica.numeroSinistro}: scoperto dal{" "}
                          {formatData(periodo.dal)} al {formatData(periodo.al)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Nessun buco tra i certificati inseriti.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scadenze" className="space-y-4">
          <section className="rounded-md border border-border bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Scadenze certificati</h2>
                  <p className="text-sm text-muted-foreground">
                    Certificati delle pratiche attive ordinati per scadenza, con upload e download rapidi.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => scaricaCertificati(certificatiPraticheAttive, "tutti-certificati-attivi")}
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica tutti
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Sinistro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificatiInScadenza.map(({ certificato, cliente, giorni }) => (
                  <TableRow key={certificato.id}>
                    <TableCell className="font-medium">{cliente?.nome ?? "Cliente"}</TableCell>
                    <TableCell className="min-w-[210px]">
                      <Select
                        value={certificato.praticaId}
                        onValueChange={(value) => aggiornaCertificato(certificato.id, "praticaId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pratiche
                            .filter((item) => item.clienteId === certificato.clienteId && isPraticaAttiva(item))
                            .map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.compagnia} · {item.numeroSinistro}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Input
                        value={certificato.tipo}
                        onChange={(event) => aggiornaCertificato(certificato.id, "tipo", event.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={certificato.scadenza}
                        onChange={(event) => aggiornaCertificato(certificato.id, "scadenza", event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {giorni < 0 ? `Scaduto da ${Math.abs(giorni)} giorni` : `Tra ${giorni} giorni`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={certificato.stato}
                        onValueChange={(value: StatoCertificato) =>
                          aggiornaCertificato(certificato.id, "stato", value)
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="caricato">Caricato</SelectItem>
                          <SelectItem value="da-caricare">Da caricare</SelectItem>
                          <SelectItem value="in-scadenza">In scadenza</SelectItem>
                          <SelectItem value="scaduto">Scaduto</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <UploadButton certificato={certificato} onUpload={uploadCertificato} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => downloadCertificato(certificato)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="nuovo" className="space-y-4">
          <section className="rounded-md border border-border bg-white p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Nuovo sinistro</h2>
                <p className="text-sm text-muted-foreground">
                  Inserimento rapido quando arriva un cliente che ha avuto un sinistro.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Cliente">
                <Input value={nuovoSinistro.nome} onChange={(event) => setNuovoSinistro((current) => ({ ...current, nome: event.target.value }))} />
              </Field>
              <Field label="Codice fiscale">
                <Input value={nuovoSinistro.codiceFiscale} onChange={(event) => setNuovoSinistro((current) => ({ ...current, codiceFiscale: event.target.value }))} />
              </Field>
              <Field label="Telefono">
                <Input value={nuovoSinistro.telefono} onChange={(event) => setNuovoSinistro((current) => ({ ...current, telefono: event.target.value }))} />
              </Field>
              <Field label="Email">
                <Input type="email" value={nuovoSinistro.email} onChange={(event) => setNuovoSinistro((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <Field label="Indirizzo">
                <Input value={nuovoSinistro.indirizzo} onChange={(event) => setNuovoSinistro((current) => ({ ...current, indirizzo: event.target.value }))} />
              </Field>
              <Field label="Luogo nascita">
                <Input value={nuovoSinistro.luogoNascita} onChange={(event) => setNuovoSinistro((current) => ({ ...current, luogoNascita: event.target.value }))} />
              </Field>
              <Field label="Data nascita">
                <Input type="date" value={nuovoSinistro.dataNascita} onChange={(event) => setNuovoSinistro((current) => ({ ...current, dataNascita: event.target.value }))} />
              </Field>
              <Field label="Compagnia assicurativa">
                <Input value={nuovoSinistro.compagnia} onChange={(event) => setNuovoSinistro((current) => ({ ...current, compagnia: event.target.value }))} />
              </Field>
              <Field label="Numero sinistro">
                <Input value={nuovoSinistro.numeroSinistro} onChange={(event) => setNuovoSinistro((current) => ({ ...current, numeroSinistro: event.target.value }))} />
              </Field>
              <Field label="Data sinistro">
                <Input type="date" value={nuovoSinistro.dataSinistro} onChange={(event) => setNuovoSinistro((current) => ({ ...current, dataSinistro: event.target.value }))} />
              </Field>
              <Field label="Referente / legale">
                <Input value={nuovoSinistro.referente} onChange={(event) => setNuovoSinistro((current) => ({ ...current, referente: event.target.value }))} />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={creaSinistro} className="gap-2">
                <Plus className="h-4 w-4" />
                Crea cliente e sinistro
              </Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className={`rounded-md border border-border bg-white ${compact ? "p-3" : "p-4"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`${compact ? "mt-1 text-xl" : "mt-2 text-2xl"} font-semibold text-foreground`}>{value}</p>
    </div>
  );
}

function CertificatiTable({
  certificati,
  pratiche,
  onUpdate,
  onUpload,
  onDownload,
  onDownloadAll,
}: {
  certificati: CertificatoSinistro[];
  pratiche: PraticaSinistro[];
  onUpdate: <K extends keyof CertificatoSinistro>(id: string, field: K, value: CertificatoSinistro[K]) => void;
  onUpload: (id: string, file: File | undefined) => void | Promise<void>;
  onDownload: (certificato: CertificatoSinistro) => void;
  onDownloadAll: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Certificati</h3>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onDownloadAll} disabled={certificati.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Scarica certificati
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1120px]">
          <TableHeader>
            <TableRow>
              <TableHead>Pratica</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Emissione</TableHead>
              <TableHead>Prognosi</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificati.map((certificato) => {
              const praticheCliente = pratiche.filter(
                (item) => item.clienteId === certificato.clienteId && isPraticaAttiva(item),
              );
              const giorni = giorniAllaScadenza(certificato.scadenza);
              return (
                <TableRow key={certificato.id}>
                  <TableCell className="min-w-[210px]">
                    <Select
                      value={certificato.praticaId}
                      onValueChange={(value) => onUpdate(certificato.id, "praticaId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {praticheCliente.map((pratica) => (
                          <SelectItem key={pratica.id} value={pratica.id}>
                            {pratica.compagnia} · {pratica.numeroSinistro}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-[190px]">
                    <Input
                      value={certificato.tipo}
                      onChange={(event) => onUpdate(certificato.id, "tipo", event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={certificato.emissione}
                      onChange={(event) => onUpdate(certificato.id, "emissione", event.target.value)}
                    />
                  </TableCell>
                  <TableCell className="w-28">
                    <Input
                      type="number"
                      min={0}
                      value={certificato.prognosiGiorni}
                      onChange={(event) => onUpdate(certificato.id, "prognosiGiorni", Number(event.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={certificato.scadenza}
                      onChange={(event) => onUpdate(certificato.id, "scadenza", event.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {giorni < 0 ? `Scaduto da ${Math.abs(giorni)} giorni` : `Tra ${giorni} giorni`}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={certificato.stato}
                      onValueChange={(value: StatoCertificato) => onUpdate(certificato.id, "stato", value)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caricato">Caricato</SelectItem>
                        <SelectItem value="da-caricare">Da caricare</SelectItem>
                        <SelectItem value="in-scadenza">In scadenza</SelectItem>
                        <SelectItem value="scaduto">Scaduto</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <UploadButton certificato={certificato} onUpload={onUpload} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => onDownload(certificato)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1 max-w-[160px] truncate text-xs text-muted-foreground">
                      {certificato.fileName ?? "Nessun file"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <Textarea
                      value={certificato.note}
                      onChange={(event) => onUpdate(certificato.id, "note", event.target.value)}
                      className="min-h-10"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UploadButton({
  certificato,
  onUpload,
}: {
  certificato: CertificatoSinistro;
  onUpload: (id: string, file: File | undefined) => void | Promise<void>;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={(event) => onUpload(certificato.id, event.target.files?.[0])}
      />
      <Button type="button" variant="ghost" size="icon" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" />
      </Button>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
