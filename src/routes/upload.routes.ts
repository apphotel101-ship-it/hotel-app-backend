import { Router } from 'express';
import multer from 'multer';
import { authenticateAny } from '../middlewares/authenticate';
import * as ctrl from '../controllers/upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();

router.post('/upload/image', authenticateAny, upload.single('image'), ctrl.uploadImage);

export default router;
