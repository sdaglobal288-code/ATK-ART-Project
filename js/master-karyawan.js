// =====================================
// MASTER KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

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

        select.innerHTML = `
            <option value="">-- Pilih Departemen --</option>
        `;

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

        select.innerHTML = `
            <option value="">-- Pilih Jabatan --</option>
        `;

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
// LOAD KARYAWAN (GLOBAL)
// =====================================

async function loadKaryawan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .order("nama", { ascending: true });

        if (error) throw error;

        const tbody = document.querySelector("#tableKaryawan tbody");

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

                    <span class="${item.status === "Aktif"
                        ? "badge-success"
                        : "badge-danger"}">

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
// SIMPAN
// =====================================

const form = document.getElementById("formKaryawan");

if (form) {

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try {

        const nik = document.getElementById("nik").value.trim();

        const { data: cek, error: cekError } = await supabaseClient
            .from("master_karyawan")
            .select("id")
            .eq("nik", nik);

        if (cekError) throw cekError;

        if (cek.length > 0) {

            alert("NIK sudah digunakan.");

            return;

        }

        const karyawan = {

            nik: nik,

            nama: document.getElementById("nama").value.trim(),

            gudang: user.gudang,

            departemen: document.getElementById("departemen").value,

            jabatan: document.getElementById("jabatan").value,

            status: document.getElementById("status").value,

            created_by: user.nama

        };

        const { error } = await supabaseClient
            .from("master_karyawan")
            .insert([karyawan]);

        if (error) throw error;

        alert("Karyawan berhasil disimpan.");

        form.reset();

        await loadDepartemen();

        await loadJabatan();

        await loadKaryawan();

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// HAPUS
// =====================================

async function hapusKaryawan(id){

    if(!confirm("Hapus data karyawan?")) return;

    try{

        const { error } = await supabaseClient
            .from("master_karyawan")
            .delete()
            .eq("id",id);

        if(error) throw error;

        loadKaryawan();

    }catch(err){

        alert(err.message);

    }

}

// =====================================
// EDIT
// =====================================

function editKaryawan(id){

    alert("Fitur Edit Karyawan akan dibuat pada tahap berikutnya.");

}

// =====================================
// EXPORT
// =====================================

function exportExcel(){

    alert("Fitur Export Excel akan dibuat.");

}

// =====================================
// IMPORT
// =====================================

const fileImport = document.getElementById("fileImport");

if(fileImport){

fileImport.addEventListener("change",function(){

    alert("Fitur Import Excel akan dibuat.");

});

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded",async()=>{

    await loadDepartemen();

    await loadJabatan();

    await loadKaryawan();

});
