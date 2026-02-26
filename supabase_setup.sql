-- ================================================
-- MIDA Sales Intelligence - Setup Supabase
-- Esegui questo script nell'SQL Editor di Supabase
-- ================================================

-- Elimina tabella precedente se esiste (attenzione: elimina i dati!)
-- DROP TABLE IF EXISTS deals;

-- Crea tabella deals
CREATE TABLE IF NOT EXISTS deals (
  id text PRIMARY KEY,
  owner text NOT NULL,
  customer text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  division text NOT NULL,
  industry text DEFAULT '',
  co_accounting text DEFAULT 'no',
  co_owners jsonb DEFAULT '[]',
  value numeric NOT NULL DEFAULT 0,
  value_q1 numeric DEFAULT 0,
  value_q2 numeric DEFAULT 0,
  value_q3 numeric DEFAULT 0,
  value_q4 numeric DEFAULT 0,
  estimated_date date,
  stage text NOT NULL DEFAULT 'v0',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Abilita accesso pubblico (Row Level Security disabilitato per semplicità)
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Policy: chiunque può leggere, inserire, aggiornare, eliminare
-- (per ora senza autenticazione - da proteggere in futuro)
CREATE POLICY "Accesso pubblico lettura" ON deals FOR SELECT USING (true);
CREATE POLICY "Accesso pubblico inserimento" ON deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Accesso pubblico aggiornamento" ON deals FOR UPDATE USING (true);
CREATE POLICY "Accesso pubblico eliminazione" ON deals FOR DELETE USING (true);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
