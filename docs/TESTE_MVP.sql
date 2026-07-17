-- =====================================================================
-- BAFAFÁ — roteiro opcional de teste do MVP
-- Execute manualmente no SQL Editor do projeto Supabase correto.
-- TROQUE os e-mails e o produto antes de usar.
-- =====================================================================

-- 1) Promover o proprietário para administrador.
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT id, 'admin'::public.app_role, id
FROM auth.users
WHERE email = 'SEU_EMAIL_DE_ADMIN@EXEMPLO.COM'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Promover uma conta operacional para equipe.
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT staff.id, 'equipe'::public.app_role, admin_user.id
FROM auth.users staff
CROSS JOIN LATERAL (
  SELECT ur.user_id AS id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.granted_at
  LIMIT 1
) admin_user
WHERE staff.email = 'EMAIL_DA_EQUIPE@EXEMPLO.COM'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Evento de teste com check-in aberto agora.
INSERT INTO public.events (
  name,
  slug,
  description,
  category,
  attraction,
  starts_at,
  ends_at,
  checkin_opens_at,
  checkin_closes_at,
  checkin_enabled,
  status,
  instructions
)
VALUES (
  'Piloto Clube dos Bafafãs',
  'piloto-clube-dos-bafafas',
  'Evento fictício para validar cadastro, check-in e mimo.',
  'Pagode',
  'Atração de demonstração',
  now() + interval '30 minutes',
  now() + interval '6 hours',
  now() - interval '1 hour',
  now() + interval '5 hours',
  true,
  'ongoing',
  'Apresente o código temporário à equipe.'
)
ON CONFLICT (slug) DO UPDATE SET
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  checkin_opens_at = excluded.checkin_opens_at,
  checkin_closes_at = excluded.checkin_closes_at,
  status = excluded.status,
  updated_at = now();

-- 4) Campanha de demonstração. Altere o produto antes do piloto real.
INSERT INTO public.campaigns (
  event_id,
  name,
  description,
  benefit_type,
  discount_percent,
  product_name,
  instructions,
  starts_at,
  ends_at,
  reward_valid_hours,
  total_available,
  per_user_limit,
  requires_checkin,
  requires_min_profile,
  status,
  public_rules,
  internal_rules
)
SELECT
  e.id,
  'Mimo de Boas-vindas',
  'Faça check-in e desbloqueie um benefício de uso único.',
  'percent_off',
  50,
  'PRODUTO SELECIONADO',
  'A equipe deve validar o código antes de aplicar o desconto.',
  now() - interval '1 hour',
  now() + interval '5 hours',
  5,
  50,
  1,
  true,
  false,
  'active',
  'Uma utilização por usuário. Não cumulativo. Válido apenas no evento e sujeito à disponibilidade.',
  'Confirmar o produto participante antes de liberar.'
FROM public.events e
WHERE e.slug = 'piloto-clube-dos-bafafas'
  AND NOT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.event_id = e.id AND c.name = 'Mimo de Boas-vindas'
  );
