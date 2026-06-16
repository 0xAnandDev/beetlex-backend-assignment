import { z } from "zod";
import { EventStatus } from "@prisma/client";

export const prizePoolSchema = z.object({
  total: z.number().nonnegative("Total prize pool must be positive"),
  currency: z.string().min(1, "Currency is required"),
  distribution: z
    .array(
      z.object({
        rank: z.union([z.number(), z.string()]),
        prize: z.union([z.number(), z.string()]),
      })
    )
    .optional(),
});

export const createEventSchema = {
  body: z
    .object({
      title: z.string().min(3, "Title must be at least 3 characters").max(100),
      description: z.string().min(10, "Description must be at least 10 characters"),
      bannerUrl: z.string().url("Invalid banner URL").optional().or(z.literal("")),
      maxTeamSize: z.number().int().min(1).default(4),
      minTeamSize: z.number().int().min(1).default(1),
      maxRegistrations: z.number().int().min(1).optional(),
      registrationOpen: z.string().datetime({ message: "Invalid ISO datetime string for registrationOpen" }),
      registrationClose: z.string().datetime({ message: "Invalid ISO datetime string for registrationClose" }),
      eventStart: z.string().datetime({ message: "Invalid ISO datetime string for eventStart" }),
      eventEnd: z.string().datetime({ message: "Invalid ISO datetime string for eventEnd" }),
      submissionDeadline: z.string().datetime({ message: "Invalid ISO datetime string for submissionDeadline" }),
      timezone: z.string().min(1, "Timezone is required"),
      prizePool: prizePoolSchema,
      tags: z.array(z.string()).min(1, "At least one tag is required"),
      isPublic: z.boolean().default(true),
      status: z.nativeEnum(EventStatus).default(EventStatus.draft),
    })
    .refine((data) => new Date(data.registrationOpen) < new Date(data.registrationClose), {
      message: "Registration open date must be before registration close date",
      path: ["registrationOpen"],
    })
    .refine((data) => new Date(data.registrationClose) <= new Date(data.eventStart), {
      message: "Registration close date must be before or equal to event start date",
      path: ["registrationClose"],
    })
    .refine((data) => new Date(data.eventStart) < new Date(data.eventEnd), {
      message: "Event start date must be before event end date",
      path: ["eventStart"],
    })
    .refine(
      (data) => {
        const deadline = new Date(data.submissionDeadline);
        const start = new Date(data.eventStart);
        const end = new Date(data.eventEnd);
        return deadline >= start && deadline <= end;
      },
      {
        message: "Submission deadline must be between event start and event end date",
        path: ["submissionDeadline"],
      }
    )
    .refine((data) => data.minTeamSize <= data.maxTeamSize, {
      message: "Minimum team size cannot be greater than maximum team size",
      path: ["minTeamSize"],
    }),
};

export const updateEventSchema = {
  body: z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().min(10).optional(),
    bannerUrl: z.string().url("Invalid banner URL").optional().or(z.literal("")),
    maxTeamSize: z.number().int().min(1).optional(),
    minTeamSize: z.number().int().min(1).optional(),
    maxRegistrations: z.number().int().min(1).optional().nullable(),
    registrationOpen: z.string().datetime().optional(),
    registrationClose: z.string().datetime().optional(),
    eventStart: z.string().datetime().optional(),
    eventEnd: z.string().datetime().optional(),
    submissionDeadline: z.string().datetime().optional(),
    timezone: z.string().min(1).optional(),
    prizePool: prizePoolSchema.optional(),
    tags: z.array(z.string()).min(1).optional(),
    isPublic: z.boolean().optional(),
    status: z.nativeEnum(EventStatus).optional(),
  }),
};

export const queryEventSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).default(10),
    status: z.nativeEnum(EventStatus).optional(),
    search: z.string().optional(),
  }),
};

export const getEventParamsSchema = {
  params: z.object({
    id: z.string().uuid("Invalid event ID format"),
  }),
};
