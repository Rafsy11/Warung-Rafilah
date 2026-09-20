import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { NextRequest } from 'next/server';
import { migrate } from '../scripts/migrate.mjs';
import { verifyUpgrade } from '../scripts/verify-upgrade.mjs';
import { db } from '../lib/db';
import { POST as quickAdd } from '../app/api/products/quick-add/route';
import { POST as checkout } from '../app/api/sales/route';
import { POST as cancel } from '../app/api/sales/cancel/route';
import { POST as confirm } from '../app/api/sales/confirm-manual/route';
import { POST as ai } from '../app/api/ai/command/route';
import { POST as closeShift } from '../app/api/cashier-sessions/close/route';
import { GET as report } from '../app/api/reports/net-profit/route';
import { GET as consignments } from '../app/api/consignment/ledger/route';
import { POST as login } from '../app/api/auth/login/route';
import { POST as logout } from '../app/api/auth/logout/route';
import { proxy } from '../proxy';
import NativePg from 'pg';
import { POST as adjustFloat } from '../app/api/agent/float-balance/route';
import { POST as openShift } from '../app/api/cashier-sessions/open/route';

test('upgrade preserves existing rows; financial routes keep ledger invariants', async (t) => {
  const nativeUrl = process.env.POS_TEST_DATABASE_URL;
  if (nativeUrl && !/^\/pos_test_[a-z0-9_]+$/.test(new URL(nativeUrl).pathname)) throw new Error('Use an empty pos_test_* database only.');
  const nativePool = nativeUrl ? new NativePg.Pool({ connectionString: nativeUrl, max: 12 }) : null;
  const nativeClient = nativePool ? await nativePool.connect() : null;
  const pg = nativeClient ? {
    async query(sql: string, params: unknown[]) { const r = await nativeClient.query(sql, params); return { rows: r.rows, affectedRows: r.rowCount }; },
    async exec(sql: string) { const r = await nativeClient.query(sql); return (Array.isArray(r) ? r : [r]).map(item => ({ rows: item.rows, affectedRows: item.rowCount })); },
    async close() { nativeClient.release(); await nativePool!.end(); },
  } : new PGlite({ extensions: { uuid_ossp, pgcrypto, pg_trgm } });
  const client = {
    async query(sql: string, params?: unknown[]) {
      const result = params?.length ? await pg.query(sql, params) : (await pg.exec(sql)).at(-1)!;
      return { rows: result.rows as Record<string, unknown>[], rowCount: result.rows.length || result.affectedRows || 0 };
    },
    release() {},
  };
  const originalQuery = db.query, originalConnect = db.connect;
  // Real PostgreSQL engine in WASM; adapter replaces only network transport.
  db.query = nativePool ? nativePool.query.bind(nativePool) : client.query as typeof db.query;
  db.connect = nativePool ? nativePool.connect.bind(nativePool) : (async () => client) as unknown as typeof db.connect;
  const oldDir = await mkdtemp(path.join(tmpdir(), 'pos-upgrade-'));
  try {
    assert.equal((await client.query("SELECT to_regclass('warung.products') AS name")).rows[0].name,null,'Test database must be empty');
    await pg.exec("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pos_admin') THEN CREATE ROLE pos_admin; END IF; END $$;");
    await pg.exec(await readFile('../db/init/001_schema.sql', 'utf8'));
    await pg.exec(await readFile('../db/init/002_local_master_products.sql', 'utf8'));
    for (const file of await readdir('migrations')) if (file.endsWith('.sql') && file < '022') {
      await writeFile(path.join(oldDir, file), await readFile(path.join('migrations', file)));
    }
    await migrate(client, oldDir);
    const owner = (await client.query("SELECT id FROM core.users WHERE username='admin'")).rows[0].id as string;
    const product = randomUUID(), customer = randomUUID(), shift = randomUUID(), historicalSale = randomUUID();
    await client.query(`INSERT INTO warung.products(id,barcode,name,cost_price,sell_price,stock_qty) VALUES ($1,'AUDIT-1','Test',7000,10000,100)`, [product]);
    await client.query(`INSERT INTO warung.customers(id,name,current_debt) VALUES ($1,'Test customer',50000)`, [customer]);
    await client.query(`INSERT INTO warung.cashier_sessions(id,cashier_id,status,starting_cash) VALUES ($1,$2,'open',100000)`, [shift,owner]);
    await client.query(`INSERT INTO warung.sales(id,transaction_code,cashier_id,subtotal,total_amount,payment_method,payment_received,session_id) VALUES ($1,'OLD-KEEP',$2,10000,10000,'cash',10000,$3)`, [historicalSale,owner,shift]);
    await client.query(`INSERT INTO warung.stock_movements(product_id,movement_type,qty_change) VALUES ($1,'damaged',-1)`, [product]);
    const before = await client.query('SELECT id,transaction_code,total_amount,status FROM warung.sales ORDER BY id');
    await verifyUpgrade(client, path.resolve('migrations'));
    await migrate(client, path.resolve('migrations'));
    assert.deepEqual((await client.query('SELECT id,transaction_code,total_amount,status FROM warung.sales ORDER BY id')).rows, before.rows);
    assert.equal(Number((await client.query('SELECT current_debt FROM warung.customers WHERE id=$1',[customer])).rows[0].current_debt),50000);
    assert.equal((await client.query('SELECT cost_price_snapshot FROM warung.stock_movements')).rows[0].cost_price_snapshot,null);
    const req = (body: unknown, role='owner') => new NextRequest('http://localhost/api/test', {method:'POST',headers:{'content-type':'application/json','x-user-id':owner,'x-user-role':role},body:JSON.stringify(body)});
    const sale = (extra = {}) => ({checkout_key:randomUUID(),total_amount:10000,payment_method:'CASH',payment_received:10000,change_given:0,items:[{product_id:product,quantity:1,unit_price:10000,subtotal:10000}],...extra});
    await t.test('server rejects mismatched totals and malformed payments without stock changes',async()=>{
      for(const body of [sale({total_amount:1}),sale({payment_received:0}),sale({payment_method:'DEBT',customer_id:customer,payment_received:20000}),sale({payment_method:'SPLIT',split_cash_amount:11000,split_qris_amount:0})]) {
        assert.ok((await checkout(req(body))).status>=400);
      }
      assert.equal(Number((await client.query('SELECT stock_qty FROM warung.products WHERE id=$1',[product])).rows[0].stock_qty),100);
    });
    await t.test('quick-add requires real stock and cost and logs initial movement',async()=>{
      const body={barcode:'REAL-STOCK',name:'Real stock',sell_price:5000};
      assert.equal((await quickAdd(req(body))).status,400);
      const response=await quickAdd(req({...body,cost_price:3000,stock_qty:7}));
      assert.equal(response.status,201,await response.clone().text());
      const product=await response.json();
      assert.equal(Number(product.stock_qty),7);
      const movement=(await client.query('SELECT qty_change,cost_price_snapshot FROM warung.stock_movements WHERE product_id=$1',[product.id])).rows[0];
      assert.equal(Number(movement.qty_change),7);assert.equal(Number(movement.cost_price_snapshot),3000);
    });
    await t.test('retry commits exactly one sale and one stock movement',async()=>{
      const body=sale();const first=await checkout(req(body)); assert.equal(first.status,201,await first.clone().text());
      const second=await checkout(req(body)); assert.equal(second.status,200);
      assert.equal((await first.json()).saleId,(await second.json()).saleId);
      assert.equal(Number((await client.query('SELECT stock_qty FROM warung.products WHERE id=$1',[product])).rows[0].stock_qty),99);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM warung.stock_movements WHERE movement_type='sale'")).rows[0].n,1);
    });
    await t.test('debt deposit is preserved in the server receipt',async()=>{
      const response=await checkout(req(sale({payment_method:'DEBT',customer_id:customer,payment_received:3000})));
      assert.equal(response.status,201,await response.clone().text());
      assert.equal((await response.json()).receipt.payment_received,3000);
      assert.equal(Number((await client.query('SELECT current_debt FROM warung.customers WHERE id=$1',[customer])).rows[0].current_debt),57000);
    });
    await t.test('AI debt payment writes cash ledger and rejects negative payments',async()=>{
      const response=await ai(req({prompt:'bayar hutang',productId:customer,action:'SETTLE_DEBT_EXEC',quantity:7000,confirmed:true}));
      assert.equal(response.status,200,await response.clone().text());
      const ledger=(await client.query("SELECT amount,session_id,payment_method FROM warung.debt_ledger WHERE entry_type='debt_paid'")).rows[0];
      assert.equal(Number(ledger.amount),7000);assert.equal(ledger.session_id,shift);assert.equal(ledger.payment_method,'cash');
      assert.ok((await ai(req({prompt:'bayar',productId:customer,action:'SETTLE_DEBT_EXEC',quantity:-1,confirmed:true}))).status>=400);
    });
    await t.test('pending consignment excluded; cashier cancellation restores stock exactly once',async()=>{
      await client.query('UPDATE warung.products SET is_consignment=true,consignment_supplier_name=$1,consignment_cost_share=6000 WHERE id=$2',['Supplier',product]);
      const response=await checkout(req(sale({payment_method:'QRIS'}),'cashier'));assert.equal(response.status,201,await response.clone().text());
      const {saleId}=await response.json();
      const summary=await consignments(new NextRequest('http://localhost/api/consignment/ledger?summary=true'));
      assert.equal((await summary.json()).summary.length,0);
      assert.equal((await closeShift(req({actualCash:0}))).status,400);
      assert.equal((await cancel(req({saleId},'cashier'))).status,200);
      assert.equal((await cancel(req({saleId},'cashier'))).status,200);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM warung.stock_movements WHERE movement_type='void_return'")).rows[0].n,1);
      assert.equal((await confirm(req({saleId}))).status,400);
    });
    await t.test('loss snapshots stay fixed when master cost changes; losses are not clamped',async()=>{
      await client.query("INSERT INTO warung.stock_movements(product_id,movement_type,qty_change) VALUES ($1,'damaged',-2)",[product]);
      await client.query('UPDATE warung.products SET cost_price=9000 WHERE id=$1',[product]);
      assert.equal(Number((await client.query("SELECT cost_price_snapshot FROM warung.stock_movements WHERE movement_type='damaged' ORDER BY id DESC LIMIT 1")).rows[0].cost_price_snapshot),7000);
      const response=await report(new NextRequest('http://localhost/api/reports/net-profit?date='+new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}),{headers:{'x-user-role':'owner'}}));
      assert.equal(response.status,200,await response.clone().text());
      const data=await response.json();assert.equal(data.unknown_shrinkage_cost_count,1);assert.equal(data.shrinkage_loss,14000);
      const id=randomUUID();
      await client.query(`INSERT INTO warung.sales(id,transaction_code,cashier_id,subtotal,discount,total_amount,payment_method,created_at)
        VALUES ($1,'LOSS-TEST',$2,10000,4000,6000,'cash','2020-01-01T12:00:00+07:00')`,[id,owner]);
      await client.query('INSERT INTO warung.sale_items(sale_id,product_id,qty,unit_price,cost_price_snapshot,subtotal) VALUES ($1,$2,1,10000,9000,10000)',[id,product]);
      const loss=await report(new NextRequest('http://localhost/api/reports/net-profit?date=2020-01-01',{headers:{'x-user-role':'owner'}}));
      assert.equal((await loss.json()).gross_margin,-3000);
    });
    await t.test('price history source survives until UPDATE; later updates fall back to manual',async()=>{
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.price_change_source','ai_command',true)");
      await client.query('UPDATE warung.products SET sell_price=12000 WHERE id=$1',[product]);
      await client.query('COMMIT');
      assert.equal((await client.query('SELECT source FROM warung.product_price_history ORDER BY id DESC LIMIT 1')).rows[0].source,'ai_command');
      await client.query('UPDATE warung.products SET sell_price=10000 WHERE id=$1',[product]);
      assert.equal((await client.query('SELECT source FROM warung.product_price_history ORDER BY id DESC LIMIT 1')).rows[0].source,'manual');
    });
    await t.test('concurrent float mutations and checkout retries serialize on PostgreSQL', { skip: !nativePool }, async()=>{
      const responses = await Promise.all(Array.from({length:8},()=>adjustFloat(req({amount:10000,note:'Concurrent test'}))));
      assert.ok(responses.every(r=>r.status===200));
      assert.equal(Number((await client.query('SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1')).rows[0].balance_after),80000);
      const body=sale();
      const checkouts=await Promise.all(Array.from({length:5},()=>checkout(req(body))));
      assert.ok(checkouts.every(r=>r.status===200||r.status===201));
      assert.equal((await client.query('SELECT count(*)::int AS n FROM warung.sales WHERE checkout_key=$1',[body.checkout_key])).rows[0].n,1);
      const newCashier=randomUUID();
      await client.query("INSERT INTO core.users(id,username,pin_hash,full_name,role) VALUES ($1,'concurrent-cashier','unused','Test','cashier')",[newCashier]);
      const opens=await Promise.all(Array.from({length:4},()=>openShift(new NextRequest('http://localhost/api/cashier-sessions/open',{method:'POST',headers:{'x-user-id':newCashier,'x-user-role':'cashier'},body:JSON.stringify({startingCash:0})}))));
      assert.equal(opens.filter(r=>r.status===201).length,1);
    });
    await t.test('session logout and account changes invalidate signed cookies',async()=>{
      await client.query("UPDATE core.users SET pin_hash=crypt('test-only-password',gen_salt('bf',4)) WHERE id=$1",[owner]);
      const response=await login(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({username:'admin',pin:'test-only-password'})}));
      assert.equal(response.status,200,await response.clone().text());
      const cookie=response.headers.get('set-cookie')!.split(';')[0];
      const authenticated=()=>new NextRequest('http://localhost/api/products',{headers:{cookie}});
      assert.equal((await proxy(authenticated())).status,200);
      await logout(new NextRequest('http://localhost/api/auth/logout',{method:'POST',headers:{cookie,'x-user-id':owner}}));
      assert.equal((await proxy(authenticated())).status,401);
      const nextLogin=await login(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({username:'admin',pin:'test-only-password'})}));
      const cookie2=nextLogin.headers.get('set-cookie')!.split(';')[0];
      await client.query('UPDATE core.users SET is_active=false WHERE id=$1',[owner]);
      assert.equal((await proxy(new NextRequest('http://localhost/api/products',{headers:{cookie:cookie2}}))).status,401);
    });
    await t.test('failed migration rolls back DDL and never records success',async()=>{
      await writeFile(path.join(oldDir,'999_failure.sql'),'CREATE TABLE warung.must_rollback(id int); SELECT no_such_column;');
      await assert.rejects(migrate(client,oldDir));
      assert.equal((await client.query("SELECT to_regclass('warung.must_rollback') AS name")).rows[0].name,null);
      assert.equal((await client.query("SELECT 1 FROM warung.schema_migrations WHERE filename='999_failure.sql'")).rows.length,0);
    });
  } finally {
    db.query=originalQuery;db.connect=originalConnect;
    await pg.close();await rm(oldDir,{recursive:true,force:true});await db.end();
  }
});
