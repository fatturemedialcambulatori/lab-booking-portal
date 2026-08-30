import { pgTable, text, serial, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  codiceAnalisi: text("codice_analisi").notNull(),
  descrizione: text("descrizione").notNull(),
  colorProvetta: text("color_provetta"),
  synlab: boolean("synlab").notNull().default(false),
  um: text("um"),
  metodo: text("metodo"),
  regola: text("regola"),
  importo: numeric("importo", { precision: 10, scale: 2 }),
  valoreRiferimento: text("valore_riferimento"),
  preparationInstructions: text("preparation_instructions").notNull().default(""),
  tipo: text("tipo").notNull().default("singolo"),
});

export const insertExamSchema = createInsertSchema(examsTable).omit({ id: true });
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof examsTable.$inferSelect;
