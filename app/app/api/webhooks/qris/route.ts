import { NextResponse } from 'next/server';
import { verifyQrisSignature } from '@/lib/webhook-verify';
import { db as pool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-signature') || req.headers.get('x-qris-signature');
    const rawBody = await req.text();

    if (process.env.QRIS_WEBHOOK_SECRET && signature) {
      if (!verifyQrisSignature(rawBody, signature)) {
        return NextResponse.json({ error: { code: 'invalid_signature', message: 'Invalid webhook signature' } }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventId = String(payload.event_id || payload.qris_invoiceid || payload.cliTrxNumber || payload.invoiceNumber || `evt-${Date.now()}-${Math.floor(Math.random()*1000)}`);
    
    // Check if event already exists
    const eventCheck = await pool.query(
      'SELECT processed FROM agent.webhook_events WHERE event_id = $1',
      [eventId]
    );
    if (eventCheck.rows.length > 0) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const rawAmount = payload.amount || payload.cliTrxAmount || payload.final_amount || payload.total_amount || payload.cliTrxAmount;
    const amount = Number(rawAmount);

    const rawStatus = String(payload.status || payload.event || 'success').toLowerCase();
    const status = (rawStatus === 'paid' || rawStatus === 'payment.paid' || rawStatus === 'success') ? 'success' : 'failed';

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      let tx = null;

      if (payload.transaction_code || payload.cliTrxNumber) {
        const res = await client.query(
          'SELECT id, status, amount, agent_commission FROM agent.transactions WHERE transaction_code = $1 FOR UPDATE',
          [payload.transaction_code || payload.cliTrxNumber]
        );
        if (res.rows.length > 0) tx = res.rows[0];
      }
      
      if (!tx && (payload.transaction_id || payload.qris_invoiceid)) {
        const res = await client.query(
          'SELECT id, status, amount, agent_commission FROM agent.transactions WHERE id = $1 FOR UPDATE',
          [payload.transaction_id || payload.qris_invoiceid]
        );
        if (res.rows.length > 0) tx = res.rows[0];
      }

      if (!tx && payload.provider_ref_id) {
        const res = await client.query(
          'SELECT id, status, amount, agent_commission FROM agent.transactions WHERE provider_ref_id = $1 FOR UPDATE',
          [payload.provider_ref_id]
        );
        if (res.rows.length > 0) tx = res.rows[0];
      }

      if (!tx && amount) {
        // Fallback: match by amount and status = 'pending'
        const res = await client.query(
          `SELECT id, status, amount, agent_commission 
           FROM agent.transactions 
           WHERE status = 'pending' AND amount = $1 
           ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
          [amount]
        );
        if (res.rows.length > 0) tx = res.rows[0];
      }

      // Check if it's a retail sale if no agent transaction found
      if (!tx && amount) {
        const saleRes = await client.query(
          `SELECT id, transaction_code, status, total_amount 
           FROM warung.sales 
           WHERE status = 'pending' AND total_amount = $1 
           ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
          [amount]
        );
        if (saleRes.rows.length > 0) {
          const sale = saleRes.rows[0];

          if (status === 'success') {
            await client.query(
              `UPDATE warung.sales 
               SET status = 'completed', payment_received = total_amount 
               WHERE id = $1`,
              [sale.id]
            );
          } else if (status === 'failed') {
            const itemsRes = await client.query(
              "SELECT product_id, qty FROM warung.sale_items WHERE sale_id = $1",
              [sale.id]
            );
            for (const item of itemsRes.rows) {
              await client.query(
                "UPDATE warung.products SET stock_qty = stock_qty + $1 WHERE id = $2",
                [Number(item.qty), item.product_id]
              );
            }
            await client.query(
              `UPDATE warung.sales SET status = 'voided' WHERE id = $1`,
              [sale.id]
            );

            // Void associated agent transactions
            const agentTxRes = await client.query(
              "SELECT id, amount FROM agent.transactions WHERE provider_ref_id = $1 AND status = 'pending' FOR UPDATE",
              [sale.transaction_code]
            );
            for (const atx of agentTxRes.rows) {
              await client.query(
                "UPDATE agent.transactions SET status = 'failed' WHERE id = $1",
                [atx.id]
              );
              const ledgerResult = await client.query(
                'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
              );
              let currentFloat = ledgerResult.rows.length > 0 ? Number(ledgerResult.rows[0].balance_after) : 0;
              const refundAmount = Number(atx.amount);
              currentFloat += refundAmount;

              await client.query(
                `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['deposit_in', refundAmount, currentFloat, atx.id, `Refund modal karena pembatalan transaksi POS ${sale.transaction_code} via webhook`]
              );
            }
          }

          await client.query(
            `INSERT INTO agent.webhook_events (event_id, provider, payload, signature_valid, processed, related_tx_id, processed_at)
             VALUES ($1, $2, $3, true, true, null, now())`,
            [eventId, 'qris_provider', payload]
          );
        }
      }

      if (tx) {
        const relatedTxId = tx.id;
        const status = payload.status || 'success';

        // 1. Store webhook event for audit
        await client.query(
          `INSERT INTO agent.webhook_events (event_id, provider, payload, signature_valid, processed, related_tx_id, processed_at)
           VALUES ($1, $2, $3, true, true, $4, now())`,
          [eventId, 'qris_provider', payload, relatedTxId]
        );

        if (tx.status === 'pending') {
          // Fetch last ledger balance (lock for update)
          const ledgerResult = await client.query(
            'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
          );
          let currentFloat = ledgerResult.rows.length > 0 ? Number(ledgerResult.rows[0].balance_after) : 0;

          if (status === 'success') {
            // Credit commission
            const commission = Number(tx.agent_commission);
            if (commission > 0) {
              currentFloat += commission;
              await client.query(
                `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['commission_earned', commission, currentFloat, tx.id, 'Penerimaan komisi layanan (Laba Warung)']
              );
            }
          } else if (status === 'failed' || status === 'reversed') {
            // Refund principal amount
            const principal = Number(tx.amount);
            currentFloat += principal;
            await client.query(
              `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
               VALUES ($1, $2, $3, $4, $5)`,
              ['deposit_in', principal, currentFloat, tx.id, `Refund modal karena webhook transaksi ${status}`]
            );
          }

          // Update transaction status
          await client.query(
            `UPDATE agent.transactions 
             SET status = $1::varchar, provider_ref_id = COALESCE($2, provider_ref_id), settled_at = CASE WHEN $1::varchar = 'success' THEN now() ELSE settled_at END
             WHERE id = $3`,
            [status, payload.provider_ref_id || null, tx.id]
          );
        }
      }

      await client.query('COMMIT');
      return NextResponse.json({ received: true });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Error processing webhook' } }, { status: 500 });
  }
}
