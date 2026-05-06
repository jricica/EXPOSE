import { Router } from 'express';
import { healthCheck, readinessCheck, metricsCheck } from '../controllers/health.controller';

const router = Router();

router.get('/health', healthCheck);
router.get('/ready', readinessCheck);
router.get('/metrics', metricsCheck);

export default router;
