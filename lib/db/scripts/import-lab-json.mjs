import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const sourceArgIndex = process.argv.findIndex((arg) => arg === "--source");
const sourceDir = sourceArgIndex >= 0
  ? process.argv[sourceArgIndex + 1]
  : "/Users/antonioamodio/Downloads";

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL mancante. Esegui: set -a; source ../../.env; set +a");
}

const cleanDatabaseUrl = rawDatabaseUrl.replace(/^(['"])(.*)\1$/, "$2");
const databaseUrl = new URL(cleanDatabaseUrl);
databaseUrl.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const readRows = (name) => {
  const file = path.join(sourceDir, `${name}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data)) {
    throw new Error(`${file} deve contenere un array JSON`);
  }
  return data;
};

const toDate = (value) => value ? String(value).slice(0, 10) : null;
const toNullable = (value) => value === undefined || value === "" ? null : value;
const toBool = (value) => value === true || value === "true";

const placeholders = (count, offset = 1) =>
  Array.from({ length: count }, (_, index) => `$${index + offset}`).join(", ");

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const upsertById = async (client, table, columns, row) => {
  const values = columns.map((column) => row[column]);
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  await client.query(
    `
      insert into public.${table} (${columns.join(", ")})
      values (${placeholders(columns.length)})
      on conflict (id) do update set ${updates}
    `,
    values,
  );
};

const batchUpsertById = async (client, table, columns, rows, batchSize = 200) => {
  if (rows.length === 0) return;

  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  for (const batch of chunk(rows, batchSize)) {
    const values = batch.flatMap((row) => columns.map((column) => row[column]));
    const rowPlaceholders = batch.map((_, rowIndex) => {
      const offset = rowIndex * columns.length + 1;
      return `(${placeholders(columns.length, offset)})`;
    });

    await client.query(
      `
        insert into public.${table} (${columns.join(", ")})
        values ${rowPlaceholders.join(", ")}
        on conflict (id) do update set ${updates}
      `,
      values,
    );
  }
};

const setSequenceToMax = async (client, table) => {
  await client.query(
    `
      select setval(
        pg_get_serial_sequence('public.${table}', 'id'),
        greatest((select coalesce(max(id), 1) from public.${table}), 1),
        true
      )
    `,
  );
};

const importPatients = async (client, rows, summary) => {
  await setSequenceToMax(client, "patients");

  for (const row of rows) {
    const existingById = await client.query(
      "select id, first_name, last_name, email, codice_fiscale from public.patients where id = $1",
      [row.id],
    );

    const email = String(row.email ?? "").trim();
    const codiceFiscale = String(row.codice_fiscale ?? "").trim().toUpperCase();
    const matches = await client.query(
      `
        select id from public.patients
        where ($1 <> '' and lower(email) = lower($1))
           or ($2 <> '' and upper(coalesce(codice_fiscale, '')) = upper($2))
        order by id
        limit 1
      `,
      [email, codiceFiscale],
    );

    if (matches.rowCount > 0) {
      summary.patientsSkippedExisting += 1;
      continue;
    }

    const base = {
      record_type: "privato",
      first_name: String(row.first_name ?? "").trim() || "Paziente",
      last_name: String(row.last_name ?? "").trim() || "Importato",
      date_of_birth: toDate(row.date_of_birth) ?? "1900-01-01",
      codice_fiscale: toNullable(codiceFiscale),
      gender: toNullable(row.gender),
      company_name: null,
      vat_number: null,
      contact_person: null,
      convention_active: false,
      convention_expires_at: null,
      convention_text: null,
      convention_services: null,
      linked_convention_ids: null,
      email,
      phone: String(row.phone ?? "").trim(),
      notes: toNullable(row.notes),
      billing_address: toNullable(row.billing_address),
      billing_cap: toNullable(row.billing_cap),
      billing_city: toNullable(row.billing_city),
      billing_provincia: toNullable(row.billing_provincia),
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };

    const canKeepId = existingById.rowCount === 0;
    const columns = [
      ...(canKeepId ? ["id"] : []),
      "record_type",
      "first_name",
      "last_name",
      "date_of_birth",
      "codice_fiscale",
      "gender",
      "company_name",
      "vat_number",
      "contact_person",
      "convention_active",
      "convention_expires_at",
      "convention_text",
      "convention_services",
      "linked_convention_ids",
      "email",
      "phone",
      "notes",
      "billing_address",
      "billing_cap",
      "billing_city",
      "billing_provincia",
      "created_at",
    ];
    const values = columns.map((column) => column === "id" ? row.id : base[column]);

    await client.query(
      `insert into public.patients (${columns.join(", ")}) values (${placeholders(columns.length)})`,
      values,
    );

    summary.patientsInserted += 1;
    if (!canKeepId) summary.patientsInsertedWithNewId += 1;
  }

  await setSequenceToMax(client, "patients");
};

const importAll = async () => {
  const rows = {
    patients: readRows("patients"),
    exams: readRows("exams"),
    bookings: readRows("bookings"),
    bookingExams: readRows("booking_exams"),
    referti: readRows("referti"),
    examComponents: readRows("exam_components"),
    examReferenceRanges: readRows("exam_reference_ranges"),
  };

  const summary = {
    patientsInserted: 0,
    patientsInsertedWithNewId: 0,
    patientsSkippedExisting: 0,
    exams: rows.exams.length,
    bookings: rows.bookings.length,
    bookingExams: rows.bookingExams.length,
    referti: rows.referti.length,
    examComponents: rows.examComponents.length,
    examReferenceRanges: rows.examReferenceRanges.length,
  };

  const client = await pool.connect();
  try {
    await client.query("begin");

    await importPatients(client, rows.patients, summary);

    await batchUpsertById(client, "exams", [
        "id",
        "codice_analisi",
        "descrizione",
        "color_provetta",
        "synlab",
        "um",
        "metodo",
        "regola",
        "importo",
        "valore_riferimento",
        "preparation_instructions",
        "tipo",
      ], rows.exams.map((row) => ({
        id: row.id,
        codice_analisi: row.codice_analisi,
        descrizione: row.descrizione,
        color_provetta: toNullable(row.color_provetta),
        synlab: toBool(row.synlab),
        um: toNullable(row.um),
        metodo: toNullable(row.metodo),
        regola: toNullable(row.regola),
        importo: toNullable(row.importo),
        valore_riferimento: toNullable(row.valore_riferimento),
        preparation_instructions: row.preparation_instructions ?? "",
        tipo: row.tipo ?? "singolo",
      })));

    await batchUpsertById(client, "bookings", [
        "id",
        "date",
        "time",
        "first_name",
        "last_name",
        "date_of_birth",
        "codice_fiscale",
        "gender",
        "email",
        "phone",
        "notes",
        "status",
        "created_at",
      ], rows.bookings.map((row) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        first_name: row.first_name,
        last_name: row.last_name,
        date_of_birth: row.date_of_birth,
        codice_fiscale: toNullable(row.codice_fiscale),
        gender: toNullable(row.gender),
        email: row.email ?? "",
        phone: row.phone ?? "",
        notes: toNullable(row.notes),
        status: row.status ?? "confirmed",
        created_at: row.created_at ? new Date(row.created_at) : new Date(),
      })));

    await batchUpsertById(client, "booking_exams", [
        "id",
        "booking_id",
        "exam_id",
      ], rows.bookingExams.map((row) => ({
        id: row.id,
        booking_id: row.booking_id,
        exam_id: row.exam_id,
      })));

    await batchUpsertById(client, "exam_components", [
        "id",
        "package_exam_id",
        "component_exam_id",
        "ordinamento",
      ], rows.examComponents.map((row) => ({
        id: row.id,
        package_exam_id: row.package_exam_id,
        component_exam_id: row.component_exam_id,
        ordinamento: row.ordinamento ?? 0,
      })));

    await batchUpsertById(client, "exam_reference_ranges", [
        "id",
        "exam_id",
        "gender",
        "age_min",
        "age_max",
        "stato_fisiologico",
        "tipo",
        "valore_min",
        "valore_max",
        "valori_accettabili",
        "fasce",
        "unita",
        "note",
        "ordinamento",
      ], rows.examReferenceRanges.map((row) => ({
        id: row.id,
        exam_id: row.exam_id,
        gender: toNullable(row.gender),
        age_min: row.age_min,
        age_max: row.age_max,
        stato_fisiologico: toNullable(row.stato_fisiologico),
        tipo: row.tipo ?? "range",
        valore_min: toNullable(row.valore_min),
        valore_max: toNullable(row.valore_max),
        valori_accettabili: toNullable(row.valori_accettabili),
        fasce: row.fasce == null ? null : JSON.stringify(row.fasce),
        unita: toNullable(row.unita),
        note: toNullable(row.note),
        ordinamento: row.ordinamento ?? 0,
      })));

    await batchUpsertById(client, "referti", [
        "id",
        "booking_id",
        "exam_id",
        "parent_exam_id",
        "valore",
        "note",
        "refertata_at",
      ], rows.referti.map((row) => ({
        id: row.id,
        booking_id: row.booking_id,
        exam_id: row.exam_id,
        parent_exam_id: row.parent_exam_id,
        valore: row.valore,
        note: toNullable(row.note),
        refertata_at: row.refertata_at ? new Date(row.refertata_at) : new Date(),
      })));

    for (const table of [
      "exams",
      "bookings",
      "booking_exams",
      "referti",
      "exam_components",
      "exam_reference_ranges",
    ]) {
      await setSequenceToMax(client, table);
    }

    if (apply) {
      await client.query("commit");
      console.log("IMPORT APPLICATO");
    } else {
      await client.query("rollback");
      console.log("DRY RUN OK - nessuna modifica salvata. Usa --apply per importare.");
    }

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

await importAll();
