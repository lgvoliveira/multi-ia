import { describe, expect, it } from "vitest";
import { needsResume, QUEUED_GRACE_MS } from "./resume";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("execução parada no meio (para retomar)", () => {
  it("rodando com a reserva válida não está parada; com a reserva vencida, está", () => {
    expect(needsResume({ status: "running", lease_until: iso(30_000), updated_at: iso(-1000) }, NOW)).toBe(false);
    expect(needsResume({ status: "running", lease_until: iso(-1), updated_at: iso(-90_000) }, NOW)).toBe(true);
  });

  it("na fila há pouco tempo é normal (entre uma fase e outra); há tempo demais, está parada", () => {
    expect(needsResume({ status: "queued", lease_until: null, updated_at: iso(-1000) }, NOW)).toBe(false);
    expect(
      needsResume({ status: "queued", lease_until: null, updated_at: iso(-QUEUED_GRACE_MS - 1) }, NOW),
    ).toBe(true);
  });

  it("execução que já acabou ou está pausada nunca é retomada sozinha", () => {
    for (const status of ["finished", "failed", "cancelled", "paused"] as const) {
      expect(needsResume({ status, lease_until: null, updated_at: iso(-3_600_000) }, NOW)).toBe(false);
    }
  });
});
