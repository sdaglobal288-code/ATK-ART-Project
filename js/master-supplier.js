// =====================================
// MASTER SUPPLIER
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// =====================================
// LOAD DATA
// =====================================

async function loadSupplier() {

    try {

        const { data, error } = await supabaseClient
            .from("master_supplier")
            .select("*")
            .order("nama_toko");

        if (error) throw error;

        const tbody = document.querySelector("#tableSupplier tbody");

        tbody.innerHTML = "";

        data.forEach(item => {

            tbody.innerHTML += `
            <tr>

                <td>${item.kode_supplier}</td>

                <td>${item.nama_toko}</td>

                <td>${item.created_by ?? "-"}</td>

                <td>

                    <button
                        class="btn-edit"
                        onclick="editSupplier(${item.id})">

                        ✏ Edit

                    </button>

                    <button
                        class="btn-delete"
                        onclick="hapusSupplier(${item.id})">

                        🗑 Hapus

                    </button>

                </td>

            </tr>
            `;

        });

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// SIMPAN / UPDATE
// =====================================

const form = document.getElementById("formSupplier");

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const kode = document
            .getElementById("kode_supplier")
            .value
            .trim()
            .toUpperCase();

        const supplier = {

            kode_supplier : kode,

            nama_toko : document
                .getElementById("nama_toko")
                .value
                .trim(),

            created_by : user.nama

        };

        // =====================================
        // UPDATE
        // =====================================

        if(editId !== null){

            const { error } = await supabaseClient

                .from("master_supplier")

                .update({

                    nama_toko : supplier.nama_toko

                })

                .eq("id", editId);

            if(error) throw error;

            alert("Supplier berhasil diupdate.");

            batalEdit();

            loadSupplier();

            return;

        }

        // =====================================
        // VALIDASI KODE
        // =====================================

        const { data: cek } = await supabaseClient

            .from("master_supplier")

            .select("id")

            .eq("kode_supplier", kode);

        if(cek.length > 0){

            alert("Kode Supplier sudah digunakan.");

            return;

        }

        // =====================================
        // INSERT
        // =====================================

        const { error } = await supabaseClient

            .from("master_supplier")

            .insert([supplier]);

        if(error) throw error;

        alert("Supplier berhasil disimpan.");

        form.reset();

        loadSupplier();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

// =====================================
// EDIT
// =====================================

async function editSupplier(id){

    try{

        const { data, error } = await supabaseClient

            .from("master_supplier")

            .select("*")

            .eq("id", id)

            .single();

        if(error) throw error;

        editId = id;

        document.getElementById("kode_supplier").value =
            data.kode_supplier;

        document.getElementById("nama_toko").value =
            data.nama_toko;

        document.getElementById("kode_supplier").readOnly = true;

        document.getElementById("judulForm").innerHTML =
            "✏ Edit Supplier";

        document.getElementById("btnSimpan").innerHTML =
            "💾 Update Supplier";

        document.getElementById("btnBatal").style.display =
            "inline-block";

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    }

    catch(err){

        alert(err.message);

    }

}

// =====================================
// BATAL EDIT
// =====================================

function batalEdit(){

    editId = null;

    form.reset();

    document.getElementById("kode_supplier").readOnly = false;

    document.getElementById("judulForm").innerHTML =
        "➕ Tambah Supplier";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Supplier";

    document.getElementById("btnBatal").style.display =
        "none";

}

document
.getElementById("btnBatal")
.addEventListener("click", batalEdit);

// =====================================
// HAPUS
// =====================================

async function hapusSupplier(id){

    if(!confirm("Hapus Supplier ini?"))
        return;

    try{

        const { error } = await supabaseClient

            .from("master_supplier")

            .delete()

            .eq("id", id);

        if(error) throw error;

        alert("Supplier berhasil dihapus.");

        loadSupplier();

    }

    catch(err){

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

document
.getElementById("fileImport")
.addEventListener("change", function(){

    alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

});

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", function(){

    loadSupplier();

});
