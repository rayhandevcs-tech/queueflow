-- Sprint 11 RLS review finding: `chairs` has two permissive SELECT policies —
-- "chairs: public read" (USING true) and "anyone can browse active chairs"
-- (USING is_active = true). Postgres OR-combines multiple permissive policies for the same
-- command, so the unconditional "true" policy silently makes the is_active restriction a
-- no-op: inactive (removed/deactivated) chairs are currently readable by anyone, including
-- unauthenticated visitors browsing a shop's staff list.
--
-- This migration changes live behavior (unlike the baseline-capture migration next to it):
-- inactive chairs stop being publicly selectable after this runs. Run it in the Supabase
-- dashboard's SQL editor once 20260730_capture_baseline_queue_engine.sql has been applied.

DROP POLICY IF EXISTS "chairs: public read" ON public.chairs;
