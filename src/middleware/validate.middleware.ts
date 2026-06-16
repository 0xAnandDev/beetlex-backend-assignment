import { FastifyRequest, FastifyReply } from "fastify";
import { ZodObject, ZodError } from "zod";

interface ValidationSchema {
  body?: ZodObject<any>;
  query?: ZodObject<any>;
  params?: ZodObject<any>;
}

export function validate(schema: ValidationSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (schema.body) {
        request.body = await schema.body.parseAsync(request.body);
      }
      if (schema.query) {
        request.query = await schema.query.parseAsync(request.query);
      }
      if (schema.params) {
        request.params = await schema.params.parseAsync(request.params);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw error;
    }
  };
}
