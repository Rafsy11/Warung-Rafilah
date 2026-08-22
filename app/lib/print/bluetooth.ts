/**
 * Web Bluetooth Thermal Printer (ESC/POS) Utility for Mobile & Tablet POS
 * Connects directly to Bluetooth 58mm/80mm Thermal Printers via Web Bluetooth API.
 */

import type { ReceiptData, WarungReceiptData, AgentReceiptData } from './receipt';

const ESC = '\x1B';
const GS = '\x1D';

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function padLine(left: string, right: string, width = 32): string {
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
}

export function generateEscPosCommands(data: ReceiptData, charWidth = 32): Uint8Array {
  let text = '';

  // Initialize printer
  text += `${ESC}@`;

  // Center align & Bold Title
  text += `${ESC}a\x01`; // Align center
  text += `${ESC}E\x01`; // Bold ON
  text += 'WARUNG RAFILAH\n';
  text += `${ESC}E\x00`; // Bold OFF
  text += 'Jl. Mawar No.2335, Sukarami\n';
  text += 'Telp: 082339176569\n';
  text += '-'.repeat(charWidth) + '\n';

  if (data.type === 'warung') {
    const d = data as WarungReceiptData;
    const ts = new Date(d.timestamp);
    const dateStr = `${ts.toLocaleDateString('id-ID')} ${ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

    text += `${ESC}a\x00`; // Align left
    text += `No   : ${d.transaction_code}\n`;
    text += `Waktu: ${dateStr}\n`;
    text += `Kasir: ${d.cashier}\n`;
    text += '-'.repeat(charWidth) + '\n';

    d.items.forEach(item => {
      text += `${item.name}\n`;
      const qtyPrice = `${item.qty} x ${formatRp(item.unit_price)}`;
      const subtotal = formatRp(item.subtotal);
      text += padLine(qtyPrice, subtotal, charWidth) + '\n';
    });

    text += '-'.repeat(charWidth) + '\n';
    text += `${ESC}E\x01`; // Bold ON
    text += padLine('TOTAL', formatRp(d.total), charWidth) + '\n';
    text += `${ESC}E\x00`; // Bold OFF

    if (d.discount && d.discount > 0) {
      text += padLine('Hemat', formatRp(d.discount), charWidth) + '\n';
    }

    text += padLine(`Bayar (${d.payment_method})`, formatRp(d.payment_received), charWidth) + '\n';
    text += padLine('Kembali', formatRp(d.change), charWidth) + '\n';
  } else {
    const d = data as AgentReceiptData;
    const ts = new Date(d.timestamp);
    const dateStr = `${ts.toLocaleDateString('id-ID')} ${ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

    text += `${ESC}a\x00`; // Align left
    text += `No   : ${d.transaction_code}\n`;
    text += `Waktu: ${dateStr}\n`;
    text += `Layanan: ${d.service_label}\n`;
    if (d.customer_phone) text += `No.HP  : ${d.customer_phone}\n`;
    text += '-'.repeat(charWidth) + '\n';
    text += padLine('Nominal', formatRp(d.amount), charWidth) + '\n';
    text += padLine('Biaya Admin', formatRp(d.admin_fee), charWidth) + '\n';
    text += '-'.repeat(charWidth) + '\n';
    text += `${ESC}E\x01`; // Bold ON
    text += padLine('TOTAL BAYAR', formatRp(d.total_charge), charWidth) + '\n';
    text += `${ESC}E\x00`; // Bold OFF
  }

  // Footer
  text += '-'.repeat(charWidth) + '\n';
  text += `${ESC}a\x01`; // Align center
  text += 'Terima Kasih Atas Kunjungan Anda\n';
  text += 'Barang yg dibeli tdk dpt ditukar\n\n\n\n';
  text += `${GS}V\x00`; // Full cut (if supported)

  const encoder = new TextEncoder();
  return encoder.encode(text);
}

let cachedBluetoothDevice: any = null;
let cachedCharacteristic: any = null;

export async function printViaBluetooth(data: ReceiptData): Promise<boolean> {
  if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
    throw new Error('Web Bluetooth tidak didukung pada browser ini. Gunakan Chrome di Android.');
  }

  try {
    let characteristic = cachedCharacteristic;

    if (!characteristic || !cachedBluetoothDevice?.gatt?.connected) {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      const server = await device.gatt.connect();
      cachedBluetoothDevice = device;

      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            cachedCharacteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }
    }

    if (!characteristic) {
      throw new Error('Tidak dapat menemukan characteristic printer untuk menulis data.');
    }

    const payload = generateEscPosCommands(data);
    // Send in chunks of 512 bytes for Bluetooth LE MTU limits
    const chunkSize = 512;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      await characteristic.writeValue(chunk);
    }

    return true;
  } catch (err) {
    console.error('Bluetooth Print Error:', err);
    throw err;
  }
}
