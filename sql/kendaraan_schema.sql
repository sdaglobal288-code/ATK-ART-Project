-- Jalankan di Supabase: SQL Editor > New query > paste > Run
-- Modul Kendaraan > tab "Kendaraan Milik Perusahaan"
-- (tab "Sewa Kendaraan" tetap memakai tabel perjanjian_vendor dari sql/vendor_schema.sql)
create table if not exists public.kendaraan_perusahaan (
  id uuid primary key default gen_random_uuid(),
  no_polisi text not null,
  jenis text default 'Mobil',               -- Mobil / Motor / Truk / Bus / Lainnya
  merk_tipe text not null,
  tahun integer,
  warna text,
  no_rangka text,
  no_mesin text,
  no_bpkb text,
  area text,
  departemen text,
  pengguna text,                            -- PIC / pemegang kendaraan
  status text default 'Aktif',              -- Aktif / Perawatan / Non-Aktif / Dijual
  km_terakhir numeric,
  tgl_perolehan date,
  harga_perolehan numeric,
  tgl_pajak date,                           -- jatuh tempo pajak tahunan
  tgl_stnk date,                            -- masa berlaku STNK (5 tahunan)
  asuransi_nama text,
  no_polis text,
  tgl_asuransi date,                        -- asuransi berakhir
  link_dokumen text,
  keterangan text,
  created_by text,
  created_at timestamptz default now()
);
create unique index if not exists kendaraan_perusahaan_no_polisi_uq on public.kendaraan_perusahaan (upper(no_polisi));

alter table public.kendaraan_perusahaan enable row level security;
drop policy if exists "akses_anon_kendaraan_perusahaan" on public.kendaraan_perusahaan;
create policy "akses_anon_kendaraan_perusahaan" on public.kendaraan_perusahaan
  for all to anon using (true) with check (true);
