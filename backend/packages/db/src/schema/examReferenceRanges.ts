import { pgTable, serial, integer, text, numeric, jsonb } from "drizzle-orm/pg-core";
import { examsTable } from "./exams";

export type Fascia = {
  label: string;
  min?: number;
  minOp?: ">=" | ">";
  max?: number;
  maxOp?: "<" | "<=";
  color?: "green" | "yellow" | "orange" | "red";
  nota?: string;
};

export const examReferenceRangesTable = pgTable("exam_reference_ranges", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),

  gender: text("gender"),             // 'M', 'F', null = entrambi
  ageMin: integer("age_min"),         // in anni, null = nessun limite inferiore
  ageMax: integer("age_max"),         // in anni, null = nessun limite superiore
  statoFisiologico: text("stato_fisiologico"),  // 'gravidanza', null = standard

  tipo: text("tipo").notNull().default("range"),  // 'range' | 'gt' | 'gte' | 'lt' | 'lte' | 'qualitative' | 'fasce'

  valoreMin: numeric("valore_min"),   // per tipo 'range', 'gt', 'gte'
  valoreMax: numeric("valore_max"),   // per tipo 'range', 'lt', 'lte'

  valoriAccettabili: text("valori_accettabili"),  // per tipo 'qualitative', es. "Negativo,Assente"

  fasce: jsonb("fasce").$type<Fascia[]>(),  // per tipo 'fasce'

  unita: text("unita"),   // sovrascrive l'UM dell'esame per questo range
  note: text("note"),
  ordinamento: integer("ordinamento").notNull().default(0),
});

export type ExamReferenceRange = typeof examReferenceRangesTable.$inferSelect;
