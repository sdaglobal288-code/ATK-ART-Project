-- =====================================================================
-- MODUL DASHBOARD ANALITIK HR  (halaman: hr-analitik.html)
-- Jalankan di Supabase > SQL Editor. Aman dijalankan ulang.
-- Data karyawan diambil dari master_karyawan; absensi diimport dari Excel.
-- =====================================================================

-- Satu baris = satu karyawan pada satu tanggal. Import ulang file yang sama menimpa baris (tidak dobel).
create table if not exists public.hr_absensi (
  id uuid primary key default gen_random_uuid(),
  nik text not null,
  nama text,
  tanggal date not null,
  jam_masuk time,
  jam_keluar time,
  status text not null check (status in ('Hadir','Terlambat','Sakit','Izin','Cuti','Alpha','Dinas','Libur')),
  terlambat_menit integer not null default 0,
  jam_kerja numeric(5,2),
  keterangan text,
  batch_id uuid,
  created_by text,
  created_at timestamptz default now(),
  unique (nik, tanggal)
);
create index if not exists idx_hr_absensi_tanggal on public.hr_absensi (tanggal);
create index if not exists idx_hr_absensi_nik on public.hr_absensi (nik);
create index if not exists idx_hr_absensi_batch on public.hr_absensi (batch_id);

-- Riwayat import (untuk melihat dan membatalkan import)
create table if not exists public.hr_absensi_import (
  id uuid primary key default gen_random_uuid(),
  nama_file text,
  periode_awal date,
  periode_akhir date,
  jumlah_baris integer,
  diimport_oleh text,
  created_at timestamptz default now()
);

alter table public.hr_absensi enable row level security;
alter table public.hr_absensi_import enable row level security;
drop policy if exists "akses_anon_hr_absensi" on public.hr_absensi;
create policy "akses_anon_hr_absensi" on public.hr_absensi for all to anon using (true) with check (true);
drop policy if exists "akses_anon_hr_absensi_import" on public.hr_absensi_import;
create policy "akses_anon_hr_absensi_import" on public.hr_absensi_import for all to anon using (true) with check (true);
