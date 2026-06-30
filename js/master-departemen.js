// =====================================
// MASTER DEPARTEMEN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// =====================================
// LOAD DEPARTEMEN
// =====================================

async function loadDepartemen() {

    try {

        const { data, error } = await supabaseClient
            .from("master_departemen")
            .select("*")
            .order("kode_departemen", { ascending: true });

        if (error) throw error;

        const tbody =
            document.querySelector("#tableDepartemen tbody");

        tbody.innerHTML = "";

        data.forEach(item => {

            tbody.innerHTML += `

            <tr>

                <td>${item.kode_departemen}</td>

                <td>${item.nama_departemen}</td>

                <td>${item.created_by ?? "-"}</td>

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

    catch(err){

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// SIMPAN / UPDATE DEPARTEMEN
// =====================================

const form = document.getElementById("formDepartemen");

if(form){

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const kode = document
            .getElementById("kode_departemen")
            .value
            .trim()
            .toUpperCase();

        const nama = document
            .getElementById("nama_departemen")
            .value
            .trim();

        // =====================================
        // UPDATE
        // =====================================

        if(editId !== null){

            // Validasi nama saat update
            const { data: cekNamaUpdate } = await supabaseClient

                .from("master_departemen")

                .select("id")

                .ilike("nama_departemen", nama)

                .neq("id", editId);

            if(cekNamaUpdate.length > 0){

                alert("Nama Departemen sudah digunakan.");

                return;

            }

            const { error } = await supabaseClient

                .from("master_departemen")

                .update({

                    nama_departemen : nama

                })

                .eq("id", editId);

            if(error) throw error;

            alert("Departemen berhasil diupdate.");

            batalEdit();

            loadDepartemen();

            return;

        }

        // =====================================
        // VALIDASI KODE
        // =====================================

        const { data: cekKode } = await supabaseClient

            .from("master_departemen")

            .select("id")

            .eq("kode_departemen", kode);

        if(cekKode.length > 0){

            alert("Kode Departemen sudah digunakan.");

            return;

        }

        // =====================================
        // VALIDASI NAMA
        // =====================================

        const { data: cekNama } = await supabaseClient

            .from("master_departemen")

            .select("id")

            .ilike("nama_departemen", nama);

        if(cekNama.length > 0){

            alert("Nama Departemen sudah digunakan.");

            return;

        }

        // =====================================
        // INSERT
        // =====================================

        const { error } = await supabaseClient

            .from("master_departemen")

            .insert([{

                kode_departemen : kode,

                nama_departemen : nama,

                created_by : user.nama

            }]);

        if(error) throw error;

        alert("Departemen berhasil disimpan.");

        form.reset();

        loadDepartemen();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// EDIT DEPARTEMEN
// =====================================

async function editDepartemen(id){

    try{

        const { data, error } = await supabaseClient

            .from("master_departemen")

            .select("*")

            .eq("id", id)

            .single();

        if(error) throw error;

        editId = id;

        document.getElementById("kode_departemen").value =
            data.kode_departemen;

        document.getElementById("nama_departemen").value =
            data.nama_departemen;

        // Kode tidak boleh diubah saat edit
        document.getElementById("kode_departemen").readOnly = true;

        document.getElementById("judulForm").innerHTML =
            "✏ Edit Departemen";

        document.getElementById("btnSimpan").innerHTML =
            "💾 Update Departemen";

        document.getElementById("btnBatal").style.display =
            "inline-block";

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// BATAL EDIT
// =====================================

function batalEdit(){

    editId = null;

    form.reset();

    document.getElementById("kode_departemen").readOnly = false;

    document.getElementById("judulForm").innerHTML =
        "➕ Tambah Departemen";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Departemen";

    document.getElementById("btnBatal").style.display =
        "none";

}

document

.getElementById("btnBatal")

.addEventListener("click", batalEdit);

// =====================================
// HAPUS DEPARTEMEN
// =====================================

async function hapusDepartemen(id){

    if(!confirm("Yakin ingin menghapus Departemen ini?"))
        return;

    try{

        const { error } = await supabaseClient

            .from("master_departemen")

            .delete()

            .eq("id", id);

        if(error) throw error;

        alert("Departemen berhasil dihapus.");

        loadDepartemen();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

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

const fileImport =
document.getElementById("fileImport");

if(fileImport){

fileImport.addEventListener("change",function(){

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async ()=>{

    await loadDepartemen();

});
