import express from 'express';
import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_PORT = Number(process.env.PYTHON_BACKEND_PORT) || 8000;

let pythonProcess: ChildProcess | null = null;

function startPythonBackend(): void {
  const scriptPath = path.resolve(__dirname, 'backend', 'app.py');
  pythonProcess = spawn('python3', [scriptPath], {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHON_BACKEND_PORT: String(PYTHON_PORT),
    },
  });

  pythonProcess.on('exit', (code) => {
    console.error(`[Gateway] Python backend exited with code ${code}`);
  });
}

async function waitForPythonReady(timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://127.0.0.1:${PYTHON_PORT}/api/bootstrap`, (res) => {
        res.resume();
        resolve(res.statusCode !== undefined);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

function proxyToPython(req: express.Request, res: express.Response): void {
  const options: http.RequestOptions = {
    hostname: '127.0.0.1',
    port: PYTHON_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${PYTHON_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 502);
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (v !== undefined) res.setHeader(k, v);
    }
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: `Python backend unreachable: ${err.message}` });
    }
  });

  req.pipe(proxyReq);
}

async function startServer() {
  startPythonBackend();
  await waitForPythonReady();

  const app = express();

  // Forward all /api/* and /uploads/* requests directly to Python + MySQL backend
  app.use('/api', proxyToPython);
  app.use('/uploads', proxyToPython);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicNest Web & Android PWA Gateway listening on http://localhost:${PORT} -> Python API :${PYTHON_PORT}`);
  });

  const cleanup = () => {
    if (pythonProcess) {
      pythonProcess.kill();
    }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startServer();
