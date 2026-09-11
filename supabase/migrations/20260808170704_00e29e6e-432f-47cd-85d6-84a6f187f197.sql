create extension if not exists vector;

CREATE TABLE public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  source text not null default 'paste',
  content text not null default '',
  chunk_count integer not null default 0,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own documents" ON public.knowledge_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_estimate integer not null default 0,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chunks" ON public.knowledge_chunks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX knowledge_chunks_doc_idx ON public.knowledge_chunks (document_id, chunk_index);
CREATE INDEX knowledge_chunks_embedding_idx ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 6,
  min_similarity double precision DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  title text,
  chunk_index integer,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.document_id, d.title, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE c.user_id = auth.uid()
    AND 1 - (c.embedding <=> query_embedding) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT greatest(1, least(match_count, 20));
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, integer, double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer, double precision) TO authenticated, service_role;