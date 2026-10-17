-- Jalankan di Supabase SQL Editor (setelah sql/kendaraan_schema.sql dan kendaraan_dokumen_schema.sql)
-- Riwayat perpanjangan dokumen kendaraan milik perusahaan (Pajak, STNK, KIR, Rekom, Asuransi)
create table if not exists public.kendaraan_dokumen_riwayat (
  id uuid primary key default gen_random_uuid(),
  kendaraan_id uuid not null references public.kendaraan_perusahaan(id) on delete cascade,
  dokumen text not null check (dokumen in ('Pajak','STNK','KIR','Rekom','Asuransi')),
  berlaku_lama date,            -- masa berlaku sebelum diperpanjang
  berlaku_baru date not null,   -- masa berlaku setelah diperpanjang
  nomor text,                   -- no. KIR / rekom / polis yang baru (bila ada)
  biaya numeric,                -- biaya realisasi
  tgl_proses date default current_date,
  link_bukti text,
  keterangan text,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists kendaraan_dokumen_riwayat_idx on public.kendaraan_dokumen_riwayat (kendaraan_id, tgl_proses desc);

alter table public.kendaraan_dokumen_riwayat enable row level security;
drop policy if exists "akses_anon_kendaraan_dokumen_riwayat" on public.kendaraan_dokumen_riwayat;
create policy "akses_anon_kendaraan_dokumen_riwayat" on public.kendaraan_dokumen_riwayat
  for all to anon using (true) with check (true);
