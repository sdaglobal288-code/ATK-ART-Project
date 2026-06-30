// =====================================
// MASTER KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// =====================================
// MODE EDIT
// =====================================

let editId = null;

// =====================================
// LOAD DEPARTEMEN
// =====================================

async function loadDepartemen() {

    try {

        const { data, error } = await supabaseClient
            .from("master_departemen")
            .select("*")
            .order("nama_departemen");

        if (error) throw error;

        const select = document.getElementById("departemen");

        if (!select) return;

        select.innerHTML =
            `<option value="">-- Pilih Departemen --</option>`;

        data.forEach(item => {

            select.innerHTML += `
                <option value="${item.nama_departemen}">
                    ${item.nama_departemen}
                </option>
            `;

        });

    } catch (err) {

        console.error("Load Departemen :", err);

    }

}

// =====================================
// LOAD JABATAN
// =====================================

async function loadJabatan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_jabatan")
            .select("*")
            .order("nama_jabatan");

        if (error) throw error;

        const select = document.getElementById("jabatan");

        if (!select) return;

        select.innerHTML =
            `<option value="">-- Pilih Jabatan --</option>`;

        data.forEach(item => {

            select.innerHTML += `
                <option value="${item.nama_jabatan}">
                    ${item.nama_jabatan}
                </option>
            `;

        });

    } catch (err) {

        console.error("Load Jabatan :", err);

    }

}

// =====================================
// LOAD KARYAWAN
// =====================================

async function loadKaryawan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .order("nama", {
                ascending: true
            });

        if (error) throw error;

        const tbody =
            document.querySelector("#tableKaryawan tbody");

        if (!tbody) return;

        tbody.innerHTML = "";

        data.forEach(item => {

            tbody.innerHTML += `

            <tr>

                <td>${item.nik}</td>

                <td>${item.nama}</td>

                <td>${item.gudang || "-"}</td>

                <td>${item.departemen}</td>

                <td>${item.jabatan}</td>

                <td>

                    <span class="${
                        item.status === "Aktif"
                        ? "badge-success"
                        : "badge-danger"
                    }">

                        ${item.status}

                    </span>

                </td>

                <td>${item.created_by || "-"}</td>

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

    } catch (err) {

        console.error("Load Karyawan :", err);

    }

}

// =====================================
// SIMPAN / UPDATE
// =====================================

const form = document.getElementById("formKaryawan");

if (form) {

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        const nik = document.getElementById("nik").value.trim();

        const nama = document.getElementById("nama").value.trim();

        const departemen =
            document.getElementById("departemen").value;

        const jabatan =
            document.getElementById("jabatan").value;

        const status =
            document.getElementById("status").value;

        // ===============================
        // UPDATE
        // ===============================

        if(editId!==null){

            const { error } = await supabaseClient
            .from("master_karyawan")
            .update({

                nama:nama,

                status:status

            })
            .eq("id",editId);

            if(error) throw error;

            alert("Data berhasil diupdate.");

            batalEdit();

            await loadKaryawan();

            return;

        }

        // ===============================
        // VALIDASI NIK
        // ===============================

        const { data:cek,error:cekError } =
        await supabaseClient
        .from("master_karyawan")
        .select("id")
        .eq("nik",nik);

        if(cekError) throw cekError;

        if(cek.length>0){

            alert("NIK sudah digunakan.");

            return;

        }

        // ===============================
        // INSERT
        // ===============================

        const { error } = await supabaseClient
        .from("master_karyawan")
        .insert([{

            nik:nik,

            nama:nama,

            gudang:user.gudang,

            departemen:departemen,

            jabatan:jabatan,

            status:status,

            created_by:user.nama

        }]);

        if(error) throw error;

        alert("Karyawan berhasil disimpan.");

        form.reset();

        await loadKaryawan();

    }catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// EDIT
// =====================================

async function editKaryawan(id){

    try{

        const { data,error } = await supabaseClient

        .from("master_karyawan")

        .select("*")

        .eq("id",id)

        .single();

        if(error) throw error;

        editId=id;

        document.getElementById("nik").value=data.nik;
        document.getElementById("nama").value=data.nama;
        document.getElementById("departemen").value=data.departemen;
        document.getElementById("jabatan").value=data.jabatan;
        document.getElementById("status").value=data.status;

        document.getElementById("nik").readOnly=true;

        document.getElementById("departemen").disabled=true;
        document.getElementById("jabatan").disabled=true;

        document.getElementById("judulForm").innerHTML=
        "✏ Edit Karyawan";

        document.getElementById("btnSimpan").innerHTML=
        "💾 Update Karyawan";

        document.getElementById("btnBatal").style.display=
        "inline-block";

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    }catch(err){

        alert(err.message);

    }

}

// =====================================
// BATAL EDIT
// =====================================

function batalEdit(){

    editId=null;

    form.reset();

    document.getElementById("nik").readOnly=false;

    document.getElementById("departemen").disabled=false;

    document.getElementById("jabatan").disabled=false;

    document.getElementById("judulForm").innerHTML=
    "➕ Tambah Karyawan";

    document.getElementById("btnSimpan").innerHTML=
    "💾 Simpan Karyawan";

    document.getElementById("btnBatal").style.display=
    "none";

}

document
.getElementById("btnBatal")
.addEventListener("click",batalEdit);

// =====================================
// HAPUS
// =====================================

async function hapusKaryawan(id){

    if(!confirm("Yakin ingin menghapus karyawan ini?"))
        return;

    try{

        const { error } = await supabaseClient
            .from("master_karyawan")
            .delete()
            .eq("id",id);

        if(error) throw error;

        alert("Data berhasil dihapus.");

        await loadKaryawan();

    }catch(err){

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
// REFRESH FORM
// =====================================

function resetForm(){

    editId = null;

    form.reset();

    document.getElementById("nik").readOnly = false;

    document.getElementById("departemen").disabled = false;

    document.getElementById("jabatan").disabled = false;

    document.getElementById("judulForm").innerHTML =
        "➕ Tambah Karyawan";

    document.getElementById("btnSimpan").innerHTML =
        "💾 Simpan Karyawan";

    document.getElementById("btnBatal").style.display =
        "none";

}

// =====================================
// RELOAD MASTER
// =====================================

async function reloadMaster(){

    await loadDepartemen();

    await loadJabatan();

    await loadKaryawan();

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded",async()=>{

    try{

        await reloadMaster();

    }catch(err){

        console.error(err);

    }

});

// =====================================
// SELESAI
// =====================================
