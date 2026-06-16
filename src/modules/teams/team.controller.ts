import { FastifyReply, FastifyRequest } from "fastify";
import { TeamService } from "./team.service";
import { successResponse } from "../../utils/response";

export class TeamController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };
    const { name } = request.body as { name: string };
    const team = await TeamService.create(eventId, name, request.user!.id);
    return reply.status(201).send(successResponse(team, "Team created successfully"));
  }

  static async join(request: FastifyRequest, reply: FastifyReply) {
    const { eventId, teamId } = request.params as { eventId: string; teamId: string };
    const registration = await TeamService.join(eventId, teamId, request.user!.id);
    return reply.status(200).send(successResponse(registration, "Joined team successfully"));
  }

  static async leave(request: FastifyRequest, reply: FastifyReply) {
    const { eventId, teamId } = request.params as { eventId: string; teamId: string };
    await TeamService.leave(eventId, teamId, request.user!.id);
    return reply.status(200).send(successResponse(null, "Left team successfully"));
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    const { eventId, teamId } = request.params as { eventId: string; teamId: string };
    const team = await TeamService.findById(eventId, teamId);
    return reply.status(200).send(successResponse(team, "Team details retrieved successfully"));
  }

  static async findAll(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };
    const teams = await TeamService.findAll(eventId);
    return reply.status(200).send(successResponse(teams, "Teams list retrieved successfully"));
  }
}
