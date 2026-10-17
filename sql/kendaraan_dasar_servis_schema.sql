-- Jalankan di Supabase SQL Editor (setelah sql/kendaraan_servis_schema.sql)
-- Dasar jadwal servis per kendaraan: 'KM & Bulan' (default) atau 'Bulan' (mis. speedometer rusak)
alter table public.kendaraan_perusahaan add column if not exists dasar_servis text default 'KM & Bulan';
