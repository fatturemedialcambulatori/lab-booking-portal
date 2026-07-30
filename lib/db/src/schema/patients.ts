import { boolean, pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  recordType: text("record_type").notNull().default("privato"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  codiceFiscale: text("codice_fiscale"),
  gender: text("gender"),
  companyName: text("company_name"),
  vatNumber: text("vat_number"),
  contactPerson: text("contact_person"),
  conventionActive: boolean("convention_active").notNull().default(false),
  conventionExpiresAt: text("convention_expires_at"),
  conventionText: text("convention_text"),
  conventionServices: text("convention_services"),
  linkedConventionIds: text("linked_convention_ids"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  billingAddress: text("billing_address"),
  billingCap: text("billing_cap"),
  billingCity: text("billing_city"),
  billingProvincia: text("billing_provincia"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
