import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings";
import { examsTable } from "./exams";

export const refertiTable = pgTable("referti", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  examId: integer("exam_id").notNull().references(() => examsTable.id),
  valore: text("valore").notNull(),
  note: text("note"),
  refertataAt: timestamp("refertata_at").notNull().defaultNow(),
}, (t) => [unique("referti_booking_exam_unique").on(t.bookingId, t.examId)]);
