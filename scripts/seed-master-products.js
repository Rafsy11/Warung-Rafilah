/**
 * HIGH-SPEED BULK SEEDER FOR LOCAL MASTER PRODUCTS (KAMUS PRODUK LOKAL)
 * ---------------------------------------------------------------------
 * Parses open-source FMCG product dataset (JSON/CSV) and performs
 * chunked bulk inserts (1,000 rows/batch) into PostgreSQL 'warung.local_master_products'.
 * Handled with ON CONFLICT (barcode) DO UPDATE to prevent memory overflow and duplicates.
 */

let Pool;
try {
  Pool = require('pg').Pool;
} catch {
  Pool = require('../app/node_modules/pg').Pool;
}
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres_password_99@127.0.0.1:5432/warung_db',
});

// Sample Open-Source Indonesian FMCG Master Barcode Dataset (Demonstration Dataset)
const SAMPLE_FMCG_DATASET = [
  { barcode: '8886008101053', nama_barang: 'Aqua Air Mineral 600ml', kategori: 'Minuman', brand: 'Aqua' },
  { barcode: '8998866200018', nama_barang: 'Indomie Goreng Spesial 85g', kategori: 'Makanan Instant', brand: 'Indomie' },
  { barcode: '8998866200216', nama_barang: 'Indomie Kuah Rasa Ayam Bawang 75g', kategori: 'Makanan Instant', brand: 'Indomie' },
  { barcode: '8998866200315', nama_barang: 'Indomie Kuah Rasa Soto Mie 75g', kategori: 'Makanan Instant', brand: 'Indomie' },
  { barcode: '8998888110012', nama_barang: 'Teh Pucuk Harum 350ml', kategori: 'Minuman', brand: 'Mayora' },
  { barcode: '8996001300016', nama_barang: 'Le Minerale Air Mineral 600ml', kategori: 'Minuman', brand: 'Mayora' },
  { barcode: '8999999002123', nama_barang: 'Pristine 8.6+ Air Mineral 600ml', kategori: 'Minuman', brand: 'Pristine' },
  { barcode: '8992753100014', nama_barang: 'Ultra Milk Cokelat 250ml', kategori: 'Minuman', brand: 'Ultra Jaya' },
  { barcode: '8992753100021', nama_barang: 'Ultra Milk Full Cream 250ml', kategori: 'Minuman', brand: 'Ultra Jaya' },
  { barcode: '8991002100019', nama_barang: 'Kopi Kapal Api Special Mix 20g', kategori: 'Kopi & Teh', brand: 'Kapal Api' },
  { barcode: '8999908000012', nama_barang: 'Sampoerna A Mild 16', kategori: 'Rokok', brand: 'Sampoerna' },
  { barcode: '8999908000029', nama_barang: 'Gudang Garam International 12', kategori: 'Rokok', brand: 'Gudang Garam' },
  { barcode: '8998888300017', nama_barang: 'Minyak Goreng Bimoli Pouch 2L', kategori: 'Sembako', brand: 'Bimoli' },
  { barcode: '8998888400014', nama_barang: 'Gula Pasir Gulaku Premium 1kg', kategori: 'Sembako', brand: 'Gulaku' },
  { barcode: '8991001000013', nama_barang: 'Beras Ramos Super 5kg', kategori: 'Sembako', brand: 'Ramos' },
  { barcode: '8999999100010', nama_barang: 'Sabun Batang Lifebuoy Red 110g', kategori: 'Perawatan Diri', brand: 'Lifebuoy' },
  { barcode: '8999999200017', nama_barang: 'Shampoo Pantene Anti Dandruff 160ml', kategori: 'Perawatan Diri', brand: 'Pantene' },
  { barcode: '8999999300014', nama_barang: 'Pasta Gigi Pepsodent White 190g', kategori: 'Perawatan Diri', brand: 'Pepsodent' },
  { barcode: '8999999400011', nama_barang: 'Deterjen Rinso Anti Noda 770g', kategori: 'Kebutuhan Rumah', brand: 'Rinso' },
  { barcode: '8999999500018', nama_barang: 'Sunlight Jeruk Nipis 755ml', kategori: 'Kebutuhan Rumah', brand: 'Sunlight' },
];

/**
 * Generate synthetic dataset up to N items for stress testing bulk inserts
 */
function generateLargeDataset(count = 50000) {
  const result = [...SAMPLE_FMCG_DATASET];
  const categories = ['Makanan Instant', 'Minuman', 'Sembako', 'Perawatan Diri', 'Kebutuhan Rumah', 'Snack', 'Rokok'];
  const brands = ['Indofood', 'Mayora', 'Unilever', 'Wings', 'Nestle', 'ABC', 'Garudafood'];

  for (let i = result.length + 1; i <= count; i++) {
    const barcode = `899${String(i).padStart(10, '0')}`;
    const cat = categories[i % categories.length];
    const brand = brands[i % brands.length];
    result.push({
      barcode,
      nama_barang: `${brand} Product Variant Super ${i}`,
      kategori: cat,
      brand: brand,
    });
  }
  return result;
}

async function bulkSeedMasterProducts() {
  const startTime = Date.now();
  console.log('🚀 Starting High-Speed Master Product Seeder...');

  const client = await pool.connect();
  try {
    // 1. Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS warung.local_master_products (
        barcode         VARCHAR(64) PRIMARY KEY,
        nama_barang     VARCHAR(150) NOT NULL,
        kategori        VARCHAR(50) NOT NULL DEFAULT 'Umum',
        brand           VARCHAR(50) DEFAULT 'Generik',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 2. Load dataset (synthetic or from JSON file)
    const jsonPath = path.join(__dirname, '../data/fmcg_master_products.json');
    let dataset = [];

    if (fs.existsSync(jsonPath)) {
      console.log(`📂 Reading master dataset from JSON file: ${jsonPath}`);
      const fileData = fs.readFileSync(jsonPath, 'utf8');
      dataset = JSON.parse(fileData);
    } else {
      console.log('⚡ JSON file not found. Generating 50,000 FMCG Master Barcode records in memory...');
      dataset = generateLargeDataset(50000);
    }

    console.log(`📦 Total Master Product Records to Insert: ${dataset.length.toLocaleString('id-ID')}`);

    // 3. Batch processing parameters
    const CHUNK_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < dataset.length; i += CHUNK_SIZE) {
      const chunk = dataset.slice(i, i + CHUNK_SIZE);

      // Build parameterized query for the chunk
      const valueTuples = [];
      const queryParams = [];
      let paramIdx = 1;

      for (const item of chunk) {
        valueTuples.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
        queryParams.push(item.barcode, item.nama_barang, item.kategori || 'Umum', item.brand || 'Generik');
        paramIdx += 4;
      }

      const bulkInsertQuery = `
        INSERT INTO warung.local_master_products (barcode, nama_barang, kategori, brand)
        VALUES ${valueTuples.join(', ')}
        ON CONFLICT (barcode) DO UPDATE SET
          nama_barang = EXCLUDED.nama_barang,
          kategori = EXCLUDED.kategori,
          brand = EXCLUDED.brand,
          updated_at = now();
      `;

      await client.query(bulkInsertQuery, queryParams);
      totalInserted += chunk.length;

      const progress = ((totalInserted / dataset.length) * 100).toFixed(1);
      process.stdout.write(`\r⏳ Processing Chunk: ${totalInserted.toLocaleString('id-ID')} / ${dataset.length.toLocaleString('id-ID')} (${progress}%)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Bulk Seeding Completed Successfully!`);
    console.log(`📊 Stats: ${totalInserted.toLocaleString('id-ID')} records inserted/updated in ${duration} seconds.`);

  } catch (err) {
    console.error('\n❌ Bulk Seeder Failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute if called directly
if (require.main === module) {
  bulkSeedMasterProducts();
}

module.exports = { bulkSeedMasterProducts };
