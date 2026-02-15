import { query, getRow, insert } from '../lib/db.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeInput, validateNumber } from '../lib/auth.js';

export default async function inventoryRoutes(fastify) {
  /**
   * Get inventory history
   */
  fastify.get('/history', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const page = Math.max(1, parseInt(request.query.page) || 1);
      const limit = Math.min(100, parseInt(request.query.limit) || 20);
      const offset = (page - 1) * limit;

      const history = await query(
        `SELECT 
          i.id,
          p.nama as produk,
          i.stok_in,
          i.stok_out,
          i.deskripsi,
          i.tanggal
        FROM inventory i
        JOIN produk p ON i.produk_id = p.id
        WHERE i.user_id = ?
        ORDER BY i.tanggal DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      const countData = await getRow(
        'SELECT COUNT(*) as total FROM inventory WHERE user_id = ?',
        [userId]
      );

      return reply.send({
        success: true,
        data: history,
        pagination: {
          page,
          limit,
          total: countData.total,
          total_pages: Math.ceil(countData.total / limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengambil riwayat inventory'
      });
    }
  });

  /**
   * Add inventory entry
   */
  fastify.post('/entry', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { produk_id, stok_in, stok_out, deskripsi } = request.body;
      const userId = request.user.id;

      // Validation
      if (!Number.isInteger(Number(produk_id)) || Number(produk_id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID produk tidak valid'
        });
      }

      // Check product exists and belongs to user
      const product = await getRow(
        'SELECT id, stok FROM produk WHERE id = ? AND user_id = ?',
        [produk_id, userId]
      );

      if (!product) {
        return reply.status(404).send({
          success: false,
          message: 'Produk tidak ditemukan'
        });
      }

      const inStock = stok_in !== undefined ? validateNumber(stok_in) : 0;
      const outStock = stok_out !== undefined ? validateNumber(stok_out) : 0;

      if (inStock < 0 || outStock < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Nilai stok tidak valid'
        });
      }

      if (inStock === 0 && outStock === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Minimal satu nilai stok harus lebih dari 0'
        });
      }

      // Check if stock will be negative
      const newStock = product.stok + inStock - outStock;
      if (newStock < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Stok tidak mencukupi untuk pengurangan'
        });
      }

      const cleanDesc = deskripsi ? sanitizeInput(deskripsi).trim() : '';

      // Insert inventory entry and update product stock
      const conn = await fastify.db.getConnection();
      try {
        await conn.beginTransaction();

        const result = await conn.execute(
          'INSERT INTO inventory (user_id, produk_id, stok_in, stok_out, deskripsi, tanggal) VALUES (?, ?, ?, ?, ?, NOW())',
          [userId, produk_id, inStock, outStock, cleanDesc || null]
        );

        await conn.execute(
          'UPDATE produk SET stok = stok + ? - ? WHERE id = ?',
          [inStock, outStock, produk_id]
        );

        await conn.commit();

        return reply.status(201).send({
          success: true,
          message: 'Entry inventory berhasil ditambahkan',
          data: {
            id: result[0].insertId,
            produk_id,
            stok_in: inStock,
            stok_out: outStock,
            deskripsi: cleanDesc || ''
          }
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menambahkan inventory'
      });
    }
  });

  /**
   * Update inventory entry
   */
  fastify.put('/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { stok_in, stok_out, deskripsi } = request.body;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID inventory tidak valid'
        });
      }

      // Get existing entry
      const existing = await getRow(
        'SELECT produk_id, stok_in, stok_out FROM inventory WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!existing) {
        return reply.status(404).send({
          success: false,
          message: 'Entry inventory tidak ditemukan'
        });
      }

      const newInStock = stok_in !== undefined ? validateNumber(stok_in) : existing.stok_in;
      const newOutStock = stok_out !== undefined ? validateNumber(stok_out) : existing.stok_out;

      if (newInStock < 0 || newOutStock < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Nilai stok tidak valid'
        });
      }

      if (newInStock === 0 && newOutStock === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Minimal satu nilai stok harus lebih dari 0'
        });
      }

      // Check new stock value
      const product = await getRow(
        'SELECT stok FROM produk WHERE id = ?',
        [existing.produk_id]
      );

      const oldDifference = existing.stok_in - existing.stok_out;
      const newDifference = newInStock - newOutStock;
      const finalStock = product.stok - oldDifference + newDifference;

      if (finalStock < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Stok tidak mencukupi untuk pengurangan'
        });
      }

      const cleanDesc = deskripsi !== undefined ? (deskripsi ? sanitizeInput(deskripsi).trim() : '') : null;

      const conn = await fastify.db.getConnection();
      try {
        await conn.beginTransaction();

        const updates = [];
        const params = [];

        if (stok_in !== undefined) {
          updates.push('stok_in = ?');
          params.push(newInStock);
        }
        if (stok_out !== undefined) {
          updates.push('stok_out = ?');
          params.push(newOutStock);
        }
        if (deskripsi !== undefined) {
          updates.push('deskripsi = ?');
          params.push(cleanDesc);
        }

        if (updates.length > 0) {
          params.push(id);
          params.push(userId);
          const sql = `UPDATE inventory SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
          await conn.execute(sql, params);
        }

        // Update product stock
        await conn.execute(
          'UPDATE produk SET stok = stok - ? - ? + ? + ? WHERE id = ?',
          [existing.stok_in, existing.stok_out, newInStock, newOutStock, existing.produk_id]
        );

        await conn.commit();

        return reply.send({
          success: true,
          message: 'Entry inventory berhasil diupdate'
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengupdate inventory'
      });
    }
  });

  /**
   * Delete inventory entry
   */
  fastify.delete('/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID inventory tidak valid'
        });
      }

      const existing = await getRow(
        'SELECT produk_id, stok_in, stok_out FROM inventory WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!existing) {
        return reply.status(404).send({
          success: false,
          message: 'Entry inventory tidak ditemukan'
        });
      }

      const conn = await fastify.db.getConnection();
      try {
        await conn.beginTransaction();

        await conn.execute(
          'DELETE FROM inventory WHERE id = ? AND user_id = ?',
          [id, userId]
        );

        // Reverse the stock adjustment
        await conn.execute(
          'UPDATE produk SET stok = stok - ? + ? WHERE id = ?',
          [existing.stok_in, existing.stok_out, existing.produk_id]
        );

        await conn.commit();

        return reply.send({
          success: true,
          message: 'Entry inventory berhasil dihapus'
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menghapus inventory'
      });
    }
  });
}
