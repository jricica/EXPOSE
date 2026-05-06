import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ddbDocClient } from '../config/dynamo';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../config/logger';
import * as Sentry from '@sentry/node';
import * as fs from 'fs';
import * as path from 'path';

const getPackageVersion = (): string => {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
};

export const healthCheck = async (_req: Request, res: Response) => {
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
    if (process.env.DB_HOST && process.env.DB_NAME) {
      try {
        const prisma = new PrismaClient({ log: ['error'] });
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
      checks.checks.database = { status: 'skipped', reason: 'Database not configured', type: 'mysql' };
    }

    if (process.env.AWS_REGION && process.env.DYNAMO_RELATIONSHIPS_TABLE) {
      try {
        await ddbDocClient.send(new DescribeTableCommand({ TableName: process.env.DYNAMO_RELATIONSHIPS_TABLE }));
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
      checks.checks.dynamodb = { status: 'skipped', reason: 'DynamoDB not configured', type: 'dynamodb' };
    }

    const memUsage = process.memoryUsage();
    checks.checks.memory = {
      status: memUsage.heapUsed / memUsage.heapTotal > 0.9 ? 'warning' : 'healthy',
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      percentage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`
    };

    checks.checks.responseTime = { status: 'healthy', duration: `${Date.now() - startTime}ms` };

    checks.checks.overall = {
      status: overallStatus,
      totalChecks: Object.keys(checks.checks).length,
      healthyChecks: Object.values(checks.checks).filter((c: any) => c.status === 'healthy').length
    };

    res.status(overallStatus === 'healthy' ? 200 : 503).json(checks);
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
};

export const readinessCheck = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    service: 'expose-backend'
  });
};

export const metricsCheck = (_req: Request, res: Response) => {
  res.status(200).json({
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
  });
};
