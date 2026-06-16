import { FastifyReply, FastifyRequest } from "fastify";
import { RegistrationService } from "./registration.service";
import { successResponse } from "../../utils/response";

export class RegistrationController {
  static async register(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const registration = await RegistrationService.register(id, request.user!.id, request.body);
    return reply.status(201).send(successResponse(registration, "Registered for event successfully"));
  }

  static async getRegistrationStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const registration = await RegistrationService.getRegistrationStatus(id, request.user!.id);
    return reply.status(200).send(successResponse(registration, "Registration status retrieved successfully"));
  }

  static async cancelRegistration(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const registration = await RegistrationService.cancelRegistration(id, request.user!.id);
    return reply.status(200).send(successResponse(registration, "Registration cancelled successfully"));
  }

  static async findEventRegistrations(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const query = request.query as { page: number; limit: number };
    const result = await RegistrationService.findEventRegistrations(id, query, request.user!);
    return reply.status(200).send(successResponse(result, "Registrations list retrieved successfully"));
  }
}
