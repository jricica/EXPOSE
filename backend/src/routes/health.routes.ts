import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ddbDocClient } from '../config/dynamo';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../config/logger';
import * as Sentry from '@sentry/node';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

// Helper function to get package version
const getPackageVersion = (): string => {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
};

// Health check endpoint for ALB
router.get('/health', async (req: Request, res: Response) => {
  const checks = {
    timestamp: new Date().toISOString(),
    service: 'expose-backend',
    version: getPackageVersion(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    checks: {} as Record<string, any>
  };

  let overallStatus = 'healthy';
  const startTime = Date.now();

  try {
    // Database connectivity check (only if DB is configured)
    if (process.env.DB_HOST && process.env.DB_NAME) {
      try {
        const prisma = new PrismaClient({
          log: ['error'],
        });
        await prisma.$queryRaw`SELECT 1 as health_check`;
        await prisma.$disconnect();
        checks.checks.database = {
          status: 'healthy',
          responseTime: `${Date.now() - startTime}ms`,
          type: 'mysql'
        };
      } catch (error) {
        checks.checks.database = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'mysql'
        };
        overallStatus = 'unhealthy';
        logger.error('Database health check failed', { error });
      }
    } else {
      checks.checks.database = {
        status: 'skipped',
        reason: 'Database not configured',
        type: 'mysql'
      };
    }

    // DynamoDB connectivity check (only if AWS is configured)
    if (process.env.AWS_REGION && process.env.DYNAMO_RELATIONSHIPS_TABLE) {
      try {
        const command = new DescribeTableCommand({
          TableName: process.env.DYNAMO_RELATIONSHIPS_TABLE
        });
        await ddbDocClient.send(command);
        checks.checks.dynamodb = {
          status: 'healthy',
          responseTime: `${Date.now() - startTime}ms`,
          type: 'dynamodb'
        };
      } catch (error) {
        checks.checks.dynamodb = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'dynamodb'
        };
        overallStatus = 'unhealthy';
        logger.error('DynamoDB health check failed', { error });
      }
    } else {
      checks.checks.dynamodb = {
        status: 'skipped',
        reason: 'DynamoDB not configured',
        type: 'dynamodb'
      };
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    checks.checks.memory = {
      status: memUsage.heapUsed / memUsage.heapTotal > 0.9 ? 'warning' : 'healthy',
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      percentage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`
    };

    // Response time check
    checks.checks.responseTime = {
      status: 'healthy',
      duration: `${Date.now() - startTime}ms`
    };

    // Overall status
    checks.checks.overall = {
      status: overallStatus,
      totalChecks: Object.keys(checks.checks).length,
      healthyChecks: Object.values(checks.checks).filter((check: any) => check.status === 'healthy').length
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);

  } catch (error) {
    logger.error('Health check failed', { error });
    Sentry.captureException(error);

    res.status(503).json({
      timestamp: new Date().toISOString(),
      service: 'expose-backend',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Readiness check (for Kubernetes/ECS deployments)
router.get('/ready', async (req: Request, res: Response) => {
  // Simple readiness check - just verify the service is running
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    service: 'expose-backend'
  });
});

// Metrics endpoint (for monitoring systems)
router.get('/metrics', async (req: Request, res: Response) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    service: 'expose-backend',
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  res.status(200).json(metrics);
});

export default router;