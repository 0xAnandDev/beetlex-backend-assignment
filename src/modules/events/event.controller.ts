import { FastifyReply, FastifyRequest } from "fastify";
import { EventService } from "./event.service";
import { successResponse } from "../../utils/response";
import { EventStatus } from "@prisma/client";

export class EventController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const event = await EventService.create(request.body, request.user!.id);
    return reply.status(201).send(successResponse(event, "Event created successfully"));
  }

  static async findAll(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { page: number; limit: number; status?: EventStatus; search?: string };
    const result = await EventService.findAll(query);
    return reply.status(200).send(successResponse(result, "Events fetched successfully"));
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const event = await EventService.findById(id);
    return reply.status(200).send(successResponse(event, "Event fetched successfully"));
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const event = await EventService.update(id, request.body, request.user!);
    return reply.status(200).send(successResponse(event, "Event updated successfully"));
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await EventService.delete(id, request.user!);
    return reply.status(200).send(successResponse(null, "Event deleted successfully"));
  }
}
