'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('la typographie Comptabilisations reprend l’échelle Paie & RH sans toucher aux autres menus', () => {
  const app=fs.readFileSync('modern-proto/js/app.js','utf8');
  const css=fs.readFileSync('modern-proto/css/modern.css','utf8');
  assert.match(app,/activeMenu === 'Comptabilisations' \? ' payroll-accounting-menu' : ''/);
  assert.match(css,/\.payroll-status-workspace \{ font-size: \.8rem; \}/);
  assert.match(css,/\.payroll-accounting-menu \.accounting-menu-detail \{ font-family: var\(--font\); font-size: \.8rem; line-height: 1\.5; \}/);
  assert.match(css,/\.payroll-accounting-menu \.payroll-employee-workspace-head h3 \{ font-size: 1\.02rem; \}/);
  assert.match(css,/\.payroll-accounting-menu \.accounting-menu-detail select,[\s\S]*font-family: inherit; font-size: \.78rem;/);
  assert.match(css,/\.payroll-accounting-menu \.accounting-menu-detail \.btn \{ font-family: inherit; font-size: \.72rem; \}/);
  assert.match(css,/\.payroll-accounting-menu \.accounting-menu-detail \.exchange-mapping-table \{ font-size: \.77rem; \}/);
});
