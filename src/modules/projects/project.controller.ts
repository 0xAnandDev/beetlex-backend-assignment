import { FastifyReply, FastifyRequest } from "fastify";
import { ProjectService } from "./project.service";
import { successResponse } from "../../utils/response";

export class ProjectController {
  static async createDraft(request: FastifyRequest, reply: FastifyReply) {
    const { teamId } = request.params as { teamId: string };
    const project = await ProjectService.createDraft(teamId, request.body, request.user!.id);
    return reply.status(201).send(successResponse(project, "Project draft created successfully"));
  }

  static async getProjectByTeam(request: FastifyRequest, reply: FastifyReply) {
    const { teamId } = request.params as { teamId: string };
    const project = await ProjectService.getProjectByTeam(teamId, request.user!.id, request.user!.role);
    return reply.status(200).send(successResponse(project, "Project retrieved successfully"));
  }

  static async updateDraft(request: FastifyRequest, reply: FastifyReply) {
    const { teamId } = request.params as { teamId: string };
    const project = await ProjectService.updateDraft(teamId, request.body, request.user!.id);
    return reply.status(200).send(successResponse(project, "Project updated successfully"));
  }

  static async submitProject(request: FastifyRequest, reply: FastifyReply) {
    const { teamId } = request.params as { teamId: string };
    const project = await ProjectService.submitProject(teamId, request.user!.id);
    return reply.status(200).send(successResponse(project, "Project submitted successfully"));
  }

  static async uploadDeck(request: FastifyRequest, reply: FastifyReply) {
    const { teamId } = request.params as { teamId: string };
    const { deckUrl } = request.body as { deckUrl: string };
    const cdnUrl = await ProjectService.uploadDeck(teamId, deckUrl, request.user!.id);
    return reply.status(200).send(successResponse({ deckUrl: cdnUrl }, "Deck uploaded successfully"));
  }

  static async findAllForEvent(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };
    const projects = await ProjectService.findAllForEvent(eventId, request.user!.id, request.user!.role);
    return reply.status(200).send(successResponse(projects, "Event projects retrieved successfully"));
  }
}
