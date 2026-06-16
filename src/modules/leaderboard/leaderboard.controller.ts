import { FastifyReply, FastifyRequest } from "fastify";
import { LeaderboardService } from "./leaderboard.service";
import { successResponse } from "../../utils/response";

export class LeaderboardController {
  static async getLeaderboard(request: FastifyRequest, reply: FastifyReply) {
    const { eventId } = request.params as { eventId: string };
    const leaderboard = await LeaderboardService.getLeaderboard(
      eventId,
      request.user!.id,
      request.user!.role
    );
    return reply.status(200).send(successResponse(leaderboard, "Leaderboard retrieved successfully"));
  }
}
