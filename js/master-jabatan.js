// =====================================
// MASTER JABATAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

// =====================================
// LOAD DATA
// =====================================

async function loadJabatan() {

    const { data, error } = await supabaseClient
        .from("master_jabatan")
        .select("*")
        .order("kode_jabatan", { ascending: true });

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    const tbody = document.querySelector("#tableJabatan tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.kode_jabatan}</td>

            <td>${item.nama_jabatan}</td>

            <td>

                <button
                    class="btn-edit"
                    onclick="editJabatan(${item.id})">

                    ✏ Edit

                </button>

                <button
                    class="btn-delete"
                    onclick="hapusJabatan(${item.id})">

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
.getElementById("formJabatan")
.addEventListener("submit", async function (e) {

    e.preventDefault();

    const kode = document
        .getElementById("kode_jabatan")
        .value
        .trim()
        .toUpperCase();

    const nama = document
        .getElementById("nama_jabatan")
        .value
        .trim();

    // ============================
    // VALIDASI KODE
    // ============================

    const { data: cekKode } = await supabaseClient
        .from("master_jabatan")
        .select("id")
        .eq("kode_jabatan", kode);

    if (cekKode.length > 0) {

        alert("Kode Jabatan sudah digunakan.");

        return;

    }

    // ============================
    // VALIDASI NAMA
    // ============================

    const { data: cekNama } = await supabaseClient
        .from("master_jabatan")
        .select("id")
        .ilike("nama_jabatan", nama);

    if (cekNama.length > 0) {

        alert("Nama Jabatan sudah ada.");

        return;

    }

    // ============================

    const { error } = await supabaseClient
        .from("master_jabatan")
        .insert([{

            kode_jabatan: kode,

            nama_jabatan: nama

        }]);

    if (error) {

        alert(error.message);

        return;

    }

    alert("Jabatan berhasil disimpan.");

    document.getElementById("formJabatan").reset();

    loadJabatan();

});

// =====================================
// HAPUS
// =====================================

async function hapusJabatan(id) {

    if (!confirm("Hapus data jabatan ini?"))
        return;

    const { error } = await supabaseClient
        .from("master_jabatan")
        .delete()
        .eq("id", id);

    if (error) {

        alert(error.message);

        return;

    }

    loadJabatan();

}

// =====================================
// EDIT
// =====================================

function editJabatan(id) {

    alert("Fitur Edit Jabatan akan dibuat pada tahap berikutnya.");

}

// =====================================
// EXPORT
// =====================================

function exportExcel() {

    alert("Fitur Export Excel akan dibuat pada tahap berikutnya.");

}

// =====================================
// IMPORT
// =====================================

document
.getElementById("fileImport")
.addEventListener("change", function () {

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    loadJabatan();

});
