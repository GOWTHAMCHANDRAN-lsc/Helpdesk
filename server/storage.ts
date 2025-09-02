import {
  users,
  companies,
  departments,
  targetSystems,
  tickets,
  ticketMessages,
  ticketAttachments,
  type User,
  type UpsertUser,
  type Company,
  type Department,
  type TargetSystem,
  type Ticket,
  type TicketMessage,
  type TicketAttachment,
  type InsertCompany,
  type InsertDepartment,
  type InsertTargetSystem,
  type InsertTicket,
  type InsertTicketMessage,
  type InsertTicketAttachment,
  type TicketWithRelations,
  type TicketStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Company operations
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  
  // Department operations
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  
  // Target system operations
  getTargetSystems(): Promise<TargetSystem[]>;
  getTargetSystemsByDepartment(departmentId: number): Promise<TargetSystem[]>;
  createTargetSystem(targetSystem: InsertTargetSystem): Promise<TargetSystem>;
  
  // Ticket operations
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTickets(filters?: {
    userId?: string;
    departmentId?: number;
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<TicketWithRelations[]>;
  getTicketById(id: number): Promise<TicketWithRelations | undefined>;
  updateTicketStatus(id: number, status: string, userId: string): Promise<Ticket>;
  assignTicket(id: number, assignedToId: string): Promise<Ticket>;
  getTicketStats(userId?: string, departmentId?: number): Promise<TicketStats>;
  
  // Message operations
  createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage>;
  getTicketMessages(ticketId: number): Promise<(TicketMessage & { sender: User })[]>;
  
  // Attachment operations
  createTicketAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment>;
  getTicketAttachments(ticketId: number): Promise<TicketAttachment[]>;
  
  // User management
  getUsersByDepartment(department: string): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData as any)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: (userData as any).email ?? null,
          firstName: (userData as any).firstName ?? null,
          lastName: (userData as any).lastName ?? null,
          profileImageUrl: (userData as any).profileImageUrl ?? null,
          role: (userData as any).role ?? users.role,
          department: (userData as any).department ?? null,
          updatedAt: new Date(),
        } as any,
      })
      .returning();
    return user;
  }

  // Company operations
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  // Department operations
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }

  // Target system operations
  async getTargetSystems(): Promise<TargetSystem[]> {
    return await db.select().from(targetSystems).orderBy(targetSystems.name);
  }

  async getTargetSystemsByDepartment(departmentId: number): Promise<TargetSystem[]> {
    return await db
      .select()
      .from(targetSystems)
      .where(eq(targetSystems.departmentId, departmentId))
      .orderBy(targetSystems.name);
  }

  async createTargetSystem(targetSystem: InsertTargetSystem): Promise<TargetSystem> {
    const [newTargetSystem] = await db.insert(targetSystems).values(targetSystem).returning();
    return newTargetSystem;
  }

  // Ticket operations
  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    // Generate ticket number
    const count = await db.select({ count: sql<number>`count(*)` }).from(tickets);
    const ticketNumber = `HD-${String(count[0].count + 1).padStart(6, '0')}`;
    
    const [newTicket] = await db
      .insert(tickets)
      .values({ ...ticket, ticketNumber } as any)
      .returning();
    return newTicket;
  }

  async getTickets(filters?: {
    userId?: string;
    departmentId?: number;
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<TicketWithRelations[]> {
    // Get all tickets first
    const allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
    
    const transformedResults: TicketWithRelations[] = [];
    
    for (const ticket of allTickets) {
      // Get related data for each ticket
      const [createdBy] = await db.select().from(users).where(eq(users.id, ticket.createdById));
      const [company] = await db.select().from(companies).where(eq(companies.id, ticket.companyId));
      const [department] = await db.select().from(departments).where(eq(departments.id, ticket.departmentId));
      const [targetSystem] = await db.select().from(targetSystems).where(eq(targetSystems.id, ticket.targetSystemId));
      
      let assignedTo = undefined;
      if (ticket.assignedToId) {
        const [assigned] = await db.select().from(users).where(eq(users.id, ticket.assignedToId));
        assignedTo = assigned;
      }
      
      const messages = await this.getTicketMessages(ticket.id);
      const attachments = await this.getTicketAttachments(ticket.id);
      
      const ticketWithRelations: TicketWithRelations = {
        ...ticket,
        createdBy: createdBy!,
        assignedTo,
        company: company!,
        department: department!,
        targetSystem: targetSystem!,
        messages,
        attachments,
      };
      
      // Apply filters
      let include = true;
      if (filters?.userId && ticket.createdById !== filters.userId) include = false;
      // Special logic: if departmentId is 1 or 2, include both 1 and 2
      if (filters?.departmentId) {
        if ((filters.departmentId === 1 || filters.departmentId === 2)) {
          if (!(ticket.departmentId === 1 || ticket.departmentId === 2)) include = false;
        } else {
          if (ticket.departmentId !== filters.departmentId) include = false;
        }
      }
      if (filters?.status && ticket.status !== filters.status) include = false;
      if (filters?.priority && ticket.priority !== filters.priority) include = false;
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          ticket.subject.toLowerCase().includes(searchLower) ||
          ticket.description.toLowerCase().includes(searchLower) ||
          ticket.ticketNumber.toLowerCase().includes(searchLower);
        if (!matchesSearch) include = false;
      }
      
      if (include) {
        transformedResults.push(ticketWithRelations);
      }
    }
    
    return transformedResults;
  }

  async getTicketById(id: number): Promise<TicketWithRelations | undefined> {
    const tickets = await this.getTickets();
    return tickets.find(ticket => ticket.id === id);
  }

  async updateTicketStatus(id: number, status: string, userId: string): Promise<Ticket> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    } else if (status === 'closed') {
      updateData.closedAt = new Date();
    }

    const [updatedTicket] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, id))
      .returning();
    return updatedTicket;
  }

  async assignTicket(id: number, assignedToId: string): Promise<Ticket> {
    const [updatedTicket] = await db
      .update(tickets)
      .set({ assignedToId, updatedAt: new Date() } as any)
      .where(eq(tickets.id, id))
      .returning();
    return updatedTicket;
  }

  async getTicketStats(userId?: string, departmentId?: number): Promise<TicketStats> {
    const allTickets = await db.select().from(tickets);

    const stats = {
      total: allTickets.length,
      open: allTickets.filter(t => t.status === 'open').length,
      inProgress: allTickets.filter(t => t.status === 'in_progress').length,
      resolved: allTickets.filter(t => t.status === 'resolved').length,
      closed: allTickets.filter(t => t.status === 'closed').length,
    };

    return stats;
  }

  // Message operations
  async createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage> {
    const [newMessage] = await db.insert(ticketMessages).values(message as any).returning();
    return newMessage;
  }

  async getTicketMessages(ticketId: number): Promise<(TicketMessage & { sender: User; attachments: TicketAttachment[] })[]> {
    const messages = await db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);

    const result = [];
    for (const message of messages) {
      const [sender] = await db.select().from(users).where(eq(users.id, message.senderId));
      const attachments = await db
        .select()
        .from(ticketAttachments)
        .where(eq(ticketAttachments.messageId, message.id));

      result.push({
        ...message,
        sender: sender!,
        attachments: attachments || [],
      });
    }

    return result;
  }

  // Attachment operations
  async createTicketAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment> {
    const [newAttachment] = await db.insert(ticketAttachments).values(attachment as any).returning();
    return newAttachment;
  }

  async getTicketAttachments(ticketId: number): Promise<TicketAttachment[]> {
    return await db
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId))
      .orderBy(ticketAttachments.createdAt);
  }

  // User management
  async getUsersByDepartment(department: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.department, department))
      .orderBy(users.firstName, users.lastName);
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ role, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
}

export const storage = new DatabaseStorage();
