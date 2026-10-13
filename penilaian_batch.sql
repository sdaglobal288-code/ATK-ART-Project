-- Form A: beberapa karyawan dalam satu form. Jalankan sekali di Supabase SQL Editor.
alter table public.penilaian_karyawan add column if not exists batch_id uuid;
create index if not exists idx_penilaian_karyawan_batch on public.penilaian_karyawan(batch_id);
