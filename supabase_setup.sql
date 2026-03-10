-- Create pgvector extension if not exists
create extension if not exists vector;
-- Create eggent_memory table
create table eggent_memory (
    id uuid primary key default gen_random_uuid(),
    text text not null,
    embedding vector(768),
    -- Adjust dimension based on embeddingsModel if needed (e.g., 1024 for multilngual, 1536 for OpenAI)
    metadata jsonb default '{}'::jsonb,
    subdir text not null,
    created_at timestamp with time zone default now()
);
-- Create match_memories RPC function
create or replace function match_memories(
        query_embedding vector(768),
        -- Make sure this matches table embedding dimension
        match_threshold float,
        match_count int,
        p_subdir text,
        p_area text default null
    ) returns table(
        id uuid,
        text text,
        similarity float,
        metadata jsonb
    ) language plpgsql as $$ begin return query
select eggent_memory.id,
    eggent_memory.text,
    1 - (eggent_memory.embedding <=> query_embedding) as similarity,
    eggent_memory.metadata
from eggent_memory
where eggent_memory.subdir = p_subdir
    and (
        p_area is null
        or eggent_memory.metadata->>'area' = p_area
    )
    and 1 - (eggent_memory.embedding <=> query_embedding) > match_threshold
order by eggent_memory.embedding <=> query_embedding
limit match_count;
end;
$$;