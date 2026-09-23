import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })));
  }
  return result.data;
}

export const uuid = z.uuid();
