import { supabase } from "@/integrations/supabase/client";

export type CommunityContentContext = "display_name" | "username" | "chat";
export type CommunityContentStatus = "allowed" | "blocked" | "unavailable";

export const NAME_MODERATION_MESSAGE =
  "Esse nome não pode ser usado. Escolha outro sem palavrões, conteúdo sexual ou discriminação.";

export const MESSAGE_MODERATION_MESSAGE =
  "Essa mensagem não segue as regras da comunidade. Ajuste o texto e tente de novo.";

export async function checkCommunityContent(
  value: string,
  context: CommunityContentContext,
): Promise<CommunityContentStatus> {
  if (!value.trim()) return "allowed";

  const { data, error } = await supabase.rpc("check_content_allowed", {
    _value: value,
    _context: context,
  });

  if (error) return "unavailable";

  const result = data as { allowed?: unknown } | null;
  return result?.allowed === true ? "allowed" : "blocked";
}
