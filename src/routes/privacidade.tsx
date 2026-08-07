import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Database,
  Mail,
  MapPin,
  MessageCircleMore,
  ShieldCheck,
} from "lucide-react";
import { BafafaSign } from "@/components/brand/bafafa-sign";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }

  return (
    <main className="app-canvas min-h-screen px-4 py-6 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-block" aria-label="Voltar ao Início">
            <BafafaSign size="full" showCaption />
          </Link>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-background px-4 text-sm font-black shadow-[2px_3px_0_var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>

        <header className="content-card content-card--profile mt-6 p-6 text-white">
          <ShieldCheck className="h-9 w-9" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.14em]">Versão 2.1</p>
          <h1 className="mt-1 font-display text-4xl leading-none">
            Privacidade sem letrinha miúda
          </h1>
          <p className="mt-3 max-w-xl text-sm font-semibold text-white/85">
            Aqui você entende o que o Bafafá Connect pede, por que pede e como manter o controle dos
            seus dados.
          </p>
        </header>

        <div className="mt-6 space-y-5">
          <PolicySection id="termos" title="Termos de Uso">
            <p>
              O Bafafá Connect é o aplicativo de relacionamento do Bafafá Bar, em Natal/RN. O acesso
              é gratuito e destinado a pessoas com 18 anos ou mais.
            </p>
            <p>
              Você se compromete a informar dados verdadeiros, proteger seu acesso e usar o app com
              respeito. Fofoquinhas podem ter validade, quantidade e regras próprias. Links externos
              abrem o site indicado; o aplicativo registra o clique, mas não confirma uma compra
              feita fora dele.
            </p>
            <p>
              Contas podem ter recursos suspensos em caso de fraude, abuso, risco à comunidade ou
              descumprimento destas regras, sempre preservando o histórico necessário à segurança.
            </p>
          </PolicySection>

          <PolicySection id="privacidade" title="Política de Privacidade">
            <div className="rounded-2xl border-2 border-foreground/15 bg-background p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                <div>
                  <h3 className="font-black">Quem cuida dos seus dados</h3>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    Bafafa Gastrobar LTDA · CNPJ 39.715.843/0001-00 · Praça Doutor Amaro de Souza
                    Marinho, 7, Lagoa Nova, Natal/RN, CEP 59056-580.
                  </p>
                  <a
                    href="mailto:bafafa.bar@gmail.com?subject=Privacidade%20-%20Bafaf%C3%A1%20Connect"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-card px-4 text-sm font-black shadow-[2px_3px_0_var(--foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-electric/35"
                  >
                    <Mail className="h-4 w-4" /> bafafa.bar@gmail.com
                  </a>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Fact
                icon={Database}
                title="Dados essenciais"
                copy="Cadastro, consentimentos, preferências, presença, interações e segurança."
              />
              <Fact
                icon={MapPin}
                title="Localização pontual"
                copy="Conferida no momento do check-in; suas coordenadas não ficam gravadas."
              />
              <Fact
                icon={ShieldCheck}
                title="Controle é seu"
                copy="O perfil público começa fechado para novos cadastros e pode ser ajustado por você."
              />
            </div>
            <p>
              Usamos os dados para autenticar sua conta, liberar check-in e Resenha, personalizar a
              experiência, operar Fofoquinhas, prevenir fraude, moderar a comunidade e entender
              ativação e retorno ao Bafafá. Isso ocorre para prestar o serviço, proteger a
              comunidade, cumprir obrigações e exercer direitos. Comunicações promocionais e perfil
              público dependem da sua escolha.
            </p>
            <p>
              Dados operacionais ficam no Supabase e a aplicação é hospedada na Vercel. Quando o
              acesso por telefone estiver ativo, a Twilio processará o número e o envio do código de
              confirmação. Esses fornecedores recebem apenas o necessário para prestar seus
              serviços. Não vendemos seus dados pessoais.
            </p>
            <p>
              Você pode pedir confirmação de tratamento, acesso, correção, portabilidade quando
              aplicável, informação sobre compartilhamento, revogação de consentimento e exclusão,
              respeitadas as retenções legais e de segurança. Faça o pedido pelo canal oficial de
              atendimento do Bafafá Bar e confirme a titularidade da conta.
            </p>
          </PolicySection>

          <PolicySection id="retencao" title="Por quanto tempo guardamos">
            <p className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-electric" /> Mantemos conta, perfil,
              preferências e histórico de relacionamento enquanto a conta estiver ativa. Contas sem
              atividade por 24 meses entram em revisão para exclusão ou anonimização.
            </p>
            <p>
              Mensagens da Resenha e conversas privadas entram em revisão após 180 dias do
              encerramento. Conteúdo denunciado, consentimentos, auditoria e registros necessários à
              segurança, ao cumprimento de obrigação ou à defesa de direitos podem ser preservados
              por até cinco anos.
            </p>
            <p>
              No check-in por localização, as coordenadas servem somente para calcular se você está
              na área permitida. Guardamos a confirmação da presença, o método e dados aproximados
              da validação, não a sua coordenada exata. Pedidos de privacidade recebem resposta em
              até 15 dias, sem prejuízo de retenções obrigatórias.
            </p>
          </PolicySection>

          <PolicySection id="comunidade" title="Regras da comunidade">
            <p className="flex items-start gap-2">
              <MessageCircleMore className="mt-0.5 h-5 w-5 shrink-0 text-samba" /> A Resenha é para
              conversa entre pessoas com presença confirmada. Respeite limites, identidade,
              orientação, origem, corpo e condição de cada pessoa.
            </p>
            <p>
              Conversas privadas só começam quando os dois aceitam um salve. Você pode bloquear uma
              pessoa e denunciar uma mensagem. Numa denúncia privada, a moderação vê a mensagem
              denunciada, o motivo e as pessoas envolvidas — não o restante da conversa.
            </p>
            <p>
              Spam, ameaça, assédio, discriminação, exposição indevida, fraude e conteúdo ilegal
              podem resultar em remoção da mensagem, encerramento da conversa ou suspensão.
            </p>
            <p>
              Nomes, nomes de usuário, salves e mensagens passam por uma barreira automática contra
              palavrões, conteúdo sexual explícito, racismo, homofobia e transfobia. O texto
              bloqueado não é publicado nem guardado. Como contexto também importa, denúncia,
              bloqueio e revisão humana continuam disponíveis.
            </p>
          </PolicySection>

          <section id="seus-direitos" className="sticker-card bg-mango p-5 text-sm">
            <h2 className="font-display text-2xl">Quer revisar ou apagar seus dados?</h2>
            <p className="mt-2 font-semibold">
              Escreva para bafafa.bar@gmail.com com o assunto “Privacidade — Bafafá Connect”. A
              equipe confirmará sua identidade antes de atender a solicitação.
            </p>
            <a
              href="mailto:bafafa.bar@gmail.com?subject=Privacidade%20-%20Bafaf%C3%A1%20Connect"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-background px-4 font-black shadow-[2px_3px_0_var(--foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-electric/35"
            >
              <Mail className="h-4 w-4" /> Fazer uma solicitação
            </a>
          </section>
        </div>

        <p className="py-8 text-center text-xs font-semibold text-muted-foreground">
          Bafafá Bar — Natal/RN · documento do Bafafá Connect, versão 2.1 · vigente desde 18/07/2026
        </p>
      </div>
    </main>
  );
}

function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="sticker-card scroll-mt-4 space-y-3 bg-card p-5 text-sm leading-relaxed"
    >
      <h2 className="font-display text-3xl leading-none">{title}</h2>
      {children}
    </section>
  );
}

function Fact({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof ShieldCheck;
  title: string;
  copy: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-foreground/15 bg-background p-3">
      <Icon className="h-5 w-5 text-electric" />
      <h3 className="mt-2 font-black">{title}</h3>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{copy}</p>
    </article>
  );
}
