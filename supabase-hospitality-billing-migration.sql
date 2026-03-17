-- Migration: Add billing/retainer fields to hm_properties
-- Date: 2026-03-17

ALTER TABLE hm_properties ADD COLUMN hourly_rate decimal(10,2) DEFAULT NULL;
ALTER TABLE hm_properties ADD COLUMN is_retainer boolean DEFAULT false;
ALTER TABLE hm_properties ADD COLUMN retainer_amount decimal(10,2) DEFAULT NULL;
ALTER TABLE hm_properties ADD COLUMN retainer_start_date date DEFAULT NULL;
ALTER TABLE hm_properties ADD COLUMN retainer_end_date date DEFAULT NULL;
