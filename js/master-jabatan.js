// =====================================
// MASTER JABATAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;
let allJabatan = [];

// =====================================
// MODAL HELPERS
// =====================================

function bukaModalTambah() {

    editId = null;
    form.reset();

    document.getElementById("kode_jabatan").readOnly = false;
    document.getElementById("judulForm").innerHTML = "➕ Tambah Jabatan";
    document.getElementById("btnSimpan").innerHTML = "💾 Simpan Jabatan";

    document.getElementById("modalJabatan").classList.add("active");
    document.getElementById("kode_jabatan").focus();

}

function tutupModal() {

    document.getElementById("modalJabatan").classList.remove("active");
    editId = null;
    form.reset();
    document.getElementById("kode_jabatan").readOnly = false;

}

// Tutup jika klik area gelap
const modalEl = document.getElementById("modalJabatan");
if (modalEl) {
    modalEl.addEventListener("click", function (e) {
        if (e.target === modalEl) tutupModal();
    });
}

// Tutup dengan Esc
document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modalEl?.classList.contains("active")) {
        tutupModal();
    }
});

// =====================================
// LOAD JABATAN
// =====================================

async function loadJabatan() {

    const tbody = document.querySelector("#tableJabatan tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("master_jabatan")
            .select("*")
            .order("kode_jabatan", { ascending: true });

        if (error) throw error;

        allJabatan = data || [];
        renderJabatan(allJabatan);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    ⚠ Gagal memuat data: ${err.message}
                </td>
            </tr>
        `;
    }

}

// =====================================
// RENDER TABEL
// =====================================

function renderJabatan(list) {

    const tbody = document.querySelector("#tableJabatan tbody");
    const totalBadge = document.getElementById("totalBadge");

    totalBadge.textContent = `${list.length} item`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    Tidak ada data jabatan yang cocok.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    list.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td><span class="kode-pill">${item.kode_jabatan}</span></td>
                <td>${item.nama_jabatan}</td>
                <td>${item.created_by ?? "-"}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-edit" onclick="editJabatan(${item.id})">✏ Edit</button>
                        <button class="btn-delete" onclick="hapusJabatan(${item.id})">🗑 Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    });

}

// =====================================
// SEARCH LOKAL
// =====================================

const searchInput = document.getElementById("searchJabatan");

if (searchInput) {
    searchInput.addEventListener("input", function () {
        const keyword = this.value.trim().toLowerCase();
        const filtered = allJabatan.filter(item =>
            item.kode_jabatan.toLowerCase().includes(keyword) ||
            item.nama_jabatan.toLowerCase().includes(keyword)
        );
        renderJabatan(filtered);
    });
}

// =====================================
// SIMPAN / UPDATE JABATAN
// =====================================

const form = document.getElementById("formJabatan");

if (form) {

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const btnSimpan = document.getElementById("btnSimpan");
        const teksAsli = btnSimpan.innerHTML;

        try {

            const kode = document.getElementById("kode_jabatan")
                .value.trim().toUpperCase();

            const nama = document.getElementById("nama_jabatan")
                .value.trim();

            if (!kode || !nama) {
                alert("Kode dan Nama Jabatan wajib diisi.");
                return;
            }

            btnSimpan.disabled = true;
            btnSimpan.innerHTML = "⏳ Menyimpan...";

            // ===== UPDATE =====
            if (editId !== null) {

                // Cek duplikat nama (exclude id sendiri)
                const { data: cekNama, error: errCekNama } = await supabaseClient
                    .from("master_jabatan")
                    .select("id")
                    .ilike("nama_jabatan", nama)
                    .neq("id", editId);

                if (errCekNama) throw errCekNama;

                if (cekNama && cekNama.length > 0) {
                    alert("Nama Jabatan sudah digunakan.");
                    return;
                }

                const { error } = await supabaseClient
                    .from("master_jabatan")
                    .update({ nama_jabatan: nama })
                    .eq("id", editId);

                if (error) throw error;

                alert("Jabatan berhasil diupdate.");
                tutupModal();
                await loadJabatan();
                return;

            }

            // ===== VALIDASI KODE =====
            const { data: cekKode, error: errCekKode } = await supabaseClient
                .from("master_jabatan")
                .select("id")
                .eq("kode_jabatan", kode);

            if (errCekKode) throw errCekKode;

            if (cekKode && cekKode.length > 0) {
                alert("Kode Jabatan sudah digunakan.");
                return;
            }

            // ===== VALIDASI NAMA =====
            const { data: cekNamaInsert, error: errCekNamaInsert } = await supabaseClient
                .from("master_jabatan")
                .select("id")
                .ilike("nama_jabatan", nama);

            if (errCekNamaInsert) throw errCekNamaInsert;

            if (cekNamaInsert && cekNamaInsert.length > 0) {
                alert("Nama Jabatan sudah digunakan.");
                return;
            }

            // ===== INSERT =====
            const { error } = await supabaseClient
                .from("master_jabatan")
                .insert([{
                    kode_jabatan: kode,
                    nama_jabatan: nama,
                    created_by: user.nama
                }]);

            if (error) throw error;

            alert("Jabatan berhasil disimpan.");
            tutupModal();
            await loadJabatan();

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = editId !== null ? "💾 Update Jabatan" : teksAsli;
        }

    });

}

// =====================================
// EDIT JABATAN
// =====================================

async function editJabatan(id) {

    try {

        const { data, error } = await supabaseClient
            .from("master_jabatan")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        editId = id;

        document.getElementById("kode_jabatan").value = data.kode_jabatan;
        document.getElementById("nama_jabatan").value = data.nama_jabatan;

        // Kode tidak boleh diubah saat edit
        document.getElementById("kode_jabatan").readOnly = true;

        document.getElementById("judulForm").innerHTML = "✏ Edit Jabatan";
        document.getElementById("btnSimpan").innerHTML = "💾 Update Jabatan";

        document.getElementById("modalJabatan").classList.add("active");
        document.getElementById("nama_jabatan").focus();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// HAPUS JABATAN
// =====================================

async function hapusJabatan(id) {

    if (!confirm("Yakin ingin menghapus Jabatan ini?")) return;

    try {

        const { error } = await supabaseClient
            .from("master_jabatan")
            .delete()
            .eq("id", id);

        if (error) throw error;

        alert("Jabatan berhasil dihapus.");
        await loadJabatan();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel() {

    if (!allJabatan.length) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat.");
        return;
    }

    const rows = allJabatan.map(item => ({
        "KODE": item.kode_jabatan,
        "NAMA JABATAN": item.nama_jabatan,
        "DIBUAT OLEH": item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Jabatan");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Jabatan_${tanggal}.xlsx`);

}

// =====================================
// IMPORT EXCEL
// =====================================

const fileImport = document.getElementById("fileImport");

if (fileImport) {

    fileImport.addEventListener("change", async function (e) {

        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === "undefined") {
            alert("Library SheetJS (xlsx) belum dimuat.");
            fileImport.value = "";
            return;
        }

        try {

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (!rows.length) {
                alert("File kosong atau format tidak sesuai.");
                return;
            }

            const payload = rows.map(row => ({
                kode_jabatan: String(row.KODE ?? row.kode_jabatan ?? "").trim().toUpperCase(),
                nama_jabatan: String(row["NAMA JABATAN"] ?? row.nama_jabatan ?? "").trim(),
                created_by: user.nama
            })).filter(item => item.kode_jabatan && item.nama_jabatan);

            if (!payload.length) {
                alert("Tidak ada baris valid. Pastikan kolom KODE dan NAMA JABATAN terisi.");
                return;
            }

            const { error } = await supabaseClient
                .from("master_jabatan")
                .upsert(payload, { onConflict: "kode_jabatan" });

            if (error) throw error;

            alert(`${payload.length} jabatan berhasil diimport.`);
            await loadJabatan();

        } catch (err) {
            console.error(err);
            alert("Gagal import: " + err.message);
        } finally {
            fileImport.value = "";
        }

    });

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
    await loadJabatan();
});
