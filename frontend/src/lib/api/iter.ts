import { apiJson } from "./client";

export type IterTurn = { role: "user" | "model"; text: string };

export type SendIterMessageResponse = {
  id: string;
  storedAt: string;
  reply: string | null;
};

export const iterApi = {
  sendMessage: (input: { sessionId: string; text: string; screen?: string; locale: "hy" | "en" | "ru"; history: IterTurn[] }) =>
    apiJson<SendIterMessageResponse>("/api/iter/messages", { method: "POST", body: JSON.stringify(input) }),
};
