import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validate request body against a Zod schema.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw result.error;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate request query params against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw result.error;
    }
    req.query = result.data;
    next();
  };
}
