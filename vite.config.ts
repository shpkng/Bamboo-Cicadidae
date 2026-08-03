import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const keyPath = 'certs/lan-key.pem';
const certPath = 'certs/lan-cert.pem';
const https = existsSync(keyPath) && existsSync(certPath)
  ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  : undefined;

export default defineConfig({
  // 相对路径：让构建产物(dist)能在任意静态服务器/子目录下直接打开，
  // 对 Cloudflare Pages 根域名部署同样有效。
  base: './',
  server: { host: '0.0.0.0', https },
});
