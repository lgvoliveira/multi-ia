// Os erros do Supabase Auth em português, para a tela. Cada erro tem um código fixo (ex.: "invalid_credentials");
// a mensagem técnica em inglês fica só no registro do servidor.

const RATE_LIMIT = "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.";
const GENERIC = "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes.";

export function signUpErrorMessage(code: string | undefined): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail. Entre com ela.";
    case "weak_password":
      return "Essa senha é fácil de adivinhar. Escolha outra, com letras e números.";
    case "email_address_invalid":
      return "Este e-mail não é aceito. Confira se está certo ou use outro.";
    // O envio de e-mail embutido no Supabase só entrega para a equipe do projeto (F30).
    case "email_address_not_authorized":
      return "Não conseguimos mandar o e-mail de confirmação para este endereço. Use outro ou fale com a gente.";
    case "over_email_send_rate_limit":
      return "Mandamos e-mails demais na última hora. Espere um pouco e tente de novo.";
    case "over_request_rate_limit":
      return RATE_LIMIT;
    case "signup_disabled":
    case "email_provider_disabled":
      return "O cadastro de empresas está fechado no momento.";
    default:
      return GENERIC;
  }
}

export function signInErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Falta confirmar o e-mail: abra a mensagem que mandamos e clique no link (veja também o spam).";
    case "user_banned":
      return "Este acesso está bloqueado. Fale com o dono da sua empresa.";
    case "over_request_rate_limit":
      return RATE_LIMIT;
    default:
      return GENERIC;
  }
}
