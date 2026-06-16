import { FastifyInstance } from "fastify";
import { LeaderboardController } from "./leaderboard.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { eventIdParamSchema } from "./leaderboard.validation";

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // GET /events/:eventId/leaderboard
  fastify.get(
    "/:eventId/leaderboard",
    {
      preHandler: [authenticate, validate(eventIdParamSchema)],
    },
    LeaderboardController.getLeaderboard
  );
}
