import { beforeEach, describe, expect, it, vi } from "vitest";

// Um banco de mentira, só com o que ensureOwnerCompany usa: procurar a pessoa, criar a empresa e criar o dono.
const db = {
  existingMember: null as { id: string } | null,
  memberInsertError: null as { code: string; message: string } | null,
  companyUpserts: [] as unknown[],
  memberInserts: [] as unknown[],
};

vi.mock("@/lib/runs/supabase-server", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === "members" ? db.existingMember : null, error: null }) }),
      }),
      upsert: async (row: unknown, options: unknown) => {
        db.companyUpserts.push({ table, row, options });
        return { error: null };
      },
      insert: async (row: unknown) => {
        db.memberInserts.push({ table, row });
        return { error: db.memberInsertError };
      },
    }),
  }),
}));

const { ensureOwnerCompany, pendingCompanyFrom, signupMetadata } = await import("./company-signup");

const USER_ID = "a0000000-0000-4000-8000-000000000001";
const PENDING = { companyName: "Agência Exemplo", ownerName: "Marina Souza" };

beforeEach(() => {
  db.existingMember = null;
  db.memberInsertError = null;
  db.companyUpserts = [];
  db.memberInserts = [];
});

describe("cadastro pendente guardado no login", () => {
  it("volta igual ao que foi guardado no cadastro", () => {
    expect(pendingCompanyFrom(signupMetadata(PENDING))).toEqual(PENDING);
  });

  it("ignora metadados ausentes, de outro formato ou com nomes inválidos", () => {
    expect(pendingCompanyFrom(undefined)).toBeNull();
    expect(pendingCompanyFrom({})).toBeNull();
    expect(pendingCompanyFrom({ company_signup: "Agência" })).toBeNull();
    expect(pendingCompanyFrom({ company_signup: { company_name: "Agência", owner_name: 7 } })).toBeNull();
    expect(pendingCompanyFrom({ company_signup: { company_name: "   ", owner_name: "Marina" } })).toBeNull();
    expect(pendingCompanyFrom({ company_signup: { company_name: "a".repeat(121), owner_name: "Marina" } })).toBeNull();
  });
});

describe("empresa criada no primeiro acesso do dono", () => {
  const user = { id: USER_ID, email: "Marina@Example.com", user_metadata: signupMetadata(PENDING) };

  it("cria a empresa com o mesmo id do login e o dono ligado a ela", async () => {
    expect(await ensureOwnerCompany(user)).toBe("created");
    expect(db.companyUpserts).toEqual([
      {
        table: "companies",
        row: { id: USER_ID, name: "Agência Exemplo" },
        options: { onConflict: "id", ignoreDuplicates: true },
      },
    ]);
    expect(db.memberInserts).toEqual([
      {
        table: "members",
        row: {
          company_id: USER_ID,
          user_id: USER_ID,
          name: "Marina Souza",
          email: "marina@example.com",
          role: "owner",
        },
      },
    ]);
  });

  it("não cria nada se a pessoa já tem cadastro", async () => {
    db.existingMember = { id: "b1" };
    expect(await ensureOwnerCompany(user)).toBe("exists");
    expect(db.companyUpserts).toEqual([]);
    expect(db.memberInserts).toEqual([]);
  });

  it("não cria empresa para um login que não veio do cadastro de empresa", async () => {
    expect(await ensureOwnerCompany({ id: USER_ID, email: "ana@example.com", user_metadata: {} })).toBe("no-signup");
    expect(await ensureOwnerCompany({ ...user, email: undefined })).toBe("no-signup");
    expect(db.companyUpserts).toEqual([]);
  });

  it("aceita que outro pedido tenha criado o dono no mesmo instante", async () => {
    db.memberInsertError = { code: "23505", message: "duplicate key" };
    expect(await ensureOwnerCompany(user)).toBe("exists");
  });

  it("avisa qualquer outro erro do banco", async () => {
    db.memberInsertError = { code: "23514", message: "check violation" };
    await expect(ensureOwnerCompany(user)).rejects.toThrow("Não deu para criar o dono da empresa");
  });
});
