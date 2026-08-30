import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { examsTable } from "./exams";

export const examComponentsTable = pgTable("exam_components", {
  id: serial("id").primaryKey(),
  packageExamId: integer("package_exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),
  componentExamId: integer("component_exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),
  ordinamento: integer("ordinamento").notNull().default(0),
}, (t) => [unique("exam_components_unique").on(t.packageExamId, t.componentExamId)]);

export type ExamComponent = typeof examComponentsTable.$inferSelect;
