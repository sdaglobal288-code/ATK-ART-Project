-- Jalankan di Supabase SQL Editor (setelah sql/kendaraan_schema.sql)
-- Tambahan dokumen kendaraan milik perusahaan: KIR dan Rekomendasi Kendaraan
alter table public.kendaraan_perusahaan add column if not exists no_kir text;
alter table public.kendaraan_perusahaan add column if not exists tgl_kir date;     -- masa berlaku KIR
alter table public.kendaraan_perusahaan add column if not exists no_rekom text;
alter table public.kendaraan_perusahaan add column if not exists tgl_rekom date;   -- masa berlaku rekomendasi kendaraan
