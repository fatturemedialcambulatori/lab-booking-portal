import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const infortunisticaCertificatiFilesTable = pgTable("infortunistica_certificati_files", {
  certificatoId: text("certificato_id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  praticaId: text("pratica_id").notNull(),
  bucket: text("bucket").notNull(),
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export type InfortunisticaCertificatoFile = typeof infortunisticaCertificatiFilesTable.$inferSelect;
