// =====================================
// MASTER DEPARTEMEN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// =====================================
// LOAD DATA
// =====================================

async function loadDepartemen() {

    const { data, error } = await supabaseClient
        .from("master_departemen")
        .select("*")
        .order("kode_departemen", { ascending: true });

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    const tbody = document.querySelector("#tableDepartemen tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.kode_departemen}</td>

            <td>${item.nama_departemen}</td>

            <td>

                <button
                    class="btn-edit"
                    onclick="editDepartemen(${item.id})">

                    ✏ Edit

                </button>

                <button
                    class="btn-delete"
                    onclick="hapusDepartemen(${item.id})">

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
.getElementById("formDepartemen")
.addEventListener("submit", async function (e) {

    e.preventDefault();

    const kode = document
        .getElementById("kode_departemen")
        .value
        .trim()
        .toUpperCase();

    const nama = document
        .getElementById("nama_departemen")
        .value
        .trim();

    // =============================
    // VALIDASI KODE
    // =============================

    const { data: cekKode } = await supabaseClient
        .from("master_departemen")
        .select("id")
        .eq("kode_departemen", kode);

    if (cekKode.length > 0) {

        alert("Kode Departemen sudah digunakan.");

        return;

    }

    // =============================
    // VALIDASI NAMA
    // =============================

    const { data: cekNama } = await supabaseClient
        .from("master_departemen")
        .select("id")
        .ilike("nama_departemen", nama);

    if (cekNama.length > 0) {

        alert("Nama Departemen sudah ada.");

        return;

    }

    // =============================

    const { error } = await supabaseClient
        .from("master_departemen")
        .insert([{

            kode_departemen: kode,

            nama_departemen: nama

        }]);

    if (error) {

        alert(error.message);

        return;

    }

    alert("Departemen berhasil disimpan.");

    document.getElementById("formDepartemen").reset();

    loadDepartemen();

});

// =====================================
// HAPUS
// =====================================

async function hapusDepartemen(id) {

    if (!confirm("Yakin ingin menghapus Departemen ini?"))
        return;

    const { error } = await supabaseClient
        .from("master_departemen")
        .delete()
        .eq("id", id);

    if (error) {

        alert(error.message);

        return;

    }

    loadDepartemen();

}

// =====================================
// EDIT
// =====================================

function editDepartemen(id) {

    alert("Fitur Edit Departemen akan dibuat pada tahap berikutnya.");

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

    loadDepartemen();

});
