-- Jalankan di Supabase SQL Editor (setelah sql/kendaraan_schema.sql)
-- Nama pemilik yang tercantum di STNK
alter table public.kendaraan_perusahaan add column if not exists stnk_atas_nama text;
