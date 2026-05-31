-- Rend la table audit_log IMMUABLE (append-only) au niveau base de données.
-- UPDATE toujours interdit. DELETE interdit sauf purge de rétention contrôlée
-- (drapeau de session app.allow_audit_purge = 'on', posé par RetentionService).

CREATE OR REPLACE FUNCTION audit_log_no_mutate() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF current_setting('app.allow_audit_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_log est append-only : suppression interdite';
  END IF;
  RAISE EXCEPTION 'audit_log est append-only : modification interdite';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutate();
