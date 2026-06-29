const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

// ===============================
// LOAD DATA
// ===============================

async function loadJabatan() {

    const { data, error } = await supabaseClient
        .from("master_jabatan")
        .select("*")
        .eq("gudang", user.gudang)
        .order("nama_jabatan");

    if (error) {
        console.error(error);
        return;
    }

    const tbody = document.querySelector("#tableJabatan tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.kode_jabatan}</td>

            <td>${item.nama_jabatan}</td>

            <td>${item.gudang}</td>

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

// ===============================
// SIMPAN
// ===============================

document
.getElementById("formJabatan")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const jabatan = {

        kode_jabatan : document.getElementById("kode_jabatan").value.trim(),

        nama_jabatan : document.getElementById("nama_jabatan").value.trim(),

        gudang : user.gudang

    };

    const { error } = await supabaseClient
        .from("master_jabatan")
        .insert(jabatan);

    if(error){

        alert(error.message);

        return;

    }

    alert("Jabatan berhasil disimpan.");

    document.getElementById("formJabatan").reset();

    loadJabatan();

});

// ===============================
// HAPUS
// ===============================

async function hapusJabatan(id){

    if(!confirm("Hapus data jabatan ini?")) return;

    const { error } = await supabaseClient
        .from("master_jabatan")
        .delete()
        .eq("id", id);

    if(error){

        alert(error.message);

        return;

    }

    loadJabatan();

}

// ===============================
// EDIT
// ===============================

function editJabatan(id){

    alert("Fitur Edit Jabatan akan dibuat pada tahap berikutnya.");

}

// ===============================
// EXPORT
// ===============================

function exportExcel(){

    alert("Fitur Export Excel akan dibuat pada tahap berikutnya.");

}

// ===============================
// IMPORT
// ===============================

document
.getElementById("fileImport")
.addEventListener("change", function(){

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

// ===============================

loadJabatan();
