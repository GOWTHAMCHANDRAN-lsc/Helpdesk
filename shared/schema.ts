import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("employee").notNull(), // employee, admin, super_admin
  department: varchar("department"), // IT Support, HR, Finance, Operations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enums
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress", 
  "resolved",
  "closed"
]);

export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Target systems table
export const targetSystems = pgTable("target_systems", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tickets table
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number").unique().notNull(),
  subject: varchar("subject").notNull(),
  description: text("description").notNull(),
  priority: priorityEnum("priority").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  departmentId: integer("department_id").references(() => departments.id).notNull(),
  targetSystemId: integer("target_system_id").references(() => targetSystems.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
});

// Ticket messages/chat
export const ticketMessages = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// File attachments
export const ticketAttachments = pgTable("ticket_attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  messageId: integer("message_id").references(() => ticketMessages.id),
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path").notNull(),
  uploadedById: varchar("uploaded_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdTickets: many(tickets, { relationName: "created_tickets" }),
  assignedTickets: many(tickets, { relationName: "assigned_tickets" }),
  messages: many(ticketMessages),
  attachments: many(ticketAttachments),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tickets.createdById],
    references: [users.id],
    relationName: "created_tickets",
  }),
  assignedTo: one(users, {
    fields: [tickets.assignedToId],
    references: [users.id],
    relationName: "assigned_tickets",
  }),
  company: one(companies, {
    fields: [tickets.companyId],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [tickets.departmentId],
    references: [departments.id],
  }),
  targetSystem: one(targetSystems, {
    fields: [tickets.targetSystemId],
    references: [targetSystems.id],
  }),
  messages: many(ticketMessages),
  attachments: many(ticketAttachments),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  tickets: many(tickets),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  tickets: many(tickets),
  targetSystems: many(targetSystems),
}));

export const targetSystemsRelations = relations(targetSystems, ({ one, many }) => ({
  department: one(departments, {
    fields: [targetSystems.departmentId],
    references: [departments.id],
  }),
  tickets: many(tickets),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [ticketMessages.ticketId],
    references: [tickets.id],
  }),
  sender: one(users, {
    fields: [ticketMessages.senderId],
    references: [users.id],
  }),
  attachments: many(ticketAttachments),
}));

export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketAttachments.ticketId],
    references: [tickets.id],
  }),
  message: one(ticketMessages, {
    fields: [ticketAttachments.messageId],
    references: [ticketMessages.id],
  }),
  uploadedBy: one(users, {
    fields: [ticketAttachments.uploadedById],
    references: [users.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type TargetSystem = typeof targetSystems.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type InsertDepartment = typeof departments.$inferInsert;
export type InsertTargetSystem = typeof targetSystems.$inferInsert;
export type InsertTicket = typeof tickets.$inferInsert;
export type InsertTicketMessage = typeof ticketMessages.$inferInsert;
export type InsertTicketAttachment = typeof ticketAttachments.$inferInsert;

// Extended types for API responses
export type TicketWithRelations = Ticket & {
  createdBy: User;
  assignedTo?: User;
  company: Company;
  department: Department;
  targetSystem: TargetSystem;
  messages: (TicketMessage & { sender: User; attachments: TicketAttachment[] })[];
  attachments: TicketAttachment[];
};

export type TicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
};
