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


-- =====================================================================
-- TAMBAHAN: format rekap absensi (tanggal menyamping, kode V/T/T1/T2/S/I/C/A/0 + kolom lembur LB/LL)
-- Jalankan bagian ini (aman diulang) bila tabel hr_absensi sudah dibuat sebelumnya.
-- =====================================================================
alter table public.hr_absensi add column if not exists kode text;            -- kode asli dari file (V, T, T1, T2, S, I, C, A, 0)
alter table public.hr_absensi add column if not exists lembur_jam numeric(5,2) not null default 0;
alter table public.hr_absensi add column if not exists hari_libur boolean not null default false;   -- kolom LL pada file
alter table public.hr_absensi add column if not exists unit_kerja text;
alter table public.hr_absensi add column if not exists departemen text;
alter table public.hr_absensi add column if not exists bagian text;
alter table public.hr_absensi add column if not exists jabatan text;
alter table public.hr_absensi add column if not exists grade text;


-- =====================================================================
-- TAMBAHAN: kategori yang diisi manual lewat sistem (tab "Kategorisasi")
--   Cuti    -> 'Cuti Tahunan' | 'Cuti Khusus'
--   T1 / T2 -> 'Terlambat'    | 'Pulang Cepat'
-- Import ulang TIDAK menghapus kategori (kolom ini tidak ikut ditimpa).
-- =====================================================================
alter table public.hr_absensi add column if not exists kategori text;
alter table public.hr_absensi add column if not exists kategori_oleh text;
alter table public.hr_absensi add column if not exists kategori_at timestamptz;
alter table public.hr_absensi drop constraint if exists hr_absensi_kategori_check;
alter table public.hr_absensi add constraint hr_absensi_kategori_check
  check (kategori is null or kategori in ('Cuti Tahunan','Cuti Khusus','Terlambat','Pulang Cepat'));
