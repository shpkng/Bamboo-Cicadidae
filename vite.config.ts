import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const keyPath = 'certs/lan-key.pem';
const certPath = 'certs/lan-cert.pem';
const https = existsSync(keyPath) && existsSync(certPath)
  ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  : undefined;

export default defineConfig({
  server: { host: '0.0.0.0', https },
});
