import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number },
) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}
