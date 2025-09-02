// Escape HTML utility for email templates (prevents XSS)
function escapeHtml(str: any) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
import express, { Router } from 'express';
import { sanitizeInput } from './sanitize';
import nodemailer from 'nodemailer';
import { MySQLStorage } from './mysqlStorage';
import { requireAuth, requireRole, AuthenticatedRequest, hrmsConnection } from './hrmsAuth';
import { z } from 'zod';
import { getWebSocketManager } from './websocket';
import path from 'path';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import { helpdeskConnection } from './mysqlDb';

// Validation schemas
const createTicketSchema = z.object({
  company_id: z.number(),
  department_id: z.number(),
  target_system_id: z.number(),
  subject: z.string().min(1).max(500),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']),
});

const messageSchema = z.object({
  message: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

const assignTicketSchema = z.object({
  assigned_to: z.string(),
});

const createUserSchema = z.object({
  employeeId: z.string().min(1),
  username: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  departmentId: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'employee']),
  password: z.string().min(4),
});

export function createHelpdeskRoutes(storage: MySQLStorage, upload: any): Router {
  const router = Router();

  async function sendAdminNotification(subject: string, text: string) {
    try {
      if (!process.env.SMTP_HOST || !(process.env.SMTP_USER || process.env.SMTP_FROM)) return;
      const recipients = await storage.listEmailsForNotifications();
      if (!recipients || recipients.length === 0) return;
  // nodemailer is imported at the top for security
      const createTransport = nodemailer.default?.createTransport || nodemailer.createTransport;
      const transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      for (const r of recipients) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: r.email,
          subject,
          text,
        });
      }
    } catch (err) {
      console.warn('Notification email failed:', err);
    }
  }

  // Companies
  router.get('/companies', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  router.post('/companies', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Company name is required' });
      }
  const company = await storage.createCompany(sanitizeInput(name));
      res.status(201).json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      res.status(500).json({ error: 'Failed to create company' });
    }
  });

  // Departments
  router.get('/departments', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ error: 'Failed to fetch departments' });
    }
  });

  router.post('/departments', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Department name is required' });
      }
  const department = await storage.createDepartment(sanitizeInput(name));
      res.status(201).json(department);
    } catch (error) {
      console.error('Error creating department:', error);
      res.status(500).json({ error: 'Failed to create department' });
    }
  });

  // Target Systems
  router.get('/target-systems', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { department_id } = req.query;
      let targetSystems;
      
      if (department_id) {
        targetSystems = await storage.getTargetSystemsByDepartment(Number(department_id));
      } else {
        targetSystems = await storage.getTargetSystems();
      }
      
      res.json(targetSystems);
    } catch (error) {
      console.error('Error fetching target systems:', error);
      res.status(500).json({ error: 'Failed to fetch target systems' });
    }
  });

  router.post('/target-systems', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, department_id } = req.body;
      if (!name || !department_id) {
        return res.status(400).json({ error: 'Name and department ID are required' });
      }
  const targetSystem = await storage.createTargetSystem(sanitizeInput(name), department_id);
      res.status(201).json(targetSystem);
    } catch (error) {
      console.error('Error creating target system:', error);
      res.status(500).json({ error: 'Failed to create target system' });
    }
  });

  // Tickets
  router.post('/tickets', requireAuth, upload.array('attachments', 5), async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as any;
      console.log('[create-ticket] incoming body keys:', Object.keys(body));
      console.log('[create-ticket] subject:', body?.subject, 'description:', body?.description);
      
      const department_id = Number(body.department_id ?? body.departmentId ?? req.user?.department);
      let company_id = Number(body.company_id ?? body.companyId);
      let requestedTargetSystemId = Number(body.target_system_id ?? body.targetSystemId);
      // Ensure we have a valid target system for the department. If none exist, create a default one.
      const systems = await storage.getTargetSystemsByDepartment(department_id);
      const allowedIds = new Set(systems.map((s: any) => s.id));
      if (!requestedTargetSystemId || !allowedIds.has(requestedTargetSystemId)) {
        if (systems.length === 0) {
          const created = await storage.createTargetSystem('General', department_id);
          requestedTargetSystemId = (created as any).id;
        } else {
          requestedTargetSystemId = systems[0].id;
        }
      }

      // If company_id is missing, try to infer from department -> company mapping
      if (!company_id && department_id) {
        try {
          const [deptRows] = await helpdeskConnection.execute('SELECT cms_dep_com_id AS company_id FROM cms_dep_details WHERE cms_dep_id = ? LIMIT 1', [department_id]);
          const cid = (deptRows as any[])[0]?.company_id;
          if (cid) company_id = Number(cid);
        } catch {}
      }

      // Ensure creator exists in helpdesk DB cms_user_details to satisfy FK
      try {
        const creatorId = req.user!.employee_id;
        const [existsRows] = await helpdeskConnection.execute('SELECT 1 FROM cms_user_details WHERE cms_user_id = ? LIMIT 1', [creatorId]);
        const exists = (existsRows as any[]).length > 0;
        if (!exists) {
          await helpdeskConnection.execute(
            `INSERT INTO cms_user_details (
              cms_user_id, cms_user_username, cms_user_firstname, cms_user_lastname,
              cms_user_email, cms_user_dep_id, cms_user_type_id, cms_user_password, cms_user_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              creatorId,
              creatorId,
              req.user!.first_name || '',
              req.user!.last_name || '',
              req.user!.email || '',
              department_id || null,
              3,
              req.user!.employee_id,
            ]
          );
        }
      } catch (e) {
        console.warn('Could not ensure HRMS user exists:', e);
      }

      const normalized = {
        company_id,
        department_id,
        target_system_id: requestedTargetSystemId,
    subject: sanitizeInput(String(body.subject ?? '')),
    description: sanitizeInput(String(body.description ?? '')),
        priority: String(body.priority ?? 'medium'),
      };
      const validatedData = createTicketSchema.parse(normalized);
      
      const ticket = await storage.createTicket({
        company_id: validatedData.company_id,
        department_id: validatedData.department_id,
        target_system_id: validatedData.target_system_id,
        subject: validatedData.subject,
        description: validatedData.description,
        priority: validatedData.priority,
        created_by: req.user!.employee_id,
      });

      // Notify admins/super admins via email if enabled
      (async () => {
        try {
          await sendAdminNotification(
            `New Ticket ${ticket.ticket_number}`,
            `Ticket ${ticket.ticket_number} created in department ${validatedData.department_id}\nPriority: ${validatedData.priority}\nSubject: ${validatedData.subject}`
          );
        } catch {}
      })();

      // Notify all users in the department via email (department-wide notification)
      (async () => {
        try {
          if (!process.env.SMTP_HOST || !(process.env.SMTP_USER || process.env.SMTP_FROM)) return;
          // Get all users in the department
          const departmentUsers = await storage.getUsersByDepartment(validatedData.department_id);
          if (!departmentUsers || departmentUsers.length === 0) return;
          // Get the target system name for this ticket
          let targetSystemName = '';
          try {
            const targetSystem = (await storage.getTargetSystemsByDepartment(validatedData.department_id)).find(s => s.id === validatedData.target_system_id);
            if (targetSystem) targetSystemName = targetSystem.name;
          } catch {}
          // nodemailer is imported at the top for security
          const createTransport = nodemailer.default?.createTransport || nodemailer.createTransport;
          const transporter = createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
          });
          // Compose the email content (HTML)
          const ticketLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets/${ticket.id}`;
          const subject = `LSC Helpdesk: New Ticket Raised — ${validatedData.subject}`;

          const html = `
            <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px 24px 24px 24px;border-radius:10px;border:1px solid #e5e7eb;">
              <img src='https://www.lscgroup.in/images/logo.png' alt='LSC Logo' style='height:40px;margin-bottom:24px;'>
              <h2 style="color:#2563eb;margin-bottom:8px;">New Support Ticket Created</h2>
              <p style="color:#222;font-size:16px;">Dear Team,</p>
              <p style="color:#222;font-size:15px;">A new support ticket has been raised in the LSC Helpdesk system. Please review the details below:</p>
              <table style="margin:18px 0 24px 0;font-size:15px;color:#222;">
                <tr><td style="font-weight:bold;padding-right:8px;">Subject:</td><td>${escapeHtml(validatedData.subject)}</td></tr>
                <tr><td style="font-weight:bold;padding-right:8px;">Priority:</td><td>${escapeHtml(validatedData.priority.charAt(0).toUpperCase() + validatedData.priority.slice(1))}</td></tr>
                <tr><td style="font-weight:bold;padding-right:8px;">Raised by:</td><td>${escapeHtml(req.user!.first_name || '')} ${escapeHtml(req.user!.last_name || '')}</td></tr>
                <tr><td style="font-weight:bold;padding-right:8px;">Target System:</td><td>${escapeHtml(targetSystemName || validatedData.target_system_id)}</td></tr>
                <tr><td style="font-weight:bold;padding-right:8px;">Ticket Number:</td><td>${escapeHtml(ticket.ticket_number)}</td></tr>
              </table>
              <a href="${escapeHtml(ticketLink)}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">View Ticket</a>
              <p style="margin-top:32px;font-size:13px;color:#888;">This is an automated message from LSC Helpdesk. If you have questions, contact helpdesk@mylsc.in.<br>Logistics Sector Skill Council, India</p>
            </div>
          `;
          for (const user of departmentUsers) {
            if (!user.email) continue;
            await transporter.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: user.email,
              subject,
              html,
            });
          }
        } catch (err) {
          console.warn('Department notification email failed:', err);
        }
      })();

      // WebSocket desktop notification for all connected clients (all roles)
      try {
        const ws = getWebSocketManager();
        if (ws) {
          // Broadcast as a general notification to all connected clients
          // Send a lightweight notification; clients decide what to show
          const note = {
            title: `New Ticket ${ticket.ticket_number}`,
            body: `${validatedData.subject}`,
            ticketId: ticket.id,
          };
          // We don't have a broadcast-all method; iterate over notifyUser requires ids.
          // As a simple approach, notify the creator and rely on ticket lists polling/WS for others.
          ws.notifyUser(req.user!.employee_id, note);
        }
      } catch {}

      // Handle file attachments
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
          await storage.createTicketAttachment({
            ticket_id: ticket.id,
            file_name: file.filename,
            original_name: file.originalname,
            mime_type: file.mimetype,
            file_size: file.size,
            file_path: file.path,
          });
        }
      }

      const mapped = {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        subject: validatedData.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at,
      };
      res.status(201).json(mapped);
    } catch (error) {
      console.error('Error creating ticket:', error);
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

  router.get('/tickets', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, department_id, priority, search, limit, offset } = req.query;
      const filters: any = {};
      const user = req.user!;
      if (user.role !== 'super_admin') {
        const depId = user.department ? Number(user.department) : undefined;
        if (depId) {
          filters.departmentId = depId;
        }
      }
      if (department_id) filters.departmentId = Number(department_id);
  if (status) filters.status = sanitizeInput(status as string);
  if (priority) filters.priority = sanitizeInput(priority as string);
  if (search) filters.search = sanitizeInput(search as string);

      // Parse limit/offset, default to 20/0
      const limitNum = limit ? Math.max(1, Math.min(100, parseInt(limit as string, 10))) : 20;
      const offsetNum = offset ? Math.max(0, parseInt(offset as string, 10)) : 0;

      const tickets = await storage.getTickets(filters, limitNum, offsetNum);
      const mapped = tickets.map((t: any) => ({
        id: t.id,
        // public_id removed
        ticketNumber: t.ticket_number,
        subject: t.subject, // Use the real subject from the database
        description: t.description,
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at,
  department: { id: t.department_id, name: t.department_name },
        company: { name: t.company_name },
        targetSystem: { name: t.target_system_name },
        assignedTo: t.assigned_to ? {
          id: t.assigned_to,
          firstName: t.assigned_first_name,
          lastName: t.assigned_last_name,
          email: t.assigned_email,
        } : null,
        createdBy: {
          id: t.created_by,
          firstName: t.created_first_name,
          lastName: t.created_last_name,
          email: t.created_email,
        },
      }));
      res.json(mapped);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  });

  router.get('/tickets/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('DEBUG /tickets/:id', { idParam: req.params.id });
      const idParam = req.params.id;
      let ticket;
  ticket = await storage.getTicketById(Number(idParam));
  console.log('DEBUG getTicketById result:', ticket);
      if (!ticket) {
        console.log('DEBUG Ticket not found for', idParam);
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const requester = req.user!;
      // Only allow access if admin, super_admin, or ticket is in user's department

  // TEMP: Allow all authenticated users to view tickets for debugging
  // const ticketDept = Number((ticket as any).department_id);
  // const userDept = Number(requester.department);
  // if (
  //   requester.role !== 'admin' &&
  //   requester.role !== 'super_admin' &&
  //   ticketDept !== userDept
  // ) {
  //   console.warn(`Access denied: user ${requester.employee_id} (dept ${userDept}) tried to access ticket ${ticket.id} (dept ${ticketDept})`);
  //   return res.status(403).json({ error: 'You do not have access to this ticket' });
  // }

      const mapped = {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        subject: (ticket.description?.split('\n')?.[0] || '').trim(),
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        company: { name: (ticket as any).company_name },
        department: { 
          id: (ticket as any).department_id,
          name: (ticket as any).department_name 
        },
        targetSystem: { name: (ticket as any).target_system_name },
        createdBy: {
          id: ticket.created_by,
          firstName: (ticket as any).created_first_name,
          lastName: (ticket as any).created_last_name,
          email: (ticket as any).created_email,
        },
        assignedTo: ticket.assigned_to ? {
          id: ticket.assigned_to,
          firstName: (ticket as any).assigned_first_name,
          lastName: (ticket as any).assigned_last_name,
          email: (ticket as any).assigned_email,
        } : undefined,
        attachments: (ticket as any).attachments?.map((a: any) => ({
          id: a.id,
          fileName: a.file_name,
          originalName: a.original_name,
          mimeType: a.mime_type,
          fileSize: a.file_size,
          createdAt: a.created_at,
        })) ?? [],
      };
      res.json(mapped);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  });

  router.patch('/tickets/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {

      const idParam = req.params.id;
      const { status } = updateStatusSchema.parse(req.body);
      let ticket;
      let ticketId;
  ticket = await storage.getTicketById(Number(idParam));
  ticketId = Number(idParam);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const requester = req.user!;
      const canUpdate = 
        requester.role === 'admin' || 
        requester.role === 'super_admin' ||
        (requester.role === 'employee' && 
         (ticket as any).department_id === Number(requester.department) &&
         ((ticket as any).assigned_to === requester.employee_id || !(ticket as any).assigned_to));

      if (!canUpdate) {
        return res.status(403).json({ error: 'You can only update tickets from your department that you have accepted or that are unassigned' });
      }

      const updatedTicket = await storage.updateTicketStatus(ticketId, status, req.user!.employee_id);

      // Broadcast ticket update
      const ws = getWebSocketManager();
      ws?.broadcastTicketUpdate(ticketId, { status });

      const mapped = {
        id: updatedTicket.id,
        ticketNumber: updatedTicket.ticket_number,
        subject: (updatedTicket.description?.split('\n')?.[0] || '').trim(),
        description: updatedTicket.description,
        priority: updatedTicket.priority,
        status: updatedTicket.status,
        createdAt: updatedTicket.created_at,
        updatedAt: updatedTicket.updated_at,
      };
      res.json(mapped);
    } catch (error) {
      console.error('Error updating ticket status:', error);
      res.status(500).json({ error: 'Failed to update ticket status' });
    }
  });

  router.patch('/tickets/:id/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {

      const idParam = req.params.id;
      const { assigned_to } = assignTicketSchema.parse(req.body);
      let ticket;
      let ticketId;
  ticket = await storage.getTicketById(Number(idParam));
  ticketId = Number(idParam);
      // Only admins and super admins can reassign tickets
      const requester = req.user!;
      if (requester.role !== 'admin' && requester.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only admins can reassign tickets' });
      }

      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const updatedTicket = await storage.assignTicket(ticketId, assigned_to);

      // Broadcast assignment update and status change
      const ws = getWebSocketManager();
      ws?.broadcastTicketUpdate(ticketId, { 
        assigned_to,
        status: updatedTicket.status 
      });

      const mapped = {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        subject: (ticket.description?.split('\n')?.[0] || '').trim(),
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      };
      res.json(mapped);
    } catch (error) {
      console.error('Error assigning ticket:', error);
      res.status(500).json({ error: 'Failed to assign ticket' });
    }
  });

  // Get department users for reassignment
  router.get('/tickets/:id/department-users', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {

      const idParam = req.params.id;
      let ticket;
  ticket = await storage.getTicketById(Number(idParam));
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const requester = req.user!;
      if (requester.role !== 'admin' && requester.role !== 'super_admin') {
        return res.status(400).json({ error: 'Only admins can view department users for reassignment' });
      }

      const departmentId = (ticket as any).department_id;
      const users = await storage.listTeamUsers(departmentId, '');
      res.json(users);
    } catch (error) {
      console.error('Error fetching department users:', error);
      res.status(500).json({ error: 'Failed to fetch department users' });
    }
  });

  // Accept ticket for current user (only if unassigned)
  router.post('/tickets/:id/accept', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {

      const idParam = req.params.id;
      let ticket;
      let ticketId;
  ticket = await storage.getTicketById(Number(idParam));
  ticketId = Number(idParam);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if ((ticket as any).assigned_to) {
        return res.status(409).json({ error: 'Ticket already accepted' });
      }
      const assignedTo = req.user!.employee_id;
      const updatedTicket = await storage.assignTicket(ticketId, assignedTo);
      const ws = getWebSocketManager();
      ws?.broadcastTicketUpdate(ticketId, { 
        assigned_to: assignedTo,
        status: updatedTicket.status 
      });

      const mapped = {
        id: updatedTicket.id,
        ticketNumber: updatedTicket.ticket_number,
        subject: (updatedTicket.description?.split('\n')?.[0] || '').trim(),
        description: updatedTicket.description,
        priority: updatedTicket.priority,
        status: updatedTicket.status,
        createdAt: updatedTicket.created_at,
      };
      res.json(mapped);
    } catch (e) {
      console.error('Error accepting ticket:', e);
      res.status(500).json({ error: 'Failed to accept ticket' });
    }
  });

  // ===== Admin emails: on-demand daily summary trigger (secure, super admin only) =====
  router.post('/admin/run-daily-summary', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const requester = req.user!;
      if (requester.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only super admin can run daily summary' });
      }

      // Build a simple summary using global stats
      const stats = await storage.getTicketStats();
      const recipients = await storage.listEmailsForDailySummary();

      if (recipients.length === 0) {
        return res.json({ ok: true, message: 'No subscribed recipients' });
      }

      // Send via nodemailer using SMTP creds from env (dynamic import to avoid type issues)
  // nodemailer is imported at the top for security
      const createTransport = nodemailer.default?.createTransport || nodemailer.createTransport;
      const transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });

      const subject = `Daily Helpdesk Summary`;
      const text = `Tickets: total=${stats.total}, open=${stats.open}, in_progress=${stats.in_progress}, resolved=${stats.resolved}, closed=${stats.closed}`;

      for (const r of recipients) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: r.email,
          subject,
          text,
        });
      }

      res.json({ ok: true, sent: recipients.length });
    } catch (error) {
      console.error('Error sending daily summary:', error);
      res.status(500).json({ error: 'Failed to send daily summary' });
    }
  });

  // Messages
  router.post('/tickets/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = Number(req.params.id);
  let { message } = messageSchema.parse(req.body);
  message = sanitizeInput(message);
      // Authorization: ticket creator's department, assigned user's department, and super_admin/admin
      const t = await storage.getTicketById(ticketId);
      if (!t) return res.status(404).json({ error: 'Ticket not found' });
      const user = req.user!;
      const userDep = user.department ? Number(user.department) : undefined;
      const ticketDep = (t as any).department_id ? Number((t as any).department_id) : undefined;
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      const allowed = isAdmin 
        || (userDep && userDep === ticketDep) 
        || user.employee_id === t.created_by 
        || user.employee_id === (t as any).assigned_to;
      if (!allowed) return res.status(403).json({ error: 'Not allowed to post in this chat' });

      const newMessage = await storage.createTicketMessage({
        ticket_id: ticketId,
        sender_id: req.user!.employee_id,
        message,
      });

      // Normalize message shape for frontend
      const mapped = {
        id: newMessage.id,
        message: newMessage.message,
        createdAt: newMessage.created_at ? newMessage.created_at.toISOString ? newMessage.created_at.toISOString() : String(newMessage.created_at) : new Date().toISOString(),
        sender: {
          id: newMessage.sender_id,
        },
      };

      // Broadcast new message
      const ws = getWebSocketManager();
      ws?.broadcastTicketMessage(ticketId, mapped);

      // Return mapped message (frontend will refetch attachments via GET if needed)
      res.status(201).json(mapped);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });

  // Return messages for a ticket (normalized for frontend)
  router.get('/tickets/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = Number(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: 'Invalid ticket ID' });

      const rows = await storage.getTicketMessages(ticketId);

      const mapped = (rows as any[]).map((m) => ({
        id: m.id,
        message: m.message,
        createdAt: m.created_at ? (m.created_at.toISOString ? m.created_at.toISOString() : String(m.created_at)) : null,
        sender: {
          id: m.sender_id,
          firstName: m.sender_first_name || null,
          lastName: m.sender_last_name || null,
          email: m.sender_email || null,
        },
        attachments: m.attachments || [],
      }));

      res.json(mapped);
    } catch (err) {
      console.error('Error fetching ticket messages:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Statistics
  router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
  let depId: number | undefined = user.role === 'super_admin' ? undefined : (user.department ? Number(user.department) : undefined);
  if (req.query.department_id) depId = Number(req.query.department_id);
  const stats = await storage.getTicketStats(undefined, depId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // ===== Admin Settings: notifications and daily summary prefs =====
  router.get('/admin/prefs', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      // Admins manage their own prefs; super_admin can optionally pass ?user_id= to read others
      const requestedUserId = (user.role === 'super_admin' && typeof req.query.user_id === 'string') ? req.query.user_id : user.employee_id;
      const prefs = await storage.getUserPrefs(requestedUserId);
      res.json(prefs);
    } catch (error) {
      console.error('Error fetching prefs:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  router.post('/admin/prefs', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const targetUserId = (user.role === 'super_admin' && typeof req.body?.user_id === 'string') ? String(req.body.user_id) : user.employee_id;
      const { notifications, dailySummary } = req.body as { notifications?: boolean; dailySummary?: boolean };
      await storage.upsertUserPrefs(targetUserId, { notifications, daily_summary: dailySummary });
      res.json({ ok: true });
    } catch (error) {
      console.error('Error saving prefs:', error);
      res.status(500).json({ error: 'Failed to save preferences' });
    }
  });

  // File upload endpoint
  router.post('/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      res.json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/${req.file.filename}`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // Download attachment route (by filename)
  router.get('/attachments/:filename', requireAuth, async (req, res) => {
    const filename = req.params.filename;
    const fullPath = path.join(process.cwd(), 'uploads', filename);
    res.sendFile(fullPath);
  });

  // Admin: Users list
  router.get('/admin/users', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const requester = req.user!;
      if (requester.role === 'super_admin') {
        const [rows] = await hrmsConnection.execute(
          `SELECT 
             cms_user_id AS id,
             cms_user_username AS employeeId,
             cms_user_firstname AS firstName,
             cms_user_lastname AS lastName,
             cms_user_email AS email,
             cms_user_dep_id AS departmentId,
             cms_user_type_id AS roleId
           FROM cms_user_details`
        );
        const data = (rows as any[]).map(r => ({
          id: String(r.id),
          employeeId: String(r.employeeId ?? r.id),
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          department: String(r.departmentId ?? ''),
          role: String(r.roleId) === '99' ? 'super_admin' : (String(r.roleId) === '1' ? 'admin' : 'employee'),
        }));
        return res.json(data);
      }

      // Admin: only list users in their own department
      const depId = Number(requester.department);
      const [rows] = await hrmsConnection.execute(
        `SELECT 
           cms_user_id AS id,
           cms_user_username AS employeeId,
           cms_user_firstname AS firstName,
           cms_user_lastname AS lastName,
           cms_user_email AS email,
           cms_user_dep_id AS departmentId,
           cms_user_type_id AS roleId
         FROM cms_user_details
         WHERE cms_user_dep_id = ?`,
        [depId]
      );
      const data = (rows as any[]).map(r => ({
        id: String(r.id),
        employeeId: String(r.employeeId ?? r.id),
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        department: String(r.departmentId ?? ''),
        role: String(r.roleId) === '99' ? 'super_admin' : (String(r.roleId) === '1' ? 'admin' : 'employee'),
      }));
      res.json(data);
    } catch (e) {
      console.error('Error fetching users:', e);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Admin: Update user role
  router.patch('/admin/users/:id/role', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const requester = req.user!;
      const userId = req.params.id;
      const role = String((req.body?.role ?? '')).trim();
      const roleMap: Record<string, number> = { super_admin: 99, admin: 1, employee: 3 };
      const roleId = roleMap[role];
      if (!roleId) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      if (requester.role !== 'super_admin') {
        // Admin can only change users in their own department and cannot assign super_admin
        if (role === 'super_admin') {
          return res.status(403).json({ error: 'Only super admin can assign super admin role' });
        }
        const [rows] = await hrmsConnection.execute(
          'SELECT cms_user_dep_id AS dep FROM cms_user_details WHERE cms_user_id = ? LIMIT 1',
          [userId]
        );
        const dep = (rows as any[])[0]?.dep;
        if (!dep || Number(dep) !== Number(requester.department)) {
          return res.status(403).json({ error: 'You can only change roles of users in your department' });
        }
      }

      await hrmsConnection.execute(
        'UPDATE cms_user_details SET cms_user_type_id = ? WHERE cms_user_id = ?',
        [roleId, userId]
      );
      res.json({ id: userId, role });
    } catch (e) {
      console.error('Error updating role:', e);
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  // Admin: Create user
  router.post('/admin/users', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const requester = req.user!;
      const data = createUserSchema.parse(req.body);
      const roleMap: Record<string, number> = { admin: 1, employee: 3 };
      const roleId = roleMap[data.role];
      const hash = crypto.createHash('md5').update(data.password).digest('hex');
      // If admin, pin department to their own
      const depId = requester.role === 'super_admin'
        ? (data.departmentId && data.departmentId.trim() !== '' ? Number(data.departmentId) : null)
        : Number(requester.department);
      const employeeId = (data.employeeId || data.username || '').trim();
      if (!employeeId) {
        return res.status(400).json({ error: 'Employee ID or Username is required' });
      }
      await hrmsConnection.execute(
        `INSERT INTO cms_user_details (
           cms_user_id, cms_user_username, cms_user_firstname, cms_user_lastname,
           cms_user_email, cms_user_dep_id, cms_user_type_id, cms_user_password, cms_user_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          employeeId,
          (data.username || employeeId),
          data.firstName,
          data.lastName ?? '',
          data.email ?? '',
          depId,
          roleId,
          hash,
        ]
      );
      res.status(201).json({ id: employeeId });
    } catch (e) {
      console.error('Error creating user:', e);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Team messages: search users. Defaults to requester's department, but super admin may specify department_id
  router.get('/messages/users', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const q = String((req.query.q ?? '') as string);
      const requestedDepId = req.query.department_id ? Number(req.query.department_id) : undefined;
      const isSuperAdmin = req.user?.role === 'super_admin';

      // Determine department id
      let depId: number | undefined = undefined;
      if (isSuperAdmin && requestedDepId && !Number.isNaN(requestedDepId)) {
        depId = requestedDepId;
      } else {
        // Always look up from DB by current user id to avoid stale/mismatched session values
        try {
          const [rows] = await hrmsConnection.execute(
            'SELECT cms_user_dep_id AS dep FROM cms_user_details WHERE cms_user_id = ? LIMIT 1',
            [req.user!.employee_id]
          );
          const dep = (rows as any[])[0]?.dep;
          if (dep !== undefined && dep !== null) depId = Number(dep);
        } catch (lookupErr) {
          console.warn('Could not lookup user department id:', lookupErr);
        }
      }

      if (!depId || Number.isNaN(depId)) return res.json([]);

      const users = await storage.listTeamUsers(depId, q, req.user!.employee_id);
      const mapped = users.map(u => ({ id: u.employee_id, firstName: u.first_name, lastName: u.last_name, email: u.email }));
      res.json(mapped);
    } catch (e) {
      console.error('Error listing team users:', e);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  // Users: email suggestions (global)
  router.get('/users/emails', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const q = String((req.query.q ?? '') as string);
      const rows = await storage.searchUserEmails(q);
      const selfEmail = (req.user!.email || '').trim().toLowerCase();
      res.json(
        rows
          .filter(r => (r.email || '').toLowerCase() !== selfEmail)
          .map(r => ({ email: r.email, name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() }))
      );
    } catch (e) {
      console.error('Error searching user emails:', e);
      res.status(500).json({ error: 'Failed to search emails' });
    }
  });

  // Meetings: create and optionally send reminders
  router.post('/meetings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const { title, date, time, attendees, meetingType, location, description, sendReminder, reminderNote, meetId } = req.body || {};

        if (!title || !date || !time) {
            return res.status(400).json({ error: 'title, date, time are required' });
        }

        // Collect attendees list
        const attendeesList: string[] = Array.isArray(attendees)
            ? attendees.filter((e: any) => typeof e === 'string' && e.includes('@'))
            : [];

        // Always include scheduler's email if available
        const creatorEmail = (req.user!.email || '').trim();
        if (creatorEmail && creatorEmail.includes('@') && !attendeesList.includes(creatorEmail)) {
            attendeesList.push(creatorEmail);
        }

        const isOnline = String(meetingType || '').toLowerCase() === 'online';
        const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);
        const code = meetId && typeof meetId === 'string' ? meetId : nano();

        // Generate meeting link if required
        let meetingLink: string | undefined;
        if (isOnline) {
            if (location && String(location).startsWith('http')) {
                meetingLink = String(location);
            } else {
                const provider = (process.env.MEET_PROVIDER || 'jitsi').toLowerCase();
                if (provider === 'google') {
                    meetingLink = `https://meet.google.com/${code}`;
                } else if (provider === 'zoom') {
                    meetingLink = `https://zoom.us/j/${code}`;
                } else if (provider === 'teams') {
                    meetingLink = `https://teams.microsoft.com/l/meetup-join/${code}`;
                } else {
                    meetingLink = `https://meet.jit.si/${(process.env.MEET_ROOM_PREFIX || 'Helpdesk')}-${code}`;
                }
            }
        }

        // Persist meeting in storage
        const created = await storage.createMeeting({
            title,
            date,
            time,
            meeting_link: meetingLink ?? null,
            location: meetingLink ? null : (location || null),
            description: description || null,
            created_by: req.user!.employee_id,
            attendees: attendeesList,
        });

        // Send reminders if enabled
        let sentReminders = false;

        if (sendReminder && attendeesList.length > 0 && process.env.SMTP_HOST) {
            try {
                // nodemailer is imported at the top for security
                const createTransport = nodemailer.default?.createTransport || nodemailer.createTransport;

                const transporter = createTransport({
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT || 465),
                    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });

                // Verify SMTP connection
                try {
                    await transporter.verify();
                    console.log("✅ SMTP connection verified successfully!");
                } catch (verr) {
                    console.error("❌ SMTP verification failed:", verr);
                }

                // Email content
                const subject = `[Meeting] ${title} — ${date} ${time}`;
                const text = `
${description || ''}

📅 When: ${date} at ${time}
📍 Where: ${meetingLink ? meetingLink : (location || 'TBD')}
${reminderNote ? `\n📝 Note: ${reminderNote}` : ''}
                `.trim();

                // Send emails to all attendees in parallel
                const emailPromises = attendeesList.map((email) =>
                    transporter.sendMail({
                        from: process.env.SMTP_FROM || process.env.SMTP_USER,
                        to: email,
                        subject,
                        text,
                    })
                );

                const results = await Promise.allSettled(emailPromises);

                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        console.log(`✅ Email sent to ${attendeesList[index]}`);
                    } else {
                        console.error(`❌ Failed to send email to ${attendeesList[index]}:`, result.reason);
                    }
                });

                sentReminders = true;
            } catch (err) {
                console.error('❌ Meeting email failed:', err);
            }
        }

        // Final API response
        res.status(201).json({
            id: created.id,
            title,
            date,
            time,
            attendees: attendeesList,
            meetingType: isOnline ? 'online' : 'in_person',
            meetingLink: meetingLink ?? null,
            location: meetingLink ? null : (location || null),
            description: description || null,
            sentReminders,
        });
    } catch (e) {
        console.error('Error creating meeting:', e);
        res.status(500).json({ error: 'Failed to create meeting' });
    }
});


  // Meetings: list my meetings (created-by or attendee)
  router.get('/meetings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const rows = await storage.listMeetingsForUser(req.user!.employee_id, req.user!.email);
      res.json(rows.map(r => ({
        id: r.id,
        title: r.title,
        date: r.date,
        time: r.time,
        meetingLink: r.meeting_link,
        location: r.location,
        description: r.description,
        attendees: (r.attendees || '').split(',').filter((x: string) => !!x),
        createdAt: r.created_at,
      })));
    } catch (e) {
      console.error('Error listing meetings:', e);
      res.status(500).json({ error: 'Failed to list meetings' });
    }
  });

  // Team messages: list conversations
  router.get('/messages/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const convs = await storage.getConversations(req.user!.employee_id);
      res.json(convs);
    } catch (e) {
      console.error('Error listing conversations:', e);
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  });

  // Team messages: open/start conversation with a teammate
  router.post('/messages/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const otherId = String((req.body?.userId ?? '') as string).trim();
      if (!otherId) return res.status(400).json({ error: 'userId is required' });
      const depId = req.user?.department ? Number(req.user.department) : undefined;
      const conv = await storage.getOrCreateConversation(req.user!.employee_id, otherId, depId);
      res.status(201).json(conv);
    } catch (e) {
      console.error('Error starting conversation:', e);
      res.status(500).json({ error: 'Failed to start conversation' });
    }
  });

  // Team messages: get messages in a conversation
  router.get('/messages/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const convId = Number(req.params.id);
      const messages = await storage.getConversationMessages(convId);
      res.json(messages);
    } catch (e) {
      console.error('Error fetching conversation:', e);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // Team messages: send message in a conversation
  router.post('/messages/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const convId = Number(req.params.id);
      const text = String((req.body?.message ?? '') as string);
      if (!text.trim()) return res.status(400).json({ error: 'message is required' });
      const msg = await storage.addConversationMessage(convId, req.user!.employee_id, text.trim());
      res.status(201).json(msg);
    } catch (e) {
      console.error('Error sending conversation message:', e);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  return router;
}