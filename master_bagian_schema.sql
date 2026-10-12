-- =====================================================================
-- MASTER BAGIAN  +  kolom LEVEL & BAGIAN pada master_karyawan
-- Jalankan di Supabase > SQL Editor. Aman dijalankan ulang.
-- =====================================================================

-- Bagian = sub-unit di dalam departemen (mis. Departemen "Warehouse & Logistic" -> Bagian "Gudang", "Pengiriman").
-- departemen boleh kosong = bagian berlaku untuk semua departemen.
create table if not exists public.master_bagian (
  id uuid primary key default gen_random_uuid(),
  nama_bagian text not null,
  departemen text,
  created_by text,
  created_at timestamptz default now()
);
-- Nama bagian yang sama tidak boleh dobel di departemen yang sama
create unique index if not exists uq_master_bagian_nama
  on public.master_bagian (lower(nama_bagian), lower(coalesce(departemen, '')));

alter table public.master_bagian enable row level security;
drop policy if exists "akses_anon_master_bagian" on public.master_bagian;
create policy "akses_anon_master_bagian" on public.master_bagian for all to anon using (true) with check (true);

-- Karyawan menyimpan NAMA level (dari master_level_jabatan.nama_level) dan NAMA bagian (dari master_bagian.nama_bagian),
-- sama seperti departemen / area / jabatan yang sudah ada. Boleh kosong untuk karyawan lama.
alter table public.master_karyawan add column if not exists level text;
alter table public.master_karyawan add column if not exists bagian text;
