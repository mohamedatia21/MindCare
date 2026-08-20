-- Add Row Level Security to strictly enforce tenant isolation

-- Pre-flight check: ensure the application role does NOT have BYPASSRLS
-- (Run unconditionally to ensure safety)
ALTER ROLE mindcare_user NOBYPASSRLS;

-- 1. Memories Table
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_memories ON memories
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- 2. Consents Table
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_consents ON consents
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- 3. Sessions Table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_sessions ON sessions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);
