// =====================================
// MUTASI KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// =====================================
// LOAD DEPARTEMEN
// =====================================

async function loadDepartemen() {

    const { data, error } = await supabaseClient
        .from("master_departemen")
        .select("*")
        .order("nama_departemen");

    if (error) {
        console.error(error);
        return;
    }

    const select = document.getElementById("departemen_baru");

    select.innerHTML =
        '<option value="">-- Pilih Departemen Baru --</option>';

    data.forEach(item => {

        select.innerHTML += `
            <option value="${item.nama_departemen}">
                ${item.nama_departemen}
            </option>
        `;

    });

}

// =====================================
// LOAD JABATAN
// =====================================

async function loadJabatan() {

    const { data, error } = await supabaseClient
        .from("master_jabatan")
        .select("*")
        .order("nama_jabatan");

    if (error) {
        console.error(error);
        return;
    }

    const select = document.getElementById("jabatan_baru");

    select.innerHTML =
        '<option value="">-- Pilih Jabatan Baru --</option>';

    data.forEach(item => {

        select.innerHTML += `
            <option value="${item.nama_jabatan}">
                ${item.nama_jabatan}
            </option>
        `;

    });

}

// =====================================
// CARI KARYAWAN BERDASARKAN NIK
// =====================================

document.getElementById("nik").addEventListener("change", cariKaryawan);

async function cariKaryawan() {

    const nik = document.getElementById("nik").value.trim();

    if (!nik) return;

    const { data, error } = await supabaseClient
        .from("master_karyawan")
        .select("*")
        .eq("nik", nik)
        .single();

    if (error || !data) {

        alert("Karyawan tidak ditemukan.");

        document.getElementById("nama").value = "";
        document.getElementById("gudang_lama").value = "";
        document.getElementById("departemen_lama").value = "";
        document.getElementById("jabatan_lama").value = "";

        return;

    }

    document.getElementById("nama").value = data.nama;
    document.getElementById("gudang_lama").value = data.gudang;
    document.getElementById("departemen_lama").value = data.departemen;
    document.getElementById("jabatan_lama").value = data.jabatan;

}

// =====================================
// SIMPAN MUTASI
// =====================================

document
.getElementById("formMutasi")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const nik = document.getElementById("nik").value.trim();

    const nama = document.getElementById("nama").value;

    const gudangLama = document.getElementById("gudang_lama").value;

    const departemenLama = document.getElementById("departemen_lama").value;

    const jabatanLama = document.getElementById("jabatan_lama").value;

    const gudangBaru = document.getElementById("gudang_baru").value;

    const departemenBaru = document.getElementById("departemen_baru").value;

    const jabatanBaru = document.getElementById("jabatan_baru").value;

    const keterangan = document.getElementById("keterangan").value;

    if (
        !gudangBaru ||
        !departemenBaru ||
        !jabatanBaru
    ) {

        alert("Lengkapi data mutasi.");

        return;

    }

    // =================================
    // SIMPAN HISTORI
    // =================================

    const { error: errorInsert } = await supabaseClient
        .from("mutasi_karyawan")
        .insert([{

            nik: nik,

            nama: nama,

            gudang_lama: gudangLama,

            gudang_baru: gudangBaru,

            departemen_lama: departemenLama,

            departemen_baru: departemenBaru,

            jabatan_lama: jabatanLama,

            jabatan_baru: jabatanBaru,

            keterangan: keterangan,

            created_by: user.nama

        }]);

    if (errorInsert) {

        alert(errorInsert.message);

        return;

    }

    // =================================
    // UPDATE MASTER KARYAWAN
    // =================================

    const { error: errorUpdate } = await supabaseClient
        .from("master_karyawan")
        .update({

            gudang: gudangBaru,

            departemen: departemenBaru,

            jabatan: jabatanBaru

        })
        .eq("nik", nik);

    if (errorUpdate) {

        alert(errorUpdate.message);

        return;

    }

    alert("Mutasi berhasil disimpan.");

    document.getElementById("formMutasi").reset();

    document.getElementById("nama").value = "";
    document.getElementById("gudang_lama").value = "";
    document.getElementById("departemen_lama").value = "";
    document.getElementById("jabatan_lama").value = "";

});

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {

    await loadDepartemen();

    await loadJabatan();

});
