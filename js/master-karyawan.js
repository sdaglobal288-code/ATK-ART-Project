// =====================================
// MASTER KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

// =====================================
// TAMPILKAN GUDANG
// =====================================

document.getElementById("gudang").value = user.gudang;

// =====================================
// LOAD DEPARTEMEN (SHARED)
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

    const select = document.getElementById("departemen");

    select.innerHTML = `
        <option value="">-- Pilih Departemen --</option>
    `;

    data.forEach(item => {

        select.innerHTML += `
            <option value="${item.nama_departemen}">
                ${item.nama_departemen}
            </option>
        `;

    });

}

// =====================================
// LOAD JABATAN (SHARED)
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

    const select = document.getElementById("jabatan");

    select.innerHTML = `
        <option value="">-- Pilih Jabatan --</option>
    `;

    data.forEach(item => {

        select.innerHTML += `
            <option value="${item.nama_jabatan}">
                ${item.nama_jabatan}
            </option>
        `;

    });

}

// =====================================
// LOAD KARYAWAN
// =====================================

async function loadKaryawan() {

    const { data, error } = await supabaseClient
        .from("master_karyawan")
        .select("*")
        .eq("gudang", user.gudang)
        .order("nama");

    if (error) {
        console.error(error);
        return;
    }

    const tbody = document.querySelector("#tableKaryawan tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.nik}</td>

            <td>${item.nama}</td>

            <td>${item.departemen}</td>

            <td>${item.jabatan}</td>

            <td>${item.gudang}</td>

            <td>

                <span class="${item.status === "Aktif"
                    ? "badge-success"
                    : "badge-danger"}">

                    ${item.status}

                </span>

            </td>

            <td>

                <button
                    class="btn-edit"
                    onclick="editKaryawan(${item.id})">

                    ✏ Edit

                </button>

                <button
                    class="btn-delete"
                    onclick="hapusKaryawan(${item.id})">

                    🗑 Hapus

                </button>

            </td>

        </tr>
        `;

    });

}

// =====================================
// SIMPAN
// =====================================

document
.getElementById("formKaryawan")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const nik = document
        .getElementById("nik")
        .value
        .trim();

    // =====================
    // VALIDASI NIK
    // =====================

    const { data: cekNik } = await supabaseClient
        .from("master_karyawan")
        .select("id")
        .eq("nik", nik)
        .eq("gudang", user.gudang);

    if (cekNik.length > 0) {

        alert("NIK sudah digunakan.");

        return;

    }

    // =====================

    const karyawan = {

        nik: nik,

        nama:
            document.getElementById("nama").value.trim(),

        departemen:
            document.getElementById("departemen").value,

        jabatan:
            document.getElementById("jabatan").value,

        gudang:
            user.gudang,

        status:
            document.getElementById("status").value

    };

    const { error } = await supabaseClient
        .from("master_karyawan")
        .insert([karyawan]);

    if (error) {

        alert(error.message);

        return;

    }

    alert("Karyawan berhasil disimpan.");

    document.getElementById("formKaryawan").reset();

    document.getElementById("gudang").value = user.gudang;

    loadDepartemen();

    loadJabatan();

    loadKaryawan();

});

// =====================================
// HAPUS
// =====================================

async function hapusKaryawan(id){

    if(!confirm("Hapus data karyawan?"))
        return;

    const { error } = await supabaseClient
        .from("master_karyawan")
        .delete()
        .eq("id", id);

    if(error){

        alert(error.message);

        return;

    }

    loadKaryawan();

}

// =====================================
// EDIT
// =====================================

function editKaryawan(id){

    alert("Fitur Edit Karyawan akan dibuat pada tahap berikutnya.");

}

// =====================================
// EXPORT
// =====================================

function exportExcel(){

    alert("Fitur Export Excel akan dibuat pada tahap berikutnya.");

}

// =====================================
// IMPORT
// =====================================

document
.getElementById("fileImport")
.addEventListener("change", function(){

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", function(){

    loadDepartemen();

    loadJabatan();

    loadKaryawan();

});
