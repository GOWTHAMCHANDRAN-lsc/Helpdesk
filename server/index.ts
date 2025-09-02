import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import { setupVite, serveStatic } from "./vite";
import secureHeaders from './secureHeaders';
import { setupHRMSAuth, testHRMSConnection } from './hrmsAuth';
import { createHelpdeskRoutes } from './routes';
import { mysqlStorage } from './mysqlStorage';
import { initializeHelpdeskDatabase, testHelpdeskConnection } from './mysqlDb';
import gmeetRouter from './gmeet.js';
import { initializeWebSocket } from './websocket';

const app = express();
// Set secure HTTP headers
app.use(secureHeaders);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Simple log function for server events
function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
    }
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize databases and authentication
async function initializeApp() {
  try {
    log('🚀 Starting Enterprise Helpdesk System...');
    
    // Test database connections
    const hrmsConnected = await testHRMSConnection();
    const helpdeskConnected = await testHelpdeskConnection();
    
    if (!helpdeskConnected) {
      log('⚠️  Helpdesk database not connected. Using development database...');
    }
    
    // Initialize helpdesk database schema (can be disabled via HELPDESK_DB_INIT=false)
    if (process.env.HELPDESK_DB_INIT !== 'false') {
      await initializeHelpdeskDatabase();
      log('✓ Database initialization complete');
    } else {
      log('↩︎ Skipping database initialization (HELPDESK_DB_INIT=false)');
    }
  } catch (error) {
    log(`❌ Failed to initialize databases: ${error}`);
  }
}

(async () => {
  // Setup authentication
  await setupHRMSAuth(app);
  
  // Setup helpdesk routes
  app.use('/api', createHelpdeskRoutes(mysqlStorage, upload));
  app.use('/api/gmeet', gmeetRouter);

  const server = (await import('http')).createServer(app);

  // Setup WebSocket for real-time chat
  initializeWebSocket(server);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    log(`Error: ${message}`);
  });

  // Setup vite in development
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || 5000);
  const host = process.env.HOST || "0.0.0.0";

  // Avoid using reusePort on Windows as it's not supported and triggers ENOTSUP
  const listenOptions: { port: number; host?: string; reusePort?: boolean } = { port, host };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`🌟 Enterprise Helpdesk serving on ${host}:${port}`);
    initializeApp();
  });
})();
