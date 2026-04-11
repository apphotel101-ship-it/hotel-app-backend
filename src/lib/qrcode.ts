import QRCode from 'qrcode';

export async function generateQRBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: 'png', width: 400, margin: 2 });
}
