import { beforeEach, describe, expect, it, vi } from "vitest";

// Um Supabase de mentira, em memória: as tabelas members e member_invites e os logins do Supabase Auth, só com o que
// invites.ts usa. Assim os testes conferem o resultado (o que ficou guardado), não a ordem exata das chamadas.
type Row = Record<string, unknown>;

const db = {
  tables: { members: [] as Row[], member_invites: [] as Row[] } as Record<string, Row[]>,
  users: [] as { id: string; email: string; password?: string }[],
  queries: 0,
  failMemberInsert: null as { code: string; message: string } | null,
  failPassword: null as { code: string; status: number } | null,
};

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
}

type Result = { data: unknown; error: unknown };

class FakeQuery implements PromiseLike<Result> {
  private op: "select" | "insert" | "upsert" | "delete" = "select";
  private filters: ((row: Row) => boolean)[] = [];
  private payload: Row = {};
  private ignoreDuplicates = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private readonly table: string) {}

  select() {
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  upsert(row: Row, options?: { ignoreDuplicates?: boolean }) {
    this.op = "upsert";
    this.payload = row;
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  gt(column: string, value: string) {
    this.filters.push((row) => String(row[column]) > value);
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }

  then<A = Result, B = never>(
    resolve?: ((value: Result) => A | PromiseLike<A>) | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(resolve, reject);
  }

  private run(): Result {
    db.queries += 1;
    const rows = db.tables[this.table];
    let result: Row[];
    if (this.op === "insert") {
      if (this.table === "members" && db.failMemberInsert) return { data: null, error: db.failMemberInsert };
      // Como o banco: a pessoa nasce ativa.
      const row = { id: newId(), ...(this.table === "members" ? { status: "active" } : {}), ...this.payload };
      rows.push(row);
      result = [row];
    } else if (this.op === "upsert") {
      const index = rows.findIndex((row) => row.member_id === this.payload.member_id);
      if (index >= 0 && !this.ignoreDuplicates) rows[index] = { ...this.payload };
      if (index < 0) rows.push({ ...this.payload });
      result = [];
    } else if (this.op === "delete") {
      result = rows.filter((row) => this.filters.every((f) => f(row)));
      db.tables[this.table] = rows.filter((row) => !result.includes(row));
    } else {
      result = rows.filter((row) => this.filters.every((f) => f(row)));
    }
    if (this.mode === "many") return { data: result, error: null };
    if (this.mode === "single" && result.length !== 1) return { data: null, error: { message: "não é uma linha só" } };
    return { data: result[0] ?? null, error: null };
  }
}

vi.mock("@/lib/runs/supabase-server", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => new FakeQuery(table),
    auth: {
      admin: {
        createUser: async ({ email }: { email: string }) => {
          if (db.users.some((u) => u.email === email)) {
            return { data: { user: null }, error: { code: "email_exists", status: 422 } };
          }
          const user = { id: newId(), email };
          db.users.push(user);
          return { data: { user }, error: null };
        },
        updateUserById: async (id: string, { password }: { password: string }) => {
          if (db.failPassword) return { data: { user: null }, error: db.failPassword };
          const user = db.users.find((u) => u.id === id);
          if (user) user.password = password;
          return { data: { user }, error: null };
        },
        deleteUser: async (id: string) => {
          db.users = db.users.filter((u) => u.id !== id);
          return { data: {}, error: null };
        },
      },
    },
  }),
}));

const { acceptInvite, findInvite, inviteEmployee, issueNewLink } = await import("./invites");
const { hashInviteToken, newInviteToken } = await import("./invite-token");

const COMPANY = "c0000000-0000-4000-8000-000000000001";
const OTHER_COMPANY = "c0000000-0000-4000-8000-000000000002";
const ANA = { companyId: COMPANY, name: "Ana Lima", email: "ana@example.com", budgetCents: 5000 };

beforeEach(() => {
  db.tables = { members: [], member_invites: [] };
  db.users = [];
  db.queries = 0;
  db.failMemberInsert = null;
  db.failPassword = null;
});

async function invitedAna(): Promise<{ token: string; memberId: string; userId: string }> {
  const result = await inviteEmployee(ANA);
  if (!result.ok) throw new Error("o convite deveria ter dado certo");
  const member = db.tables.members[0];
  return { token: result.token, memberId: String(member.id), userId: String(member.user_id) };
}

describe("convidar um funcionário", () => {
  it("cria o login sem senha, a pessoa na empresa e um convite de 24 horas", async () => {
    const before = Date.now();
    const { token, memberId, userId } = await invitedAna();

    expect(db.users).toEqual([{ id: userId, email: "ana@example.com" }]);
    expect(db.tables.members).toEqual([
      {
        id: memberId,
        company_id: COMPANY,
        user_id: userId,
        name: "Ana Lima",
        email: "ana@example.com",
        role: "employee",
        monthly_budget_cents: 5000,
        status: "active",
      },
    ]);
    const [invite] = db.tables.member_invites;
    expect(invite).toMatchObject({ member_id: memberId, company_id: COMPANY, kind: "invite" });
    // No banco fica só o resumo do código, nunca o código do link.
    expect(invite.token_hash).toBe(hashInviteToken(token));
    expect(JSON.stringify(db.tables)).not.toContain(token);
    const hours = (Date.parse(String(invite.expires_at)) - before) / 3_600_000;
    expect(hours).toBeGreaterThan(23.99);
    expect(hours).toBeLessThanOrEqual(24.01);
  });

  it("não convida de novo quem já está na equipe", async () => {
    await invitedAna();
    expect(await inviteEmployee({ ...ANA, name: "Ana de novo" })).toEqual({ ok: false, reason: "already-in-team" });
    expect(db.users).toHaveLength(1);
    expect(db.tables.members).toHaveLength(1);
  });

  it("não convida um e-mail que já tem conta na plataforma (dono ou funcionário de outra empresa)", async () => {
    await invitedAna();
    expect(await inviteEmployee({ ...ANA, companyId: OTHER_COMPANY })).toEqual({ ok: false, reason: "email-taken" });
    expect(db.tables.members).toHaveLength(1);
  });

  it("apaga o login criado se a pessoa não puder entrar na equipe", async () => {
    db.failMemberInsert = { code: "23514", message: "check violation" };
    await expect(inviteEmployee(ANA)).rejects.toThrow("Não deu para pôr o funcionário na equipe");
    expect(db.users).toEqual([]);

    db.failMemberInsert = { code: "23505", message: "duplicate key" };
    expect(await inviteEmployee(ANA)).toEqual({ ok: false, reason: "already-in-team" });
    expect(db.users).toEqual([]);
  });
});

describe("link novo", () => {
  it("continua sendo convite se a pessoa ainda não criou a senha, e o link antigo para de valer", async () => {
    const { token: oldToken, memberId } = await invitedAna();
    const { token, kind } = await issueNewLink({ memberId, companyId: COMPANY });

    expect(kind).toBe("invite");
    expect(token).not.toBe(oldToken);
    expect(db.tables.member_invites).toHaveLength(1);
    expect(await findInvite(oldToken)).toEqual({ status: "not-found" });
    expect((await findInvite(token)).status).toBe("valid");
  });

  it("vira link de senha nova para quem já aceitou o convite", async () => {
    const { token, memberId } = await invitedAna();
    await acceptInvite(token, "senha-boa-123");
    expect((await issueNewLink({ memberId, companyId: COMPANY })).kind).toBe("reset");
  });
});

describe("abrir o link do convite", () => {
  it("mostra a empresa, a pessoa e o e-mail, sem gastar o convite", async () => {
    const { token, memberId } = await invitedAna();
    db.tables.members[0].companies = { name: "Agência Exemplo" };

    const found = await findInvite(token);
    expect(found).toMatchObject({
      status: "valid",
      memberId,
      kind: "invite",
      name: "Ana Lima",
      email: "ana@example.com",
      companyName: "Agência Exemplo",
    });
    expect(await findInvite(token)).toEqual(found);
    expect(db.tables.member_invites).toHaveLength(1);
  });

  it("nem procura no banco um link cortado ou inventado", async () => {
    expect(await findInvite("abc")).toEqual({ status: "not-found" });
    expect(await findInvite(newInviteToken())).toEqual({ status: "not-found" });
    expect(db.queries).toBe(1);
  });

  it("avisa quando o link venceu ou a pessoa foi desativada", async () => {
    const { token } = await invitedAna();
    const tomorrow = new Date(Date.now() + 24 * 3_600_000 + 1000);
    expect(await findInvite(token, tomorrow)).toEqual({ status: "expired" });

    db.tables.members[0].status = "disabled";
    expect(await findInvite(token)).toEqual({ status: "disabled" });
  });
});

describe("aceitar o convite", () => {
  it("grava a senha criada pela pessoa e gasta o link", async () => {
    const { token, userId } = await invitedAna();

    expect(await acceptInvite(token, "senha-boa-123")).toEqual({ ok: true, email: "ana@example.com" });
    expect(db.users.find((u) => u.id === userId)?.password).toBe("senha-boa-123");
    expect(db.tables.member_invites).toEqual([]);

    // O mesmo link não serve uma segunda vez (nem para trocar a senha de novo).
    expect(await acceptInvite(token, "outra-senha-456")).toEqual({ ok: false, reason: "not-found" });
    expect(db.users.find((u) => u.id === userId)?.password).toBe("senha-boa-123");
  });

  it("não aceita link vencido, nem de pessoa desativada", async () => {
    const { token, userId } = await invitedAna();
    const tomorrow = new Date(Date.now() + 24 * 3_600_000 + 1000);
    expect(await acceptInvite(token, "senha-boa-123", tomorrow)).toEqual({ ok: false, reason: "not-found" });

    db.tables.members[0].status = "disabled";
    expect(await acceptInvite(token, "senha-boa-123")).toEqual({ ok: false, reason: "disabled" });
    expect(db.users.find((u) => u.id === userId)?.password).toBeUndefined();
  });

  it("devolve o convite se o Supabase não gravar a senha, para tentar de novo com o mesmo link", async () => {
    const { token } = await invitedAna();

    db.failPassword = { code: "weak_password", status: 422 };
    expect(await acceptInvite(token, "senha-boa-123")).toEqual({ ok: false, reason: "weak-password" });
    expect((await findInvite(token)).status).toBe("valid");

    db.failPassword = { code: "unexpected_failure", status: 500 };
    await expect(acceptInvite(token, "senha-boa-123")).rejects.toThrow("Não deu para gravar a senha");
    expect((await findInvite(token)).status).toBe("valid");

    db.failPassword = null;
    expect(await acceptInvite(token, "senha-boa-123")).toEqual({ ok: true, email: "ana@example.com" });
  });
});
