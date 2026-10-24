// Conferência dos formulários de cadastro e de entrada. Roda no servidor (as ações recebem o que o navegador mandou,
// e qualquer um pode mandar qualquer coisa). Os limites batem com os do banco (migração 1) e do Supabase Auth.

export const NAME_MAX_CHARS = 120;
export const EMAIL_MAX_CHARS = 254;
export const PASSWORD_MIN_CHARS = 8;
/** O Supabase guarda a senha com bcrypt, que só olha os primeiros 72 bytes: acima disso, recusamos. */
export const PASSWORD_MAX_BYTES = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignUpValues {
  companyName: string;
  ownerName: string;
  email: string;
  password: string;
}

export type SignUpField = keyof SignUpValues;

export type FormResult<Values, Field extends string> =
  | { ok: true; values: Values }
  /** `values` volta sem a senha, para preencher o formulário de novo. */
  | { ok: false; errors: Partial<Record<Field, string>>; values: Partial<Values> };

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

/** Nome com espaços normais: tira as pontas e junta espaços repetidos. */
function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function nameProblem(value: string, what: string): string | undefined {
  if (!value) return `Preencha ${what}.`;
  if (value.length > NAME_MAX_CHARS) return `Use até ${NAME_MAX_CHARS} caracteres.`;
  return undefined;
}

function emailProblem(value: string): string | undefined {
  if (!value) return "Preencha o e-mail.";
  if (value.length > EMAIL_MAX_CHARS || !EMAIL_PATTERN.test(value)) return "Confira o e-mail: ele parece incompleto.";
  return undefined;
}

function passwordProblem(value: string): string | undefined {
  if (value.length < PASSWORD_MIN_CHARS) return `A senha precisa de pelo menos ${PASSWORD_MIN_CHARS} caracteres.`;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return "A senha é longa demais.";
  return undefined;
}

/** Cadastro da empresa: nome da empresa, nome do dono, e-mail e senha. */
export function parseSignUp(formData: FormData): FormResult<SignUpValues, SignUpField> {
  const values: SignUpValues = {
    companyName: cleanName(text(formData, "companyName")),
    ownerName: cleanName(text(formData, "ownerName")),
    email: normalizeEmail(text(formData, "email")),
    // A senha não é mexida: espaço também conta.
    password: text(formData, "password"),
  };

  const errors: Partial<Record<SignUpField, string>> = {};
  const companyProblem = nameProblem(values.companyName, "o nome da empresa");
  if (companyProblem) errors.companyName = companyProblem;
  const ownerProblem = nameProblem(values.ownerName, "o seu nome");
  if (ownerProblem) errors.ownerName = ownerProblem;
  const emailError = emailProblem(values.email);
  if (emailError) errors.email = emailError;
  const passwordError = passwordProblem(values.password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      values: { companyName: values.companyName, ownerName: values.ownerName, email: values.email },
    };
  }
  return { ok: true, values };
}

export interface SignInValues {
  email: string;
  password: string;
}

/** Entrada: só confere que veio algo. Se a senha está certa, quem diz é o Supabase. */
export function parseSignIn(formData: FormData): FormResult<SignInValues, keyof SignInValues> {
  const values: SignInValues = { email: normalizeEmail(text(formData, "email")), password: text(formData, "password") };
  const errors: Partial<Record<keyof SignInValues, string>> = {};
  if (!values.email) errors.email = "Preencha o e-mail.";
  if (!values.password) errors.password = "Preencha a senha.";
  if (values.password.length > 1024) errors.password = "A senha é longa demais.";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values: { email: values.email } };
  return { ok: true, values };
}

/** O que a ação de cadastro devolve para a tela. */
export type SignUpState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<SignUpField, string>>; values: Partial<SignUpValues> }
  | { status: "error"; message: string; values: Partial<SignUpValues> }
  | { status: "check-email"; email: string };

/** O que a ação de entrada devolve para a tela (quando dá certo, ela leva direto para a página da pessoa). */
export type SignInState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<keyof SignInValues, string>>; values: Partial<SignInValues> }
  | { status: "error"; message: string; values: Partial<SignInValues> };
