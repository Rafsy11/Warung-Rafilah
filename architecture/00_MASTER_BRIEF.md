# 00 — MASTER BRIEF: Warung + AmarthaFin Hybrid POS

## Read This File First

You are an AI coding agent operating inside **Google Antigravity IDE**. This document set is your complete specification for scaffolding, coding, and deploying a production-ready Hybrid Point of Sale system. Treat every file in this set as binding — do not substitute alternative libraries, schemas, or architectural patterns unless a file explicitly says "agent's discretion."

## 1. What You Are Building

A single web application serving two operational modes on the same hardware, for the same physical counter, switched via keyboard shortcut:

1. **Warung Mode (F1)** — A standard retail POS for a small Indonesian grocery store (warung). Barcode scanning, cart, cash/QRIS checkout, stock deduction.
2. **Agent Mode (F2)** — An AmarthaFin agent banking terminal. The store owner acts as a cash-in/cash-out agent for digital wallets, bill payments, and QRIS deposits, earning commission per transaction.

These two modes share one UI shell, one database server, and one deployment — but their **money is never the same money**. Warung revenue is the store's own retail income. Agent float is third-party funds passing through the store on behalf of AmarthaFin. Mixing these in code, schema, or reporting is treated as a critical bug, not a style issue. See `01_SYSTEM_ARCHITECTURE.md` § Ledger Separation Principle.

## 2. Hardware Reality You Must Design Against

| Resource | Spec |
|---|---|
| CPU | Intel Core 3 N355 (8-core, low-power, no active cooling assumptions) |
| RAM | 8GB DDR5 total — OS + 4 containers must fit with headroom |
| Storage | 256GB NVMe SSD |
| OS | Ubuntu 24.04 LTS, headless, 24/7 uptime |
| Network | No public IP, no port forwarding — outbound-only tunnel |

This is not a cloud deployment with elastic resources. Every architectural decision (standalone Next.js build, hard `mem_limit` per container, connection pooling, avoiding heavy ORMs) exists because this machine has a fixed, small ceiling and runs unattended at a small business counter where nobody will SSH in to restart a crashed service at 7am.

## 3. Non-Negotiable Constraints

- Next.js App Router, **`output: 'standalone'`** build — no exceptions. See `03_NEXTJS_STANDARDS.md`.
- Next.js container RAM ceiling: **< 200MB runtime** (hard-capped at 300MB in Docker as safety margin). See `05_DOCKER_DEPLOYMENT.md`.
- PostgreSQL with strict connection pooling (max 40 connections, pool size ≤ 10 from the app). See `02_DATABASE_SCHEMA.md`.
- Barcode scanner input must resolve to a product in **under 150ms** perceived latency — this drives the indexing strategy.
- All inbound webhooks (QRIS payment confirmations) arrive via Cloudflare Tunnel — **the router is never configured to forward ports.**
- UI is **keyboard-first**: a cashier should be able to complete an entire transaction without touching a mouse. See `04_UI_DESIGN_SYSTEM.md` § Keyboard Map.
- "Warm Dark Mode" only — no light mode toggle, no pure white (`#FFFFFF`) text anywhere, ever (eye strain at a 12-hour counter shift is a real ergonomic requirement, not an aesthetic preference).
- Docker Compose orchestrates all 4 services with explicit `mem_limit` on every container — total hard ceiling must stay comfortably under 8GB so the host OS and disk cache are never starved.

## 4. Document Index — Read in This Order

| # | File | Purpose |
|---|---|---|
| 00 | `00_MASTER_BRIEF.md` | This file. Business context and constraints. |
| 01 | `01_SYSTEM_ARCHITECTURE.md` | Container topology, data flow, ledger separation principle, RAM budget. |
| 02 | `02_DATABASE_SCHEMA.md` | Full PostgreSQL DDL — schemas, tables, indexes, views. |
| 03 | `03_NEXTJS_STANDARDS.md` | next.config.js, folder structure, coding conventions, env vars. |
| 04 | `04_UI_DESIGN_SYSTEM.md` | Tailwind tokens, component hierarchy, keyboard navigation map. |
| 05 | `05_DOCKER_DEPLOYMENT.md` | docker-compose.yml, Dockerfile, Cloudflare Tunnel config, postgres tuning. |
| 06 | `06_API_CONTRACTS.md` | Every API route, request/response shape, status codes. |
| 07 | `07_N8N_WORKFLOWS.md` | Background automation: low-stock alerts, float alerts, daily closing. |
| 08 | `08_SECURITY_HARDENING.md` | PIN auth, webhook signature verification, secrets, rate limiting. |
| 09 | `09_AGENT_EXECUTION_PLAN.md` | The exact build sequence you should follow, step by step. |

## 5. Definition of Done

The build is complete when all of the following are true simultaneously:

- `docker compose up -d` brings up all 4 services healthy on a fresh Ubuntu 24 NUC with zero manual intervention beyond filling in `.env`.
- A barcode scan in Warung Mode returns a product match and adds it to cart in under 150ms.
- A completed Warung sale never writes to any `agent.*` table, and a completed Agent transaction never writes to any `warung.*` table.
- `docker stats` shows combined RSS across all 4 containers staying under ~3GB during normal operation, with the Next.js container alone staying under 200MB.
- An inbound QRIS webhook hitting the Cloudflare Tunnel URL is verified by HMAC signature, recorded idempotently, and reflected in the Agent Mode UI without a page refresh.
- The cashier can complete a full Warung transaction (scan → cart → Enter → cash tendered → change shown) using only the keyboard.
- n8n fires a low-stock Telegram/WhatsApp alert and a daily closing summary without any manual trigger.
- All secrets (DB password, JWT secret, webhook HMAC secret, Cloudflare tunnel token) live in `.env`, are never committed, and are never logged.

Proceed to `01_SYSTEM_ARCHITECTURE.md`.
