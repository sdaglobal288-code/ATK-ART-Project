// =====================================
// MASTER BARANG
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;

// =====================================
// LOAD KATEGORI
// =====================================

async function loadKategori() {

    try {

        const { data, error } = await supabaseClient
            .from("kategori_barang")
            .select("*")
            .order("nama_kategori");

        if (error) throw error;

        const kategori = document.getElementById("kategori");

        kategori.innerHTML = `
            <option value="">
                -- Pilih Kategori --
            </option>
        `;

        data.forEach(item => {

            kategori.innerHTML += `
                <option value="${item.nama_kategori}">
                    ${item.nama_kategori}
                </option>
            `;

        });

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// LOAD SATUAN
// =====================================

async function loadSatuan() {

    try {

        const { data, error } = await supabaseClient
            .from("satuan")
            .select("*")
            .order("nama_satuan");

        if (error) throw error;

        const satuan = document.getElementById("satuan");

        satuan.innerHTML = `
            <option value="">
                -- Pilih Satuan --
            </option>
        `;

        data.forEach(item => {

            satuan.innerHTML += `
                <option value="${item.nama_satuan}">
                    ${item.nama_satuan}
                </option>
            `;

        });

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// LOAD MASTER BARANG
// =====================================

async function loadBarang() {

    try {

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("kode_barang");

        if (error) throw error;

        const tbody =
            document.querySelector("#tableBarang tbody");

        tbody.innerHTML = "";

        data.forEach(item => {

            tbody.innerHTML += `

            <tr>

                <td>${item.kode_barang}</td>

                <td>${item.nama_barang}</td>

                <td>${item.kategori}</td>

                <td>${item.satuan}</td>

                <td>${item.created_by ?? "-"}</td>

                <td>

                    <button
                    class="btn-edit"
                    onclick="editBarang(${item.id})">

                    ✏ Edit

                    </button>

                    <button
                    class="btn-delete"
                    onclick="hapusBarang(${item.id})">

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
// SIMPAN / UPDATE BARANG
// =====================================

const form = document.getElementById("formBarang");

if(form){

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const kode = document
            .getElementById("kode_barang")
            .value
            .trim()
            .toUpperCase();

        const barang = {

            kode_barang : kode,

            nama_barang :
                document.getElementById("nama_barang").value.trim(),

            kategori :
                document.getElementById("kategori").value,

            satuan :
                document.getElementById("satuan").value,

            created_by : user.nama

        };

        // =====================================
        // UPDATE
        // =====================================

        if(editId !== null){

            const { error } = await supabaseClient

                .from("master_barang")

                .update({

                    nama_barang : barang.nama_barang,

                    kategori : barang.kategori,

                    satuan : barang.satuan

                })

                .eq("id", editId);

            if(error) throw error;

            alert("Master Barang berhasil diupdate.");

            batalEdit();

            loadBarang();

            return;

        }

        // =====================================
        // VALIDASI KODE
        // =====================================

        const { data: cek } = await supabaseClient

            .from("master_barang")

            .select("id")

            .eq("kode_barang", kode);

        if(cek.length > 0){

            alert("Kode Barang sudah digunakan.");

            return;

        }

        // =====================================
        // INSERT
        // =====================================

        const { error } = await supabaseClient

            .from("master_barang")

            .insert([barang]);

        if(error) throw error;

        alert("Master Barang berhasil disimpan.");

        form.reset();

        loadBarang();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// EDIT BARANG
// =====================================

async function editBarang(id){

    try{

        const { data, error } = await supabaseClient

            .from("master_barang")

            .select("*")

            .eq("id", id)

            .single();

        if(error) throw error;

        editId = id;

        document.getElementById("kode_barang").value =
            data.kode_barang;

        document.getElementById("nama_barang").value =
            data.nama_barang;

        document.getElementById("kategori").value =
            data.kategori;

        document.getElementById("satuan").value =
            data.satuan;

        // Kode barang tidak boleh diubah
        document.getElementById("kode_barang").readOnly = true;

        document.getElementById("judulForm").innerHTML =
            "✏ Edit Barang";

        document.getElementById("btnSimpan").innerHTML =
            "💾 Update Barang";

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

    document.getElementById("kode_barang").readOnly = false;

    document.getElementById("judulForm").innerHTML =
        "➕ Tambah Barang";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Barang";

    document.getElementById("btnBatal").style.display =
        "none";

}

document
.getElementById("btnBatal")
.addEventListener("click", batalEdit);

// =====================================
// HAPUS BARANG
// =====================================

async function hapusBarang(id){

    if(!confirm("Hapus Master Barang ini?"))
        return;

    try{

        const { error } = await supabaseClient

            .from("master_barang")

            .delete()

            .eq("id", id);

        if(error) throw error;

        alert("Master Barang berhasil dihapus.");

        loadBarang();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel(){

    alert("Fitur Export Excel akan dibuat pada tahap berikutnya.");

}

// =====================================
// IMPORT EXCEL
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

    await loadKategori();

    await loadSatuan();

    await loadBarang();

});
