
create extension if not exists vector;

alter table public.scans
  add column if not exists embedding vector(1536),
  add column if not exists points_of_interest jsonb;

create index if not exists scans_embedding_idx
  on public.scans using hnsw (embedding vector_cosine_ops);

create or replace function public.match_scans(
  query_embedding vector(1536),
  exclude_id uuid default null,
  match_count int default 6
)
returns table (
  id uuid,
  name text,
  category text,
  image_url text,
  market_price_min numeric,
  market_price_max numeric,
  similarity float
)
language sql stable
security invoker
set search_path = public
as $$
  select s.id, s.name, s.category, s.image_url,
         s.market_price_min, s.market_price_max,
         1 - (s.embedding <=> query_embedding) as similarity
  from public.scans s
  where s.embedding is not null
    and (exclude_id is null or s.id <> exclude_id)
  order by s.embedding <=> query_embedding
  limit greatest(1, least(match_count, 24));
$$;

revoke execute on function public.match_scans(vector, uuid, int) from public, anon;
grant execute on function public.match_scans(vector, uuid, int) to authenticated, service_role;
