-- 관리자가 수정·선택하는 SMS 발송 템플릿
-- placeholders: {{couponCode}}, {{discountLabel}}, {{headcountLabel}}, {{issuedBranch}}, {{customerPhone}}, {{verifiedBranch}}, {{verifiedAt}}

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('issue', 'verify')),
  content text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sms_templates_type on public.sms_templates(type);
create unique index if not exists idx_sms_templates_type_default on public.sms_templates(type) where is_default = true;

-- 기본 템플릿 (발행/인증 각 1개) - 이미 있으면 넣지 않음
do $$
begin
  if not exists (select 1 from public.sms_templates where type = 'issue' and is_default = true) then
    insert into public.sms_templates (name, type, content, is_default)
    values ('발행 안내 (기본)', 'issue', '[쿠폰 발행]\n코드: {{couponCode}}\n할인: {{discountLabel}}\n인원: {{headcountLabel}}\n발행지점: {{issuedBranch}}\n사용 시 매장에서 쿠폰코드를 제시해 주세요.', true);
  end if;
  if not exists (select 1 from public.sms_templates where type = 'verify' and is_default = true) then
    insert into public.sms_templates (name, type, content, is_default)
    values ('사용 완료 안내 (기본)', 'verify', '[쿠폰 사용 완료]\n코드: {{couponCode}}\n인증지점: {{verifiedBranch}}\n사용일시: {{verifiedAt}}\n감사합니다.', true);
  end if;
end $$;

-- RLS: 관리자만 조회/수정
alter table public.sms_templates enable row level security;

drop policy if exists sms_templates_select on public.sms_templates;
create policy sms_templates_select on public.sms_templates for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists sms_templates_all on public.sms_templates;
create policy sms_templates_all on public.sms_templates for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Edge Function에서 service_role로 읽을 수 있도록 (정책은 authenticated만 있어도 됨; service_role은 RLS 우회)
comment on table public.sms_templates is 'SMS 발송 템플릿 (발행/사용완료). 관리자만 수정.';
