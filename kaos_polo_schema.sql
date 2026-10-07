-- Modul Kaos Polo. Jalankan di Supabase: SQL Editor > New query > paste > Run

-- Stok masuk dari vendor (stok sisa = total masuk - total distribusi, per model/warna/ukuran)
create table if not exists public.kaos_polo_masuk (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  vendor text,
  model text not null,
  warna text not null,
  ukuran text not null,
  jumlah integer not null check (jumlah > 0),
  keterangan text,
  created_by text,
  created_at timestamptz default now()
);

-- Pencatatan penerimaan kaos oleh karyawan
create table if not exists public.kaos_polo_distribusi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  tahun integer not null,
  nik text,
  nama text not null,
  departemen text,
  area text,
  model text not null,
  warna text not null,
  ukuran text not null,
  jumlah integer not null default 1 check (jumlah > 0),
  keterangan text,
  created_by text,
  created_at timestamptz default now()
);

-- Ukuran kaos disimpan di master karyawan (satu sumber data untuk semua modul)
alter table public.master_karyawan add column if not exists ukuran_kaos text;

alter table public.kaos_polo_masuk enable row level security;
drop policy if exists "akses_anon_kaos_polo_masuk" on public.kaos_polo_masuk;
create policy "akses_anon_kaos_polo_masuk" on public.kaos_polo_masuk for all to anon using (true) with check (true);

alter table public.kaos_polo_distribusi enable row level security;
drop policy if exists "akses_anon_kaos_polo_distribusi" on public.kaos_polo_distribusi;
create policy "akses_anon_kaos_polo_distribusi" on public.kaos_polo_distribusi for all to anon using (true) with check (true);
