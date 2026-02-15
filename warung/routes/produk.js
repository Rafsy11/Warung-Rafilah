import { query, getRow, insert } from '../lib/db.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeInput, validateNumber } from '../lib/auth.js';

export default async function produkRoutes(fastify) {
  /**
   * Get all products
   */
  fastify.get('/', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const page = Math.max(1, parseInt(request.query.page) || 1);
      const limit = Math.min(100, parseInt(request.query.limit) || 20);
      const offset = (page - 1) * limit;

      const products = await query(
        'SELECT id, nama, harga_beli, harga_jual, stok, deskripsi, created_at FROM produk WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, limit, offset]
      );

      const countData = await getRow(
        'SELECT COUNT(*) as total FROM produk WHERE user_id = ?',
        [userId]
      );

      return reply.send({
        success: true,
        data: products,
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
        message: 'Gagal mengambil daftar produk'
      });
    }
  });

  /**
   * Get single product
   */
  fastify.get('/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID produk tidak valid'
        });
      }

      const product = await getRow(
        'SELECT id, nama, harga_beli, harga_jual, stok, deskripsi, created_at FROM produk WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!product) {
        return reply.status(404).send({
          success: false,
          message: 'Produk tidak ditemukan'
        });
      }

      return reply.send({
        success: true,
        data: product
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengambil detail produk'
      });
    }
  });

  /**
   * Create new product
   */
  fastify.post('/', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { nama, harga_beli, harga_jual, stok, deskripsi } = request.body;
      const userId = request.user.id;

      // Validation
      const cleanName = sanitizeInput(nama).trim();
      if (!cleanName || cleanName.length < 3) {
        return reply.status(400).send({
          success: false,
          message: 'Nama produk minimal 3 karakter'
        });
      }

      const buyPrice = validateNumber(harga_beli);
      if (buyPrice < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Harga beli tidak valid'
        });
      }

      const sellPrice = validateNumber(harga_jual);
      if (sellPrice < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Harga jual tidak valid'
        });
      }

      const stock = validateNumber(stok);
      if (stock < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Stok tidak valid'
        });
      }

      const cleanDesc = deskripsi ? sanitizeInput(deskripsi).trim() : '';

      // Insert
      const result = await insert(
        'INSERT INTO produk (user_id, nama, harga_beli, harga_jual, stok, deskripsi, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [userId, cleanName, buyPrice, sellPrice, stock, cleanDesc || null]
      );

      return reply.status(201).send({
        success: true,
        message: 'Produk berhasil ditambahkan',
        data: {
          id: result.insertId,
          nama: cleanName,
          harga_beli: buyPrice,
          harga_jual: sellPrice,
          stok: stock,
          deskripsi: cleanDesc || ''
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menambahkan produk'
      });
    }
  });

  /**
   * Update product
   */
  fastify.put('/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { nama, harga_beli, harga_jual, stok, deskripsi } = request.body;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID produk tidak valid'
        });
      }

      // Check product exists and belongs to user
      const existing = await getRow(
        'SELECT id FROM produk WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!existing) {
        return reply.status(404).send({
          success: false,
          message: 'Produk tidak ditemukan'
        });
      }

      // Validation
      const cleanName = nama ? sanitizeInput(nama).trim() : null;
      if (cleanName && cleanName.length < 3) {
        return reply.status(400).send({
          success: false,
          message: 'Nama produk minimal 3 karakter'
        });
      }

      const buyPrice = harga_beli !== undefined ? validateNumber(harga_beli) : null;
      if (buyPrice !== null && buyPrice < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Harga beli tidak valid'
        });
      }

      const sellPrice = harga_jual !== undefined ? validateNumber(harga_jual) : null;
      if (sellPrice !== null && sellPrice < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Harga jual tidak valid'
        });
      }

      const stock = stok !== undefined ? validateNumber(stok) : null;
      if (stock !== null && stock < 0) {
        return reply.status(400).send({
          success: false,
          message: 'Stok tidak valid'
        });
      }

      // Build update query
      const updates = [];
      const params = [];

      if (cleanName) {
        updates.push('nama = ?');
        params.push(cleanName);
      }
      if (buyPrice !== null) {
        updates.push('harga_beli = ?');
        params.push(buyPrice);
      }
      if (sellPrice !== null) {
        updates.push('harga_jual = ?');
        params.push(sellPrice);
      }
      if (stock !== null) {
        updates.push('stok = ?');
        params.push(stock);
      }
      if (deskripsi !== undefined) {
        const cleanDesc = deskripsi ? sanitizeInput(deskripsi).trim() : '';
        updates.push('deskripsi = ?');
        params.push(cleanDesc || null);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Tidak ada data yang diupdate'
        });
      }

      params.push(id);
      params.push(userId);

      const sql = `UPDATE produk SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
      await query(sql, params);

      return reply.send({
        success: true,
        message: 'Produk berhasil diupdate'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengupdate produk'
      });
    }
  });

  /**
   * Delete product
   */
  fastify.delete('/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID produk tidak valid'
        });
      }

      const result = await query(
        'DELETE FROM produk WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return reply.status(404).send({
          success: false,
          message: 'Produk tidak ditemukan'
        });
      }

      return reply.send({
        success: true,
        message: 'Produk berhasil dihapus'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menghapus produk'
      });
    }
  });
}
