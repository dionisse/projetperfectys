#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'modern-proto');
const port = Number(process.env.PORT || process.env.BOLT_PORT || 3000);
const host = '0.0.0.0';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(message);
}

function resolvePublicFile(requestPath) {
  if (requestPath === '/' || requestPath === '/index.html') {
    return path.join(projectRoot, 'index.html');
  }

  if (requestPath === '/modern-proto' || requestPath === '/modern-proto/') {
    return path.join(publicRoot, 'index.html');
  }

  if (!requestPath.startsWith('/modern-proto/')) return null;

  const relativePath = requestPath.slice('/modern-proto/'.length);
  const resolvedPath = path.resolve(publicRoot, relativePath || 'index.html');
  if (resolvedPath !== publicRoot && !resolvedPath.startsWith(publicRoot + path.sep)) return null;
  return resolvedPath;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(response, 405, 'Méthode non autorisée.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://perfecto.invalid').pathname);
  } catch (error) {
    sendText(response, 400, 'Adresse invalide.');
    return;
  }

  if (pathname === '/modern-proto') {
    response.writeHead(308, { Location: '/modern-proto/', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  const filePath = resolvePublicFile(pathname);
  if (!filePath) {
    sendText(response, 404, 'Fichier introuvable.');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(response, 404, 'Fichier introuvable.');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) sendText(response, 500, 'Impossible de lire le fichier.');
      else response.destroy();
    });
    stream.pipe(response);
  });
});

server.listen(port, host, () => {
  console.log('Serveur d’aperçu PERFECTO prêt sur le port ' + port + ' (sans étape de build).');
});

server.on('error', (error) => {
  console.error('Démarrage du serveur d’aperçu impossible : ' + error.message);
  process.exitCode = 1;
});
