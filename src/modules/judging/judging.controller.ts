import { FastifyReply, FastifyRequest } from "fastify";
import { JudgingService } from "./judging.service";
import { successResponse } from "../../utils/response";

export class JudgingController {
  static async findAssignedProjects(request: FastifyRequest, reply: FastifyReply) {
    const { track } = request.query as { track?: string };
    const projects = await JudgingService.findAssignedProjects(request.user!.id, track);
    return reply.status(200).send(successResponse(projects, "Assigned projects retrieved successfully"));
  }

  static async getProjectWithMyScore(request: FastifyRequest, reply: FastifyReply) {
    const { projectId } = request.params as { projectId: string };
    const result = await JudgingService.getProjectWithMyScore(projectId, request.user!.id);
    return reply.status(200).send(successResponse(result, "Project details retrieved successfully"));
  }

  static async createScore(request: FastifyRequest, reply: FastifyReply) {
    const { projectId } = request.params as { projectId: string };
    const score = await JudgingService.createScore(projectId, request.body, request.user!.id);
    return reply.status(201).send(successResponse(score, "Project scored successfully"));
  }

  static async updateScore(request: FastifyRequest, reply: FastifyReply) {
    const { projectId } = request.params as { projectId: string };
    const score = await JudgingService.updateScore(projectId, request.body, request.user!.id);
    return reply.status(200).send(successResponse(score, "Score updated successfully"));
  }

  static async getEventScores(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };
    const scores = await JudgingService.getEventScores(eventId, request.user!.id, request.user!.role);
    return reply.status(200).send(successResponse(scores, "Event scores breakdown retrieved successfully"));
  }
}
