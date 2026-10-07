-- Modul Seragam (Kaos Polo, Jaket, Topi, dll). Jalankan di Supabase: SQL Editor > New query > paste > Run
-- Aman dijalankan ulang, dan otomatis memigrasi tabel kaos_polo_* bila sebelumnya sudah dibuat.

do $$ begin
  if to_regclass('public.kaos_polo_masuk') is not null and to_regclass('public.seragam_masuk') is null then
    alter table public.kaos_polo_masuk rename to seragam_masuk; end if;
  if to_regclass('public.kaos_polo_distribusi') is not null and to_regclass('public.seragam_distribusi') is null then
    alter table public.kaos_polo_distribusi rename to seragam_distribusi; end if;
end $$;

create table if not exists public.seragam_masuk (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  jenis text not null default 'Kaos Polo',
  vendor text,
  model text not null,
  warna text not null,
  ukuran text not null,
  jumlah integer not null check (jumlah > 0),
  keterangan text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists public.seragam_distribusi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  tahun integer not null,
  no_tt text,                      -- nomor tanda terima (beberapa barang bisa satu nomor)
  jenis text not null default 'Kaos Polo',
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

alter table public.seragam_masuk add column if not exists jenis text not null default 'Kaos Polo';
alter table public.seragam_distribusi add column if not exists jenis text not null default 'Kaos Polo';
alter table public.seragam_distribusi add column if not exists no_tt text;

-- Ukuran per jenis disimpan di master karyawan, contoh: {"Kaos Polo":"M","Jaket":"L","Topi":"All Size"}
alter table public.master_karyawan add column if not exists ukuran_seragam jsonb default '{}'::jsonb;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='master_karyawan' and column_name='ukuran_kaos') then
    update public.master_karyawan set ukuran_seragam = jsonb_build_object('Kaos Polo', ukuran_kaos)
      where ukuran_kaos is not null and (ukuran_seragam is null or ukuran_seragam = '{}'::jsonb);
  end if;
end $$;

alter table public.seragam_masuk enable row level security;
drop policy if exists "akses_anon_seragam_masuk" on public.seragam_masuk;
create policy "akses_anon_seragam_masuk" on public.seragam_masuk for all to anon using (true) with check (true);
alter table public.seragam_distribusi enable row level security;
drop policy if exists "akses_anon_seragam_distribusi" on public.seragam_distribusi;
create policy "akses_anon_seragam_distribusi" on public.seragam_distribusi for all to anon using (true) with check (true);
