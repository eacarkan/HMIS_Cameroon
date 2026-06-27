import { handlers } from "@/server/auth";

// Auth.js route handlers (Node runtime — bcrypt + Prisma run here, never on the edge).
export const { GET, POST } = handlers;
