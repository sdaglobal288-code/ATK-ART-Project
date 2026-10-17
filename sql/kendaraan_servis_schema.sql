-- Jalankan di Supabase SQL Editor SETELAH sql/kendaraan_schema.sql
-- Jadwal servis berkala kendaraan milik perusahaan

-- Pengaturan interval per kendaraan + titik awal jadwal
alter table public.kendaraan_perusahaan add column if not exists interval_km integer default 10000;
alter table public.kendaraan_perusahaan add column if not exists interval_bulan integer default 3;
alter table public.kendaraan_perusahaan add column if not exists servis_awal_tgl date;   -- tanggal servis terakhir (titik awal)
alter table public.kendaraan_perusahaan add column if not exists servis_awal_km numeric; -- odometer saat servis terakhir

-- Satu baris = satu servis (terjadwal dan/atau sudah direalisasi)
create table if not exists public.kendaraan_servis (
  id uuid primary key default gen_random_uuid(),
  kendaraan_id uuid not null references public.kendaraan_perusahaan(id) on delete cascade,
  jenis text default 'Service Rutin',        -- Service Rutin / Perbaikan Tambahan
  target_tgl date,
  target_km numeric,
  tgl_realisasi date,
  odometer numeric,
  komponen text,
  bengkel text,
  biaya numeric,
  keterangan text,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists kendaraan_servis_kendaraan_idx on public.kendaraan_servis (kendaraan_id);

alter table public.kendaraan_servis enable row level security;
drop policy if exists "akses_anon_kendaraan_servis" on public.kendaraan_servis;
create policy "akses_anon_kendaraan_servis" on public.kendaraan_servis
  for all to anon using (true) with check (true);
