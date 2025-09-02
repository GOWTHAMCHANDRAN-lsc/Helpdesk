import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';

// Helpdesk MySQL database connection (separate from HRMS)
const helpdeskPoolOptions: any = {
  host: process.env.HELPDESK_DB_HOST || 'localhost',
  user: process.env.HELPDESK_DB_USER || 'root',
  password: process.env.HELPDESK_DB_PASSWORD || '',
  database: process.env.HELPDESK_DB_NAME || 'helpdesk_system',
  port: Number(process.env.HELPDESK_DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

if (process.env.HELPDESK_DB_SSL === 'true') {
  helpdeskPoolOptions.ssl = {
    rejectUnauthorized: process.env.HELPDESK_DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.HELPDESK_DB_SSL_CA ? fs.readFileSync(process.env.HELPDESK_DB_SSL_CA, 'utf8') : undefined,
  };
}

export const helpdeskConnection = mysql.createPool(helpdeskPoolOptions);

// Initialize helpdesk database schema
export async function initializeHelpdeskDatabase() {
  try {
    // Create companies table
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create departments table
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create target_systems table
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS target_systems (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        UNIQUE KEY unique_system_per_dept (name, department_id)
      )
    `);

    // Create tickets table
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        company_id INT NOT NULL,
        department_id INT NOT NULL,
        target_system_id INT NOT NULL,
        subject VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
        created_by VARCHAR(255) NOT NULL,
        assigned_to VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (target_system_id) REFERENCES target_systems(id)
      )
    `);

    // Create ticket_messages table
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        sender_id VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `);

    // Create ticket_attachments table
    await helpdeskConnection.execute(`
      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        message_id INT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE
      )
    `);

    // Insert default data
    await insertDefaultData();

    console.log('✓ Helpdesk database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('✗ Failed to initialize helpdesk database:', error);
    return false;
  }
}

async function insertDefaultData() {
  try {
    // Insert default companies
    const companies = [
      'Tech Solutions Corp',
      'Global Services Ltd',
      'Innovation Hub Inc'
    ];

    for (const company of companies) {
      await helpdeskConnection.execute(
        'INSERT IGNORE INTO companies (name) VALUES (?)',
        [company]
      );
    }

    // Insert default departments
    const departments = [
      'IT Support',
      'HR',
      'Finance',
      'Operations',
      'Marketing',
      'Sales'
    ];

    for (const department of departments) {
      await helpdeskConnection.execute(
        'INSERT IGNORE INTO departments (name) VALUES (?)',
        [department]
      );
    }

    // Insert default target systems
    const targetSystems = [
      { name: 'Active Directory', department: 'IT Support' },
      { name: 'Email System', department: 'IT Support' },
      { name: 'VPN Access', department: 'IT Support' },
      { name: 'Payroll System', department: 'HR' },
      { name: 'HRMS Portal', department: 'HR' },
      { name: 'Accounting Software', department: 'Finance' },
      { name: 'ERP System', department: 'Operations' },
      { name: 'CRM System', department: 'Sales' },
      { name: 'Marketing Platform', department: 'Marketing' }
    ];

    for (const system of targetSystems) {
      const [deptRows] = await helpdeskConnection.execute(
        'SELECT id FROM departments WHERE name = ?',
        [system.department]
      );
      
      const depts = deptRows as any[];
      if (depts.length > 0) {
        await helpdeskConnection.execute(
          'INSERT IGNORE INTO target_systems (name, department_id) VALUES (?, ?)',
          [system.name, depts[0].id]
        );
      }
    }

    console.log('✓ Default data inserted successfully');
  } catch (error) {
    console.error('Error inserting default data:', error);
  }
}

// Test helpdesk database connection
export async function testHelpdeskConnection() {
  try {
    const connection = await helpdeskConnection.getConnection();
    await connection.ping();
    connection.release();
    console.log('✓ Helpdesk database connection successful');
    return true;
  } catch (error) {
    console.error('✗ Helpdesk database connection failed:', error);
    return false;
  }
}

// Generate unique ticket number
export function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `TKT-${timestamp}-${random}`.toUpperCase();
}