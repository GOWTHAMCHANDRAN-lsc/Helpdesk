import { helpdeskConnection, generateTicketNumber } from './mysqlDb';
import { HRMSUser } from './hrmsAuth';

export interface Company {
  id: number;
  name: string;
  created_at: Date | null;
}

export interface Department {
  id: number;
  name: string;
  company_id?: number | null;
  created_at: Date | null;
}

export interface TargetSystem {
  id: number;
  name: string;
  department_id: number;
  company_id?: number | null;
  created_at: Date | null;
}

export interface Ticket {
  id: number;
  // public_id removed, revert to id only
  ticket_number: string;
  company_id: number;
  department_id: number;
  target_system_id: number;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | string;
  created_by: string;
  assigned_to?: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_id: string;
  message: string;
  created_at: Date | null;
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  message_id?: number;
  file_name: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  created_at: Date | null;
}

export interface TicketWithDetails extends Ticket {
  company_name: string;
  department_name: string;
  target_system_name: string;
  created_by_name?: string;
  assigned_to_name?: string;
  messages: (TicketMessage & { sender_name?: string; attachments: TicketAttachment[] })[];
  attachments: TicketAttachment[];
}

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

function mapStatusToStandard(status: any): 'open' | 'in_progress' | 'resolved' | 'closed' | string {
  if (!status) return 'open';
  const s = String(status).toLowerCase();
  if (['open', 'opened', 'new'].includes(s)) return 'open';
  if (['in_progress', 'in-progress', 'progress', 'assigned'].includes(s)) return 'in_progress';
  if (['resolved', 'done', 'fixed'].includes(s)) return 'resolved';
  if (['closed', 'complete', 'completed'].includes(s)) return 'closed';
  return s;
}

export class MySQLStorage {
  // getTicketByPublicId removed, revert to id-based only
  async searchUserEmails(search: string): Promise<Array<{ email: string; first_name: string; last_name: string }>> {
    const params: any[] = [];
    let sql = `SELECT 
      cms_user_email AS email,
      cms_user_firstname AS first_name,
      cms_user_lastname AS last_name
    FROM cms_user_details`;
    if (search && search.trim() !== '') {
      sql += ` WHERE LOWER(cms_user_email) LIKE ? OR LOWER(cms_user_firstname) LIKE ? OR LOWER(cms_user_lastname) LIKE ?`;
      const like = `%${search.toLowerCase()}%`;
      params.push(like, like, like);
    }
    sql += ` ORDER BY cms_user_firstname, cms_user_lastname LIMIT 20`;
    const [rows] = await helpdeskConnection.execute(sql, params);
    return (rows as any[]).map(r => ({ email: r.email, first_name: r.first_name, last_name: r.last_name }));
  }
  private async ensureChatTables(): Promise<void> {
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS cms_user_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_a_id VARCHAR(255) NOT NULL,
        member_b_id VARCHAR(255) NOT NULL,
        dept_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_members (member_a_id, member_b_id)
      )`);
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS cms_user_conversation_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (conversation_id),
        CONSTRAINT fk_conv_msg_conv FOREIGN KEY (conversation_id)
          REFERENCES cms_user_conversations(id) ON DELETE CASCADE
      )`);
  }

  // Company operations
  async getCompanies(): Promise<Company[]> {
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_com_id AS id, cms_com_name AS name, cms_com_created_at AS created_at FROM cms_company_details ORDER BY cms_com_name'
    );
    return rows as Company[];
  }

  async createCompany(name: string): Promise<Company> {
    const [result] = await helpdeskConnection.execute(
      'INSERT INTO cms_company_details (cms_com_name, cms_com_created_at, cms_com_status) VALUES (?, NOW(), 1)',
      [name]
    );
    const insertId = (result as any).insertId;
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_com_id AS id, cms_com_name AS name, cms_com_created_at AS created_at FROM cms_company_details WHERE cms_com_id = ?',
      [insertId]
    );
    return (rows as Company[])[0];
  }

  // Department operations
  async getDepartments(): Promise<Department[]> {
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_dep_id AS id, cms_dep_name AS name, cms_dep_com_id AS company_id, cms_created_at AS created_at FROM cms_dep_details ORDER BY cms_dep_name'
    );
    return rows as Department[];
  }

  async createDepartment(name: string): Promise<Department> {
    const [result] = await helpdeskConnection.execute(
      'INSERT INTO cms_dep_details (cms_dep_name, cms_created_at, cms_status) VALUES (?, NOW(), 1)',
      [name]
    );
    const insertId = (result as any).insertId;
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_dep_id AS id, cms_dep_name AS name, cms_dep_com_id AS company_id, cms_created_at AS created_at FROM cms_dep_details WHERE cms_dep_id = ?',
      [insertId]
    );
    return (rows as Department[])[0];
  }

  // Target system operations
  async getTargetSystems(): Promise<TargetSystem[]> {
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_sys_id AS id, cms_sys_name AS name, cms_dep_id AS department_id, cms_comp_id AS company_id, cms_sys_created_at AS created_at FROM cms_sys_details ORDER BY cms_sys_name'
    );
    return rows as TargetSystem[];
  }

  async getTargetSystemsByDepartment(departmentId: number): Promise<TargetSystem[]> {
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_sys_id AS id, cms_sys_name AS name, cms_dep_id AS department_id, cms_comp_id AS company_id, cms_sys_created_at AS created_at FROM cms_sys_details WHERE cms_dep_id = ? ORDER BY cms_sys_name',
      [departmentId]
    );
    return rows as TargetSystem[];
  }

  async createTargetSystem(name: string, departmentId: number): Promise<TargetSystem> {
    // Try to infer company from department
    const [deptRows] = await helpdeskConnection.execute('SELECT cms_dep_com_id FROM cms_dep_details WHERE cms_dep_id = ?', [departmentId]);
    const companyId = (deptRows as any[])[0]?.cms_dep_com_id || null;
    const [result] = await helpdeskConnection.execute(
      'INSERT INTO cms_sys_details (cms_sys_name, cms_dep_id, cms_comp_id, cms_sys_created_at, cms_sys_status) VALUES (?, ?, ?, NOW(), 1)',
      [name, departmentId, companyId]
    );
    const insertId = (result as any).insertId;
    const [rows] = await helpdeskConnection.execute(
      'SELECT cms_sys_id AS id, cms_sys_name AS name, cms_dep_id AS department_id, cms_comp_id AS company_id, cms_sys_created_at AS created_at FROM cms_sys_details WHERE cms_sys_id = ?',
      [insertId]
    );
    return (rows as TargetSystem[])[0];
  }

  // Ticket operations
  async createTicket(ticket: {
    company_id: number;
    department_id: number;
    target_system_id: number;
    subject: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    created_by: string;
  }): Promise<Ticket> {
    const ticketNumber = await generateTicketNumber();

    
  // publicId removed
    const [result] = await helpdeskConnection.execute(
      `INSERT INTO cms_complaint_details (cms_com_ticket_no, cms_com_comp_id, cms_sys_dep_id, cms_sys_id, cms_com_description, cms_com_user_priority, cms_com_status, cms_user_id, cms_created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NOW())`,
      [
        ticketNumber,
        ticket.company_id,
        ticket.department_id,
        ticket.target_system_id,
        ticket.description,
        ticket.priority,
        ticket.created_by,
      ]
    );
    const insertId = (result as any).insertId;
    const [rows] = await helpdeskConnection.execute(
      'SELECT * FROM cms_complaint_details WHERE cms_com_id = ?',
      [insertId]
    );
    return (rows as Ticket[])[0];
  }

  async getTickets(filters?: {
    userId?: string;
    departmentId?: number;
    status?: string;
    priority?: string;
    search?: string;
  }, limit: number = 20, offset: number = 0): Promise<TicketWithDetails[]> {
    let query = `
      SELECT 
        t.cms_com_id AS id,
        t.cms_com_ticket_no AS ticket_number,
        t.cms_com_comp_id AS company_id,
        t.cms_sys_dep_id AS department_id,
        t.cms_sys_id AS target_system_id,
  -- t.cms_com_subject AS subject, (no such column)
        t.cms_com_description AS description,
        t.cms_com_user_priority AS priority,
        t.cms_com_status AS status,
        t.cms_user_id AS created_by,
        t.cms_sys_l1_id AS assigned_to,
        t.cms_created_at AS created_at,
        t.cms_created_at AS updated_at,
        c.cms_com_name AS company_name,
        d.cms_dep_name AS department_name,
        s.cms_sys_name AS target_system_name,
        au.cms_user_firstname AS assigned_first_name,
        au.cms_user_lastname AS assigned_last_name,
        au.cms_user_email AS assigned_email,
        au.cms_user_dep_id AS assigned_dep_id,
        cu.cms_user_firstname AS created_first_name,
        cu.cms_user_lastname AS created_last_name,
        cu.cms_user_email AS created_email,
        cu.cms_user_dep_id AS created_dep_id
      FROM cms_complaint_details t
      LEFT JOIN cms_company_details c ON t.cms_com_comp_id = c.cms_com_id
      LEFT JOIN cms_dep_details d ON t.cms_sys_dep_id = d.cms_dep_id
      LEFT JOIN cms_sys_details s ON t.cms_sys_id = s.cms_sys_id
      LEFT JOIN cms_user_details au ON au.cms_user_id = t.cms_sys_l1_id
      LEFT JOIN cms_user_details cu ON cu.cms_user_id = t.cms_user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.userId) {
      query += ' AND (t.cms_user_id = ? OR t.cms_sys_l1_id = ?)';
      params.push(filters.userId, filters.userId);
    }

    if (filters?.departmentId) {
      if (Array.isArray(filters.departmentId)) {
        query += ` AND t.cms_sys_dep_id IN (${filters.departmentId.map(() => '?').join(',')})`;
        params.push(...filters.departmentId);
      } else {
        query += ' AND t.cms_sys_dep_id = ?';
        params.push(filters.departmentId);
      }
    }

    if (filters?.status) {
      query += ' AND t.cms_com_status = ?';
      params.push(filters.status);
    }

    if (filters?.priority) {
      query += ' AND t.cms_com_user_priority = ?';
      params.push(filters.priority);
    }

    if (filters?.search) {
      query += ' AND (t.cms_com_description LIKE ? OR t.cms_com_ticket_no LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

  query += ' ORDER BY t.cms_created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await helpdeskConnection.execute(query, params);
    const ticketsRaw = rows as any[];
    const tickets: TicketWithDetails[] = ticketsRaw.map(r => ({
  id: r.id,
  ticket_number: r.ticket_number,
  company_id: r.company_id,
  department_id: r.department_id,
  target_system_id: r.target_system_id,
  subject: r.description?.split('\n')?.[0] || '',
  description: r.description,
  priority: r.priority,
  status: mapStatusToStandard(r.status),
  created_by: r.created_by,
  assigned_to: r.assigned_to,
  created_at: r.created_at,
  updated_at: r.updated_at,
  company_name: r.company_name,
  department_name: r.department_name,
  target_system_name: r.target_system_name,
  messages: [],
  attachments: [],
    }));

  // Do not fetch messages and attachments for each ticket in the list for performance

    return tickets;
  }

  async getTicketById(id: number): Promise<TicketWithDetails | null> {
    const [rows] = await helpdeskConnection.execute(
      `SELECT 
         t.cms_com_id AS id,
         t.cms_com_ticket_no AS ticket_number,
         t.cms_com_comp_id AS company_id,
         t.cms_sys_dep_id AS department_id,
         t.cms_sys_id AS target_system_id,
         t.cms_com_description AS description,
         t.cms_com_user_priority AS priority,
         t.cms_com_status AS status,
         t.cms_user_id AS created_by,
         t.cms_sys_l1_id AS assigned_to,
         t.cms_created_at AS created_at,
         t.cms_created_at AS updated_at,
         c.cms_com_name AS company_name,
         d.cms_dep_name AS department_name,
         s.cms_sys_name AS target_system_name,
         au.cms_user_firstname AS assigned_first_name,
         au.cms_user_lastname AS assigned_last_name,
         au.cms_user_email AS assigned_email,
         au.cms_user_dep_id AS assigned_dep_id,
         cu.cms_user_firstname AS created_first_name,
         cu.cms_user_lastname AS created_last_name,
         cu.cms_user_email AS created_email,
         cu.cms_user_dep_id AS created_dep_id
       FROM cms_complaint_details t
       LEFT JOIN cms_company_details c ON t.cms_com_comp_id = c.cms_com_id
       LEFT JOIN cms_dep_details d ON t.cms_sys_dep_id = d.cms_dep_id
       LEFT JOIN cms_sys_details s ON t.cms_sys_id = s.cms_sys_id
       LEFT JOIN cms_user_details au ON au.cms_user_id = t.cms_sys_l1_id
       LEFT JOIN cms_user_details cu ON cu.cms_user_id = t.cms_user_id
       WHERE t.cms_com_id = ?`,
      [id]
    );

    const r = (rows as any[])[0];
    if (!r) return null;
    const ticket: TicketWithDetails = {
      id: r.id,
  // public_id removed
      ticket_number: r.ticket_number,
      company_id: r.company_id,
      department_id: r.department_id,
      target_system_id: r.target_system_id,
      subject: r.description?.split('\n')?.[0] || '',
      description: r.description,
      priority: r.priority,
      status: mapStatusToStandard(r.status),
      created_by: r.created_by,
      assigned_to: r.assigned_to,
      created_at: r.created_at,
      updated_at: r.updated_at,
      company_name: r.company_name,
      department_name: r.department_name,
      target_system_name: r.target_system_name,
      messages: await this.getTicketMessages(r.id),
      attachments: await this.getTicketAttachments(r.id),
    };
    return ticket;
  }

  async updateTicketStatus(id: number, status: string, _userId: string): Promise<Ticket> {
    await helpdeskConnection.execute(
      'UPDATE cms_complaint_details SET cms_com_status = ? WHERE cms_com_id = ?',
      [status, id]
    );
    const t = await this.getTicketById(id);
    return (t as TicketWithDetails) as unknown as Ticket;
  }

  async assignTicket(id: number, assignedToId: string): Promise<Ticket> {
    // When reassigning, reset status to 'in_progress' if it was 'resolved' or 'closed'
    await helpdeskConnection.execute(
      `UPDATE cms_complaint_details 
       SET cms_sys_l1_id = ?, 
           cms_com_status = CASE 
             WHEN cms_com_status IN ('resolved', 'closed') THEN 'in_progress'
             ELSE cms_com_status 
           END
       WHERE cms_com_id = ?`,
      [assignedToId, id]
    );
    const t = await this.getTicketById(id);
    return (t as TicketWithDetails) as unknown as Ticket;
  }

  async getTicketStats(userId?: string, departmentId?: number): Promise<TicketStats> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND (cms_user_id = ? OR cms_sys_l1_id = ?)';
      params.push(userId, userId);
    }

    // Support departmentId as array for multi-department stats
    if (Array.isArray(departmentId)) {
      if (departmentId.length > 0) {
        whereClause += ` AND cms_sys_dep_id IN (${departmentId.map(() => '?').join(',')})`;
        params.push(...departmentId);
      }
    } else if (departmentId) {
      whereClause += ' AND cms_sys_dep_id = ?';
      params.push(departmentId);
    }

    const [rows] = await helpdeskConnection.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN cms_com_status = 'open' THEN 1 ELSE 0 END) as open,
         SUM(CASE WHEN cms_com_status IN ('in_progress','in-progress','assigned') THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN cms_com_status = 'resolved' THEN 1 ELSE 0 END) as resolved,
         SUM(CASE WHEN cms_com_status = 'closed' THEN 1 ELSE 0 END) as closed
       FROM cms_complaint_details ${whereClause}`,
      params
    );

    const stats = (rows as any[])[0] || {};
    return {
      total: parseInt(stats.total) || 0,
      open: parseInt(stats.open) || 0,
      in_progress: parseInt(stats.in_progress) || 0,
      resolved: parseInt(stats.resolved) || 0,
      closed: parseInt(stats.closed) || 0
    };
  }

  // Message operations using cms_resolve
  async createTicketMessage(messageData: {
    ticket_id: number;
    sender_id: string;
    message: string;
  }): Promise<TicketMessage> {
    // Use a dedicated connection and transaction to ensure user row exists
    const conn: any = await helpdeskConnection.getConnection();
    try {
      await conn.beginTransaction();

      // Get ticket information using the same connection
      const [ticketRows] = await conn.execute(
        'SELECT cms_com_ticket_no FROM cms_complaint_details WHERE cms_com_id = ? FOR UPDATE',
        [messageData.ticket_id]
      );
      const ticketNo = (ticketRows as any[])[0]?.cms_com_ticket_no;
      if (!ticketNo) {
        await conn.rollback();
        throw new Error('Ticket not found');
      }

      const senderId = messageData.sender_id;
      const firstName = String(senderId).split('-')[0] || senderId;

      // Ensure the user exists. Use INSERT IGNORE to avoid race conditions.
      // If your cms_user_details table has different required columns adjust this query.
      await conn.execute(
        `INSERT IGNORE INTO cms_user_details (cms_user_id, cms_user_username, cms_user_firstname, cms_user_type_id, cms_user_status, cms_user_dep_id)
         VALUES (?, ?, ?, 3, 1, 1)`,
        [senderId, senderId, firstName]
      );

      // Resolve numeric primary key 'id' from cms_user_details. cms_resolve.fk expects cms_user_details.id (INT).
      let senderToUse: number;
      const [idRows]: any = await conn.execute(
        'SELECT id FROM cms_user_details WHERE cms_user_id = ? LIMIT 1',
        [senderId]
      );

      if ((idRows as any[]).length > 0) {
        senderToUse = idRows[0].id;
      } else {
        // Try to find a row where cms_user_username matches the sender value
        const [usernameRows]: any = await conn.execute(
          'SELECT id FROM cms_user_details WHERE cms_user_username = ? LIMIT 1',
          [senderId]
        );
        if ((usernameRows as any[]).length > 0) {
          senderToUse = usernameRows[0].id;
          console.warn(`User cms_user_id '${senderId}' not present, using existing id '${senderToUse}' matched by username.`);
        } else {
          await conn.rollback();
          throw new Error('Failed to ensure user exists for message sender');
        }
      }

      // Insert into cms_resolve using the resolved senderToUse and ticketNo
      const [result] = await conn.execute(
        'INSERT INTO cms_resolve (cms_resolove_ticket_no, cms_resolve_desc, cms_resolve_user_id, cms_resolve_created_at, cms_resolve_status) VALUES (?, ?, ?, NOW(), 1)',
        [ticketNo, messageData.message, senderToUse]
      );

      await conn.commit();

      return {
        id: (result as any).insertId,
        ticket_id: messageData.ticket_id,
        sender_id: senderId,
        message: messageData.message,
        created_at: new Date()
      } as TicketMessage;
    } catch (error) {
      try { await conn.rollback(); } catch (_) {}
      console.error('Error in createTicketMessage (transaction):', error);
      throw error;
    } finally {
      try { conn.release(); } catch (_) {}
    }
  }

  async getTicketMessages(ticketId: number): Promise<(TicketMessage & { sender_name?: string; sender_email?: string; sender_first_name?: string; sender_last_name?: string; attachments: TicketAttachment[] })[]> {
    const [ticketRows] = await helpdeskConnection.execute('SELECT cms_com_ticket_no FROM cms_complaint_details WHERE cms_com_id = ?', [ticketId]);
    const ticketNo = (ticketRows as any[])[0]?.cms_com_ticket_no;
    if (!ticketNo) return [];
    const [rows] = await helpdeskConnection.execute(
      `SELECT 
         r.cms_resolve_id AS id,
         ? AS ticket_id,
         u.cms_user_id AS sender_id,
         r.cms_resolve_desc AS message,
         r.cms_resolve_created_at AS created_at,
         u.cms_user_firstname AS sender_first_name,
         u.cms_user_lastname AS sender_last_name,
         u.cms_user_email AS sender_email
       FROM cms_resolve r
       LEFT JOIN cms_user_details u ON u.id = r.cms_resolve_user_id
       WHERE r.cms_resolove_ticket_no = ?
       ORDER BY r.cms_resolve_created_at ASC`,
      [ticketId, ticketNo]
    );
    const messages = rows as (TicketMessage & { sender_name?: string; sender_email?: string; sender_first_name?: string; sender_last_name?: string; attachments: TicketAttachment[] })[];
    for (const m of messages) {
      m.attachments = [];
    }
    return messages;
  }

  // ===== User preferences (notifications) =====
  async ensurePrefsTable(): Promise<void> {
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS cms_user_prefs (
        cms_user_id VARCHAR(255) PRIMARY KEY,
        notifications TINYINT(1) NOT NULL DEFAULT 1,
        daily_summary TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  async getUserPrefs(userId: string): Promise<{ notifications: boolean; daily_summary: boolean }> {
    await this.ensurePrefsTable();
    const [rows] = await helpdeskConnection.execute(
      'SELECT notifications, daily_summary FROM cms_user_prefs WHERE cms_user_id = ? LIMIT 1',
      [userId]
    );
    const r = (rows as any[])[0];
    if (!r) return { notifications: true, daily_summary: false };
    return { notifications: !!r.notifications, daily_summary: !!r.daily_summary };
  }

  async upsertUserPrefs(userId: string, prefs: { notifications?: boolean; daily_summary?: boolean }): Promise<void> {
    await this.ensurePrefsTable();
    const current = await this.getUserPrefs(userId);
    const notifications = prefs.notifications ?? current.notifications;
    const daily = prefs.daily_summary ?? current.daily_summary;
    await helpdeskConnection.execute(
      `INSERT INTO cms_user_prefs (cms_user_id, notifications, daily_summary)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE notifications = VALUES(notifications), daily_summary = VALUES(daily_summary)`,
      [userId, notifications ? 1 : 0, daily ? 1 : 0]
    );
  }

  async listEmailsForDailySummary(): Promise<Array<{ id: string; email: string }>> {
    await this.ensurePrefsTable();
    const [rows] = await helpdeskConnection.execute(
      `SELECT u.cms_user_id AS id, u.cms_user_email AS email
       FROM cms_user_details u
       JOIN cms_user_prefs p ON p.cms_user_id = u.cms_user_id
       WHERE p.daily_summary = 1 AND u.cms_user_type_id IN (99,1) AND u.cms_user_email IS NOT NULL AND u.cms_user_email <> ''`
    );
    return (rows as any[]).map(r => ({ id: String(r.id), email: r.email }));
  }

  async listEmailsForNotifications(): Promise<Array<{ id: string; email: string }>> {
    await this.ensurePrefsTable();
    const [rows] = await helpdeskConnection.execute(
      `SELECT u.cms_user_id AS id, u.cms_user_email AS email
       FROM cms_user_details u
       JOIN cms_user_prefs p ON p.cms_user_id = u.cms_user_id
       WHERE p.notifications = 1 AND u.cms_user_type_id IN (99,1) AND u.cms_user_email IS NOT NULL AND u.cms_user_email <> ''`
    );
    return (rows as any[]).map(r => ({ id: String(r.id), email: r.email }));
  }

  // ===== Meetings =====
  async ensureMeetingsTables(): Promise<void> {
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS cms_meetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        time VARCHAR(20) NOT NULL,
        meeting_link VARCHAR(255),
        location VARCHAR(255),
        description TEXT,
        created_by VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS cms_meeting_attendees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meeting_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        FOREIGN KEY (meeting_id) REFERENCES cms_meetings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  async createMeeting(data: {
    title: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    meeting_link?: string | null;
    location?: string | null;
    description?: string | null;
    created_by: string;
    attendees: string[];
  }): Promise<{ id: number }>{
    await this.ensureMeetingsTables();
    const [res] = await helpdeskConnection.execute(
      `INSERT INTO cms_meetings (title, date, time, meeting_link, location, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.title, data.date, data.time, data.meeting_link || null, data.location || null, data.description || null, data.created_by]
    );
    const id = (res as any).insertId as number;
    if (data.attendees && data.attendees.length > 0) {
      const values = data.attendees.map(e => [id, e]);
      await helpdeskConnection.query('INSERT INTO cms_meeting_attendees (meeting_id, email) VALUES ?', [values]);
    }
    return { id };
  }

  async listMeetingsForUser(userId: string, userEmail?: string): Promise<any[]> {
    await this.ensureMeetingsTables();
    const params: any[] = [userId];
    let sql = `SELECT m.*, GROUP_CONCAT(a.email SEPARATOR ',') AS attendees
               FROM cms_meetings m
               LEFT JOIN cms_meeting_attendees a ON a.meeting_id = m.id
               WHERE m.created_by = ?`;
    if (userEmail) {
      sql += ` OR a.email = ?`;
      params.push(userEmail);
    }
    sql += ` GROUP BY m.id ORDER BY m.date ASC, m.time ASC`;
    const [rows] = await helpdeskConnection.execute(sql, params);
    return rows as any[];
  }
  // Attachment operations mapped to cms_complaint_details.cms_file_location (comma-separated)
  async createTicketAttachment(attachmentData: {
    ticket_id: number;
    message_id?: number;
    file_name: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    file_path: string;
  }): Promise<TicketAttachment> {
    await helpdeskConnection.execute(
      `UPDATE cms_complaint_details 
       SET cms_file_location = CONCAT(IFNULL(cms_file_location, ''), CASE WHEN cms_file_location IS NULL OR cms_file_location = '' THEN '' ELSE ',' END, ?) 
       WHERE cms_com_id = ?`,
      [attachmentData.file_name, attachmentData.ticket_id]
    );
    return {
      id: Date.now(),
      ticket_id: attachmentData.ticket_id,
      message_id: attachmentData.message_id,
      file_name: attachmentData.file_name,
      original_name: attachmentData.original_name,
      mime_type: attachmentData.mime_type,
      file_size: attachmentData.file_size,
      file_path: attachmentData.file_path,
      created_at: new Date() as any,
    };
  }

  async getTicketAttachments(ticketId: number): Promise<TicketAttachment[]> {
    const [rows] = await helpdeskConnection.execute('SELECT cms_file_location FROM cms_complaint_details WHERE cms_com_id = ?', [ticketId]);
    const loc = (rows as any[])[0]?.cms_file_location as string | undefined;
    if (!loc) return [];
    const files = loc.split(',').map((f: string, i: number) => ({
      id: i + 1,
      ticket_id: ticketId,
      file_name: f,
      original_name: f,
      mime_type: 'application/octet-stream',
      file_size: 0,
      file_path: `/uploads/${f}`,
      created_at: null,
    }));
    return files as TicketAttachment[];
  }

  // User operations (department-based)
  async getUsersByDepartment(departmentId: number): Promise<HRMSUser[]> {
    const [rows] = await helpdeskConnection.execute(
      `SELECT 
         cms_user_id AS id,
         cms_user_id AS employee_id,
         cms_user_firstname AS first_name,
         cms_user_lastname AS last_name,
         cms_user_email AS email,
         cms_user_dep_id AS department,
         cms_user_type_id AS role,
         cms_user_password AS password_hash
       FROM cms_user_details
       WHERE cms_user_status = 1 AND cms_user_dep_id = ?`,
      [departmentId]
    );
    return (rows as any[]).map(r => ({
      id: String(r.id),
      employee_id: String(r.employee_id),
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      department: String(r.department),
              role: (String(r.role) === '99' ? 'super_admin' : (String(r.role) === '1' ? 'admin' : 'employee')) as any,
      password_hash: r.password_hash,
    }));
  }

  async listTeamUsers(departmentId: number, search?: string, excludeEmployeeId?: string): Promise<HRMSUser[]> {
    const params: any[] = [departmentId];
    let sql = `SELECT 
      cms_user_id AS id,
      cms_user_id AS employee_id,
      cms_user_firstname AS first_name,
      cms_user_lastname AS last_name,
      cms_user_email AS email,
      cms_user_dep_id AS department,
      cms_user_type_id AS role,
      cms_user_password AS password_hash
    FROM cms_user_details WHERE cms_user_dep_id = ?`;
    if (excludeEmployeeId) {
      sql += ` AND cms_user_id <> ?`;
      params.push(excludeEmployeeId);
    }
    if (search && search.trim() !== '') {
      sql += ` AND (
        LOWER(cms_user_firstname) LIKE ? OR 
        LOWER(cms_user_lastname) LIKE ? OR 
        LOWER(CONCAT(cms_user_firstname, ' ', cms_user_lastname)) LIKE ? OR 
        LOWER(CAST(cms_user_id AS CHAR)) LIKE ? OR 
        LOWER(cms_user_username) LIKE ? OR 
        LOWER(cms_user_email) LIKE ?
      )`;
      const like = `%${search.toLowerCase()}%`;
      params.push(like, like, like, like, like, like);
    }
    const [rows] = await helpdeskConnection.execute(sql, params);
    return (rows as any[]).map(r => ({
      id: String(r.id),
      employee_id: String(r.employee_id),
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      department: String(r.department),
      role: (String(r.role) === '99' ? 'super_admin' : (String(r.role) === '1' ? 'admin' : 'employee')) as any,
      password_hash: r.password_hash,
    }));
  }

  async getOrCreateConversation(currentUserId: string, otherUserId: string, deptId?: number): Promise<any> {
    await this.ensureChatTables();
    // Order members to maintain uniqueness
    const [a, b] = currentUserId < otherUserId ? [currentUserId, otherUserId] : [otherUserId, currentUserId];
    const [existing] = await helpdeskConnection.execute(
      'SELECT * FROM cms_user_conversations WHERE member_a_id = ? AND member_b_id = ?',
      [a, b]
    );
    const conv = (existing as any[])[0];
    if (conv) return conv;
    await helpdeskConnection.execute(
      'INSERT INTO cms_user_conversations (member_a_id, member_b_id, dept_id) VALUES (?, ?, ?)',
      [a, b, deptId || null]
    );
    const [rows] = await helpdeskConnection.execute(
      'SELECT * FROM cms_user_conversations WHERE member_a_id = ? AND member_b_id = ?',
      [a, b]
    );
    return (rows as any[])[0];
  }

  async getConversations(userId: string): Promise<any[]> {
    await this.ensureChatTables();
    const [rows] = await helpdeskConnection.execute(
      `SELECT c.*, 
        (SELECT m.message FROM cms_user_conversation_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM cms_user_conversation_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_at
       FROM cms_user_conversations c
       WHERE c.member_a_id = ? OR c.member_b_id = ?
       ORDER BY (last_at IS NULL), last_at DESC, c.created_at DESC`,
      [userId, userId]
    );
    return rows as any[];
  }

  async getConversationMessages(conversationId: number): Promise<any[]> {
    await this.ensureChatTables();
    const [rows] = await helpdeskConnection.execute(
      'SELECT id, conversation_id, sender_id, message, created_at FROM cms_user_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );
    return rows as any[];
  }

  async addConversationMessage(conversationId: number, senderId: string, message: string): Promise<any> {
    await this.ensureChatTables();
    const [result] = await helpdeskConnection.execute(
      'INSERT INTO cms_user_conversation_messages (conversation_id, sender_id, message) VALUES (?, ?, ?)',
      [conversationId, senderId, message]
    );
    const insertId = (result as any).insertId;
    const [rows] = await helpdeskConnection.execute(
      'SELECT id, conversation_id, sender_id, message, created_at FROM cms_user_conversation_messages WHERE id = ?',
      [insertId]
    );
    return (rows as any[])[0];
  }

  async updateUserRole(_userId: string, _role: string): Promise<HRMSUser | null> {
    return null;
  }
}

export const mysqlStorage = new MySQLStorage();