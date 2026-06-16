import Fastify from "fastify";
import dotenv from "dotenv";
import fastifyCookie from "@fastify/cookie";
import { prisma } from "./config/prisma";
import { errorHandler } from "./middleware/error.middleware";
import { authRoutes } from "./modules/auth/auth.routes";
import { eventRoutes } from "./modules/events/event.routes";
import { registrationRoutes } from "./modules/registrations/registration.routes";
import { successResponse } from "./utils/response";

dotenv.config();

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "development" ? "debug" : "info",
  },
});

const port = Number(process.env.PORT) || 3000;

// Register plugins
app.register(fastifyCookie);

// Set global error handler
app.setErrorHandler(errorHandler);

// Register hooks for database connection lifecycle
app.addHook("onReady", async () => {
  await prisma.$connect();
  app.log.info("Database connection established.");
});

app.addHook("onClose", async (instance) => {
  await prisma.$disconnect();
  instance.log.info("Database connection closed.");
});

// Register routes
app.register(authRoutes, { prefix: "/auth" });
app.register(eventRoutes, { prefix: "/events" });
app.register(registrationRoutes, { prefix: "/events" });

// Health check route
app.get("/health", async (request, reply) => {
  return successResponse({ timestamp: new Date() }, "API is healthy");
});

// Start server
const start = async () => {
  try {
    const address = await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;

