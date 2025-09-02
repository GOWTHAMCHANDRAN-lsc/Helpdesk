import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import session from 'express-session';
import { type Express, type Request, type Response, type NextFunction } from 'express';
import { syncUserToCMS } from './userSync';

// HRMS MySQL database connection (re-using same cloud if needed)
export const hrmsConnection = mysql.createPool({
  host: process.env.HRMS_DB_HOST || process.env.HELPDESK_DB_HOST || 'localhost',
  user: process.env.HRMS_DB_USER || process.env.HELPDESK_DB_USER || 'root',
  password: process.env.HRMS_DB_PASSWORD || process.env.HELPDESK_DB_PASSWORD || '',
  database: process.env.HRMS_DB_NAME || process.env.HELPDESK_DB_NAME || 'mylsc_hrms_test_2',
  port: Number(process.env.HRMS_DB_PORT || process.env.HELPDESK_DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export interface HRMSUser {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  role: 'employee' | 'admin' | 'super_admin';
  password_hash: string;
}

export interface AuthenticatedRequest extends Request {
  user?: HRMSUser;
}

export async function setupHRMSAuth(app: Express) {
  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Login endpoint
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { employee_id, password } = req.body;

      if (!employee_id || !password) {
        return res.status(400).json({ message: 'Employee ID and password are required' });
      }

      // Try HRMS database authentication first, fallback to development auth if MySQL unavailable
      let user: HRMSUser | any = null;
      
      try {
        // Query user from cms_user_details
        const [rows] = await hrmsConnection.execute(
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
           WHERE (cms_user_username = ? OR cms_user_id = ?) AND cms_user_status = 1`,
          [employee_id, employee_id]
        );

        const users = rows as any[];
        const row = users[0];
        if (row) {
          const mappedRole = String(row.role) === '99'
            ? 'super_admin'
            : (String(row.role) === '1' ? 'admin' : 'employee');
          const candidate: HRMSUser = {
            id: String(row.id),
            employee_id: String(row.employee_id),
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            department: String(row.department),
            role: mappedRole as any,
            password_hash: row.password_hash,
          };
          let isValidPassword = false;
          try {
            // Try bcrypt first
            isValidPassword = await bcrypt.compare(password, candidate.password_hash);
          } catch {}
          if (!isValidPassword) {
            // Try MD5 (legacy)
            const md5 = crypto.createHash('md5').update(password).digest('hex');
            isValidPassword = md5 === candidate.password_hash;
          }
          if (!isValidPassword && process.env.AUTH_PLAINTEXT_FALLBACK === 'true') {
            // Fallback to plain text compare if hashes are not set yet
            isValidPassword = password === candidate.password_hash;
          }
          user = isValidPassword ? candidate : null;
        }
      } catch (dbError) {
        console.log('HRMS database not available, using development authentication');
        
        // Development fallback authentication for demo purposes
        const mockUsers: { [key: string]: any } = {
          'admin001': {
            id: '1',
            employee_id: 'admin001',
            first_name: 'John',
            last_name: 'Admin',
            email: 'admin@company.com',
            department: 'IT',
            role: 'admin',
            password: 'admin123'
          },
          'emp001': {
            id: '2',
            employee_id: 'emp001',
            first_name: 'Jane',
            last_name: 'Employee',
            email: 'jane@company.com',
            department: 'HR',
            role: 'employee',
            password: 'emp123'
          },
          'support001': {
            id: '3',
            employee_id: 'support001',
            first_name: 'Mike',
            last_name: 'Support',
            email: 'mike@company.com',
            department: 'IT Support',
            role: 'employee',
            password: 'support123'
          }
        };

        const mockUser = mockUsers[employee_id];
        if (mockUser && mockUser.password === password) {
          user = mockUser;
        }
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Ensure user exists in cms_user_details
      try {
        await hrmsConnection.execute(
          `INSERT INTO cms_user_details 
          (cms_user_id, cms_user_username, cms_user_firstname, cms_user_lastname, cms_user_email, cms_user_dep_id, cms_user_type_id, cms_user_status)
          SELECT ?, ?, ?, ?, ?, ?, ?, 1
          WHERE NOT EXISTS (
            SELECT 1 FROM cms_user_details WHERE cms_user_id = ?
          )`,
          [
            user.id,
            user.employee_id || user.id,
            user.first_name || '',
            user.last_name || '',
            user.email || '',
            user.department || '1',
            user.role === 'super_admin' ? 99 : (user.role === 'admin' ? 1 : 3),
            user.id
          ]
        );
      } catch (error) {
        console.error('Error ensuring user in cms_user_details:', error);
      }

      // Sync user to CMS database and store in session
      try {
        await syncUserToCMS(user);
      } catch (syncError) {
        console.error('Error syncing user:', syncError);
        // Continue even if sync fails - user can still log in
      }
      
      (req.session as any).user = {
        id: user.id,
        employee_id: user.employee_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        department: user.department,
        role: user.role
      };

      res.json({
        user: {
          id: user.id,
          employee_id: user.employee_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          department: user.department,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get current user endpoint
  app.get('/api/auth/user', (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json({ user });
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Admin: one-time password rehash endpoint (migrate plain-text to bcrypt)
  app.post('/api/admin/rehash-passwords', async (req: Request, res: Response) => {
    try {
      if (process.env.AUTH_PLAINTEXT_FALLBACK !== 'true') {
        return res.status(400).json({ message: 'Enable AUTH_PLAINTEXT_FALLBACK=true before migration' });
      }
      // Find all users whose password is likely plain text (heuristic: not starting with $2)
      const [rows] = await hrmsConnection.execute(
        "SELECT cms_user_id, cms_user_password FROM cms_user_details WHERE cms_user_password NOT LIKE '$2%';"
      );
      const users = rows as any[];
      for (const u of users) {
        const plain = u.cms_user_password as string;
        // Hash with bcrypt
        const hash = await bcrypt.hash(plain, 10);
        await hrmsConnection.execute(
          'UPDATE cms_user_details SET cms_user_password = ? WHERE cms_user_id = ?',
          [hash, u.cms_user_id]
        );
      }
      res.json({ updated: users.length });
    } catch (e) {
      console.error('Rehash error:', e);
      res.status(500).json({ message: 'Failed to rehash passwords' });
    }
  });
}

// Authentication middleware
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.user = user;
  next();
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    // Super admin bypasses role checks
    if (req.user.role === 'super_admin') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Test HRMS database connection
export async function testHRMSConnection() {
  try {
    const connection = await hrmsConnection.getConnection();
    await connection.ping();
    connection.release();
    console.log('✓ HRMS database connection successful');
    return true;
  } catch (error) {
    console.error('✗ HRMS database connection failed:', error);
    return false;
  }
}