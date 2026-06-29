const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

// =========================
// LOAD DATA
// =========================

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

            <td>${item.status}</td>

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

// =========================
// SIMPAN
// =========================

document
.getElementById("formKaryawan")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const karyawan = {

        nik : document.getElementById("nik").value,

        nama : document.getElementById("nama").value,

        departemen : document.getElementById("departemen").value,

        jabatan : document.getElementById("jabatan").value,

        status : document.getElementById("status").value,

        gudang : user.gudang

    };

    const { error } = await supabaseClient
        .from("master_karyawan")
        .insert(karyawan);

    if(error){

        alert(error.message);

        return;

    }

    alert("Data berhasil disimpan.");

    document.getElementById("formKaryawan").reset();

    loadKaryawan();

});

// =========================
// HAPUS
// =========================

async function hapusKaryawan(id){

    if(!confirm("Hapus data karyawan?")) return;

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

// =========================
// EDIT
// =========================

function editKaryawan(id){

    alert("Fitur Edit Karyawan akan dibuat pada tahap berikutnya.");

}

// =========================
// EXPORT
// =========================

function exportExcel(){

    alert("Fitur Export Excel akan dibuat.");

}

// =========================
// IMPORT
// =========================

document
.getElementById("fileImport")
.addEventListener("change", function(){

    alert("Fitur Import Excel akan dibuat.");

});

// =========================

loadKaryawan();
