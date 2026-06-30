// =====================================
// MASTER JABATAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// =====================================
// LOAD JABATAN
// =====================================

async function loadJabatan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_jabatan")
            .select("*")
            .order("kode_jabatan", { ascending: true });

        if (error) throw error;

        const tbody =
            document.querySelector("#tableJabatan tbody");

        tbody.innerHTML = "";

        data.forEach(item => {

            tbody.innerHTML += `

            <tr>

                <td>${item.kode_jabatan}</td>

                <td>${item.nama_jabatan}</td>

                <td>${item.created_by ?? "-"}</td>

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

    catch(err){

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// SIMPAN / UPDATE JABATAN
// =====================================

const form = document.getElementById("formJabatan");

if(form){

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const kode = document
            .getElementById("kode_jabatan")
            .value
            .trim()
            .toUpperCase();

        const nama = document
            .getElementById("nama_jabatan")
            .value
            .trim();

        // =====================================
        // UPDATE
        // =====================================

        if(editId !== null){

            const { data: cekNamaUpdate } = await supabaseClient

                .from("master_jabatan")

                .select("id")

                .ilike("nama_jabatan", nama)

                .neq("id", editId);

            if(cekNamaUpdate.length > 0){

                alert("Nama Jabatan sudah digunakan.");

                return;

            }

            const { error } = await supabaseClient

                .from("master_jabatan")

                .update({

                    nama_jabatan : nama

                })

                .eq("id", editId);

            if(error) throw error;

            alert("Jabatan berhasil diupdate.");

            batalEdit();

            loadJabatan();

            return;

        }

        // =====================================
        // VALIDASI KODE
        // =====================================

        const { data: cekKode } = await supabaseClient

            .from("master_jabatan")

            .select("id")

            .eq("kode_jabatan", kode);

        if(cekKode.length > 0){

            alert("Kode Jabatan sudah digunakan.");

            return;

        }

        // =====================================
        // VALIDASI NAMA
        // =====================================

        const { data: cekNama } = await supabaseClient

            .from("master_jabatan")

            .select("id")

            .ilike("nama_jabatan", nama);

        if(cekNama.length > 0){

            alert("Nama Jabatan sudah digunakan.");

            return;

        }

        // =====================================
        // INSERT
        // =====================================

        const { error } = await supabaseClient

            .from("master_jabatan")

            .insert([{

                kode_jabatan : kode,

                nama_jabatan : nama,

                created_by : user.nama

            }]);

        if(error) throw error;

        alert("Jabatan berhasil disimpan.");

        form.reset();

        loadJabatan();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// EDIT JABATAN
// =====================================

async function editJabatan(id){

    try{

        const { data, error } = await supabaseClient

            .from("master_jabatan")

            .select("*")

            .eq("id", id)

            .single();

        if(error) throw error;

        editId = id;

        document.getElementById("kode_jabatan").value =
            data.kode_jabatan;

        document.getElementById("nama_jabatan").value =
            data.nama_jabatan;

        // Kode Jabatan tidak boleh diubah saat edit
        document.getElementById("kode_jabatan").readOnly = true;

        document.getElementById("judulForm").innerHTML =
            "✏ Edit Jabatan";

        document.getElementById("btnSimpan").innerHTML =
            "💾 Update Jabatan";

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

    document.getElementById("kode_jabatan").readOnly = false;

    document.getElementById("judulForm").innerHTML =
        "➕ Tambah Jabatan";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Jabatan";

    document.getElementById("btnBatal").style.display =
        "none";

}

document

.getElementById("btnBatal")

.addEventListener("click", batalEdit);

// =====================================
// HAPUS JABATAN
// =====================================

async function hapusJabatan(id){

    if(!confirm("Yakin ingin menghapus Jabatan ini?"))
        return;

    try{

        const { error } = await supabaseClient

            .from("master_jabatan")

            .delete()

            .eq("id", id);

        if(error) throw error;

        alert("Jabatan berhasil dihapus.");

        loadJabatan();

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

    await loadJabatan();

});
