import { query, getRow } from '../lib/db.js';
import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify) {
  /**
   * Get dashboard stats
   */
  fastify.get('/stats', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Get stock value
      const stockData = await getRow(
        'SELECT COALESCE(SUM(stok * harga_beli), 0) as total FROM produk WHERE user_id = ?',
        [userId]
      );

      // Get income
      const incomeData = await getRow(
        'SELECT COALESCE(SUM(jumlah), 0) as total FROM pemasukkan WHERE user_id = ? AND tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
        [userId]
      );

      // Get expenses
      const expenseData = await getRow(
        'SELECT COALESCE(SUM(jumlah), 0) as total FROM pengeluaran WHERE user_id = ? AND tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
        [userId]
      );

      const stockValue = parseFloat(stockData.total) || 0;
      const income = parseFloat(incomeData.total) || 0;
      const expenses = parseFloat(expenseData.total) || 0;

      return reply.send({
        success: true,
        data: {
          stok_value: stockValue,
          pemasukkan: income,
          pengeluaran: expenses,
          keuntungan_bersih: income - expenses
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengambil data dashboard'
      });
    }
  });

  /**
   * Get top products
   */
  fastify.get('/products', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;

      const products = await query(
        'SELECT id, nama, stok, harga_jual FROM produk WHERE user_id = ? ORDER BY stok DESC LIMIT 5',
        [userId]
      );

      return reply.send({
        success: true,
        data: products
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengambil data produk'
      });
    }
  });

  /**
   * Get recent transactions
   */
  fastify.get('/transactions', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user.id;

      const transactions = await query(
        `
        SELECT 
          'Pemasukkan' as type, 
          deskripsi, 
          jumlah, 
          tanggal 
        FROM pemasukkan 
        WHERE user_id = ?
        UNION ALL
        SELECT 
          'Pengeluaran' as type, 
          deskripsi, 
          jumlah, 
          tanggal 
        FROM pengeluaran 
        WHERE user_id = ?
        ORDER BY tanggal DESC
        LIMIT 10
        `,
        [userId, userId]
      );

      return reply.send({
        success: true,
        data: transactions
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengambil data transaksi'
      });
    }
  });
}
