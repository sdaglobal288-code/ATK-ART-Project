// =====================================
// MASTER DEPARTEMEN
// =====================================

const user = JSON.parse(localStorage.getItem("user"));

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
        .order("kode_departemen");

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
.addEventListener("submit", async function(e){

    e.preventDefault();

    const departemen = {

        kode_departemen:
            document.getElementById("kode_departemen").value.trim(),

        nama_departemen:
            document.getElementById("nama_departemen").value.trim()

    };

    const { error } = await supabaseClient
        .from("master_departemen")
        .insert(departemen);

    if(error){

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

async function hapusDepartemen(id){

    if(!confirm("Yakin ingin menghapus departemen ini?"))
        return;

    const { error } = await supabaseClient
        .from("master_departemen")
        .delete()
        .eq("id", id);

    if(error){

        alert(error.message);

        return;

    }

    loadDepartemen();

}

// =====================================
// EDIT
// =====================================

function editDepartemen(id){

    alert("Fitur Edit Departemen akan dibuat pada tahap berikutnya.");

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
// LOAD PERTAMA
// =====================================

loadDepartemen();
