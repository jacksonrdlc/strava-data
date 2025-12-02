-- Function to search for similar activities using vector similarity
CREATE OR REPLACE FUNCTION match_activities(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    activity_id BIGINT,
    athlete_id BIGINT,
    summary TEXT,
    similarity FLOAT,
    activity_date TIMESTAMP WITH TIME ZONE,
    distance NUMERIC,
    moving_time INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ae.activity_id,
        a.athlete_id,
        ae.summary,
        1 - (ae.embedding <=> query_embedding) AS similarity,
        a.activity_date,
        a.distance,
        a.moving_time
    FROM activity_embeddings ae
    JOIN activities a ON ae.activity_id = a.id
    WHERE 1 - (ae.embedding <=> query_embedding) > match_threshold
    ORDER BY ae.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_activities TO authenticated, anon, service_role;
