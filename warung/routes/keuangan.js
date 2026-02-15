import { query, getRow, insert } from '../lib/db.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeInput, validateNumber } from '../lib/auth.js';

export default async function keuanganRoutes(fastify) {
  /**
   * Get income history
   */
  fastify.get('/pemasukkan', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const page = Math.max(1, parseInt(request.query.page) || 1);
      const limit = Math.min(100, parseInt(request.query.limit) || 20);
      const offset = (page - 1) * limit;

      const pemasukkan = await query(
        `SELECT 
          id,
          deskripsi,
          jumlah,
          tanggal
        FROM pemasukkan
        WHERE user_id = ?
        ORDER BY tanggal DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      const countData = await getRow(
        'SELECT COUNT(*) as total FROM pemasukkan WHERE user_id = ?',
        [userId]
      );

      const totalData = await getRow(
        'SELECT COALESCE(SUM(jumlah), 0) as total FROM pemasukkan WHERE user_id = ?',
        [userId]
      );

      return reply.send({
        success: true,
        data: pemasukkan,
        summary: {
          total: parseFloat(totalData.total) || 0
        },
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
        message: 'Gagal mengambil data pemasukkan'
      });
    }
  });

  /**
   * Get expense history
   */
  fastify.get('/pengeluaran', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const page = Math.max(1, parseInt(request.query.page) || 1);
      const limit = Math.min(100, parseInt(request.query.limit) || 20);
      const offset = (page - 1) * limit;

      const pengeluaran = await query(
        `SELECT 
          id,
          deskripsi,
          jumlah,
          tanggal
        FROM pengeluaran
        WHERE user_id = ?
        ORDER BY tanggal DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      const countData = await getRow(
        'SELECT COUNT(*) as total FROM pengeluaran WHERE user_id = ?',
        [userId]
      );

      const totalData = await getRow(
        'SELECT COALESCE(SUM(jumlah), 0) as total FROM pengeluaran WHERE user_id = ?',
        [userId]
      );

      return reply.send({
        success: true,
        data: pengeluaran,
        summary: {
          total: parseFloat(totalData.total) || 0
        },
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
        message: 'Gagal mengambil data pengeluaran'
      });
    }
  });

  /**
   * Record income entry
   */
  fastify.post('/pemasukkan', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { deskripsi, jumlah } = request.body;
      const userId = request.user.id;

      // Validation
      const cleanDesc = sanitizeInput(deskripsi).trim();
      if (!cleanDesc || cleanDesc.length < 3) {
        return reply.status(400).send({
          success: false,
          message: 'Deskripsi minimal 3 karakter'
        });
      }

      const amount = validateNumber(jumlah);
      if (amount <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'Jumlah harus lebih dari 0'
        });
      }

      // Insert
      const result = await insert(
        'INSERT INTO pemasukkan (user_id, deskripsi, jumlah, tanggal) VALUES (?, ?, ?, NOW())',
        [userId, cleanDesc, amount]
      );

      return reply.status(201).send({
        success: true,
        message: 'Pemasukkan berhasil ditambahkan',
        data: {
          id: result.insertId,
          deskripsi: cleanDesc,
          jumlah: amount
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menambahkan pemasukkan'
      });
    }
  });

  /**
   * Record expense entry
   */
  fastify.post('/pengeluaran', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { deskripsi, jumlah } = request.body;
      const userId = request.user.id;

      // Validation
      const cleanDesc = sanitizeInput(deskripsi).trim();
      if (!cleanDesc || cleanDesc.length < 3) {
        return reply.status(400).send({
          success: false,
          message: 'Deskripsi minimal 3 karakter'
        });
      }

      const amount = validateNumber(jumlah);
      if (amount <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'Jumlah harus lebih dari 0'
        });
      }

      // Insert
      const result = await insert(
        'INSERT INTO pengeluaran (user_id, deskripsi, jumlah, tanggal) VALUES (?, ?, ?, NOW())',
        [userId, cleanDesc, amount]
      );

      return reply.status(201).send({
        success: true,
        message: 'Pengeluaran berhasil ditambahkan',
        data: {
          id: result.insertId,
          deskripsi: cleanDesc,
          jumlah: amount
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menambahkan pengeluaran'
      });
    }
  });

  /**
   * Update income entry
   */
  fastify.put('/pemasukkan/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { deskripsi, jumlah } = request.body;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID tidak valid'
        });
      }

      // Check exists
      const existing = await getRow(
        'SELECT id FROM pemasukkan WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!existing) {
        return reply.status(404).send({
          success: false,
          message: 'Data pemasukkan tidak ditemukan'
        });
      }

      // Validation
      const updates = [];
      const params = [];

      if (deskripsi !== undefined) {
        const cleanDesc = sanitizeInput(deskripsi).trim();
        if (!cleanDesc || cleanDesc.length < 3) {
          return reply.status(400).send({
            success: false,
            message: 'Deskripsi minimal 3 karakter'
          });
        }
        updates.push('deskripsi = ?');
        params.push(cleanDesc);
      }

      if (jumlah !== undefined) {
        const amount = validateNumber(jumlah);
        if (amount <= 0) {
          return reply.status(400).send({
            success: false,
            message: 'Jumlah harus lebih dari 0'
          });
        }
        updates.push('jumlah = ?');
        params.push(amount);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Tidak ada data yang diupdate'
        });
      }

      params.push(id);
      params.push(userId);

      const sql = `UPDATE pemasukkan SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
      await query(sql, params);

      return reply.send({
        success: true,
        message: 'Pemasukkan berhasil diupdate'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengupdate pemasukkan'
      });
    }
  });

  /**
   * Update expense entry
   */
  fastify.put('/pengeluaran/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { deskripsi, jumlah } = request.body;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID tidak valid'
        });
      }

      // Check exists
      const existing = await getRow(
        'SELECT id FROM pengeluaran WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!existing) {
        return reply.status(404).send({
          success: false,
          message: 'Data pengeluaran tidak ditemukan'
        });
      }

      // Validation
      const updates = [];
      const params = [];

      if (deskripsi !== undefined) {
        const cleanDesc = sanitizeInput(deskripsi).trim();
        if (!cleanDesc || cleanDesc.length < 3) {
          return reply.status(400).send({
            success: false,
            message: 'Deskripsi minimal 3 karakter'
          });
        }
        updates.push('deskripsi = ?');
        params.push(cleanDesc);
      }

      if (jumlah !== undefined) {
        const amount = validateNumber(jumlah);
        if (amount <= 0) {
          return reply.status(400).send({
            success: false,
            message: 'Jumlah harus lebih dari 0'
          });
        }
        updates.push('jumlah = ?');
        params.push(amount);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Tidak ada data yang diupdate'
        });
      }

      params.push(id);
      params.push(userId);

      const sql = `UPDATE pengeluaran SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
      await query(sql, params);

      return reply.send({
        success: true,
        message: 'Pengeluaran berhasil diupdate'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengupdate pengeluaran'
      });
    }
  });

  /**
   * Delete income entry
   */
  fastify.delete('/pemasukkan/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID tidak valid'
        });
      }

      const result = await query(
        'DELETE FROM pemasukkan WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return reply.status(404).send({
          success: false,
          message: 'Data pemasukkan tidak ditemukan'
        });
      }

      return reply.send({
        success: true,
        message: 'Pemasukkan berhasil dihapus'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menghapus pemasukkan'
      });
    }
  });

  /**
   * Delete expense entry
   */
  fastify.delete('/pengeluaran/:id', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return reply.status(400).send({
          success: false,
          message: 'ID tidak valid'
        });
      }

      const result = await query(
        'DELETE FROM pengeluaran WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return reply.status(404).send({
          success: false,
          message: 'Data pengeluaran tidak ditemukan'
        });
      }

      return reply.send({
        success: true,
        message: 'Pengeluaran berhasil dihapus'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal menghapus pengeluaran'
      });
    }
  });
}
