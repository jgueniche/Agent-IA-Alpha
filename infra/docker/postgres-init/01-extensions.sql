-- Extensions PostgreSQL utiles (chiffrement au repos cote DB, UUID).
-- Le chiffrement applicatif des champs sensibles reste gere par core-api (CryptoService) ;
-- pgcrypto est disponible pour des besoins complementaires.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
