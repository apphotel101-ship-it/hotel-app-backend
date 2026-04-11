import { Request, Response } from 'express';
import { uploadBuffer } from '../lib/cloudinary';

// POST /api/v1/upload/image  (Both guest and admin)
export async function uploadImage(req: Request, res: Response): Promise<void> {
  if (!req.file) { res.status(400).json({ message: 'No image file provided' }); return; }

  const imageUrl = await uploadBuffer(req.file.buffer, 'hotel-app-uploads');
  res.status(201).json({ image_url: imageUrl });
}
