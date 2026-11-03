import { describe, expect, it } from "vitest";
import { agentPersona, AGENT_PERSONA_IDS } from "./agent-persona";
import { AGENT_AREAS, AGENTS, findAgent } from "./agents";

describe("catálogo de agentes prontos", () => {
  it("todo agente tem id único e os campos que a tela precisa", () => {
    const ids = AGENTS.map((agent) => agent.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const agent of AGENTS) {
      expect(agent.name.trim()).not.toBe("");
      expect(agent.role.trim()).not.toBe("");
      expect(agent.tagline.trim()).not.toBe("");
      expect(agent.starters.length).toBeGreaterThan(0);
      // O areaId do agente é mesmo uma área do catálogo.
      expect(AGENT_AREAS.some((area) => area.id === agent.areaId)).toBe(true);
    }
  });

  it("cada área tem pelo menos um agente", () => {
    for (const area of AGENT_AREAS) {
      expect(area.agents.length).toBeGreaterThan(0);
    }
  });

  it("todo agente tem persona e toda persona tem agente (paridade)", () => {
    const catalog = new Set(AGENTS.map((agent) => agent.id));
    const personas = new Set(AGENT_PERSONA_IDS);
    expect(personas).toEqual(catalog);
    for (const agent of AGENTS) {
      expect(agentPersona(agent.id)?.trim()).toBeTruthy();
    }
  });

  it("findAgent acha pelo id e devolve null para um id desconhecido", () => {
    expect(findAgent("ti-fullstack")?.name).toBe("Dani");
    expect(findAgent("nao-existe")).toBeNull();
  });
});
