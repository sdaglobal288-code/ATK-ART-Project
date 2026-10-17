-- Jalankan di Supabase SQL Editor (setelah sql/kendaraan_dokumen_schema.sql)
-- Estimasi biaya perpanjangan dokumen kendaraan milik perusahaan
alter table public.kendaraan_perusahaan add column if not exists biaya_pajak numeric; -- estimasi pajak tahunan
alter table public.kendaraan_perusahaan add column if not exists biaya_stnk numeric;  -- estimasi pajak 5 tahunan (STNK/ganti plat)
alter table public.kendaraan_perusahaan add column if not exists biaya_kir numeric;   -- estimasi KIR
alter table public.kendaraan_perusahaan add column if not exists biaya_rekom numeric; -- estimasi rekomendasi kendaraan
