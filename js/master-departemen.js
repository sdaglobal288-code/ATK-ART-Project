// =====================================
// MASTER DEPARTEMEN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;
let allDepartemen = [];   // cache untuk search lokal

// =====================================
// LOAD DEPARTEMEN
// =====================================

async function loadDepartemen() {

    const tbody = document.querySelector("#tableDepartemen tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("master_departemen")
            .select("*")
            .order("kode_departemen", { ascending: true });

        if (error) throw error;

        allDepartemen = data || [];

        renderDepartemen(allDepartemen);

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

function renderDepartemen(list) {

    const tbody = document.querySelector("#tableDepartemen tbody");
    const totalBadge = document.getElementById("totalBadge");

    totalBadge.textContent = `${list.length} item`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    Tidak ada data departemen yang cocok.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    list.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td><span class="kode-pill">${item.kode_departemen}</span></td>
                <td>${item.nama_departemen}</td>
                <td>${item.created_by ?? "-"}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-edit" onclick="editDepartemen(${item.id})">✏ Edit</button>
                        <button class="btn-delete" onclick="hapusDepartemen(${item.id})">🗑 Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    });

}

// =====================================
// SEARCH LOKAL
// =====================================

const searchInput = document.getElementById("searchDepartemen");

if (searchInput) {

    searchInput.addEventListener("input", function () {

        const keyword = this.value.trim().toLowerCase();

        const filtered = allDepartemen.filter(item =>
            item.kode_departemen.toLowerCase().includes(keyword) ||
            item.nama_departemen.toLowerCase().includes(keyword)
        );

        renderDepartemen(filtered);

    });

}

// =====================================
// SIMPAN / UPDATE DEPARTEMEN
// =====================================

const form = document.getElementById("formDepartemen");

if (form) {

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const btnSimpan = document.getElementById("btnSimpan");
        const teksAsli = btnSimpan.innerHTML;

        try {

            const kode = document.getElementById("kode_departemen")
                .value.trim().toUpperCase();

            const nama = document.getElementById("nama_departemen")
                .value.trim();

            if (!kode || !nama) {
                alert("Kode dan Nama Departemen wajib diisi.");
                return;
            }

            btnSimpan.disabled = true;
            btnSimpan.innerHTML = "⏳ Menyimpan...";

            // ===== UPDATE =====
            if (editId !== null) {

                const { data: cekNamaUpdate, error: errCekUpdate } = await supabaseClient
                    .from("master_departemen")
                    .select("id")
                    .ilike("nama_departemen", nama)
                    .neq("id", editId);

                if (errCekUpdate) throw errCekUpdate;

                if (cekNamaUpdate && cekNamaUpdate.length > 0) {
                    alert("Nama Departemen sudah digunakan.");
                    return;
                }

                const { error } = await supabaseClient
                    .from("master_departemen")
                    .update({ nama_departemen: nama })
                    .eq("id", editId);

                if (error) throw error;

                alert("Departemen berhasil diupdate.");
                batalEdit();
                await loadDepartemen();
                return;

            }

            // ===== VALIDASI KODE =====
            const { data: cekKode, error: errCekKode } = await supabaseClient
                .from("master_departemen")
                .select("id")
                .eq("kode_departemen", kode);

            if (errCekKode) throw errCekKode;

            if (cekKode && cekKode.length > 0) {
                alert("Kode Departemen sudah digunakan.");
                return;
            }

            // ===== VALIDASI NAMA =====
            const { data: cekNama, error: errCekNama } = await supabaseClient
                .from("master_departemen")
                .select("id")
                .ilike("nama_departemen", nama);

            if (errCekNama) throw errCekNama;

            if (cekNama && cekNama.length > 0) {
                alert("Nama Departemen sudah digunakan.");
                return;
            }

            // ===== INSERT =====
            const { error } = await supabaseClient
                .from("master_departemen")
                .insert([{
                    kode_departemen: kode,
                    nama_departemen: nama,
                    created_by: user.nama
                }]);

            if (error) throw error;

            alert("Departemen berhasil disimpan.");
            form.reset();
            await loadDepartemen();

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = editId !== null ? "💾 Update Departemen" : teksAsli;
        }

    });

}

// =====================================
// EDIT DEPARTEMEN
// =====================================

async function editDepartemen(id) {

    try {

        const { data, error } = await supabaseClient
            .from("master_departemen")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        editId = id;

        document.getElementById("kode_departemen").value = data.kode_departemen;
        document.getElementById("nama_departemen").value = data.nama_departemen;

        // Kode tidak boleh diubah saat edit
        document.getElementById("kode_departemen").readOnly = true;

        document.getElementById("judulForm").innerHTML = "✏ Edit Departemen";
        document.getElementById("btnSimpan").innerHTML = "💾 Update Departemen";
        document.getElementById("btnBatal").style.display = "inline-block";

        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// BATAL EDIT
// =====================================

function batalEdit() {

    editId = null;
    form.reset();

    document.getElementById("kode_departemen").readOnly = false;
    document.getElementById("judulForm").innerHTML = "➕ Tambah Departemen";
    document.getElementById("btnSimpan").innerHTML = "💾 Simpan Departemen";
    document.getElementById("btnBatal").style.display = "none";

}

const btnBatalEl = document.getElementById("btnBatal");
if (btnBatalEl) {
    btnBatalEl.addEventListener("click", batalEdit);
}

// =====================================
// HAPUS DEPARTEMEN
// =====================================

async function hapusDepartemen(id) {

    if (!confirm("Yakin ingin menghapus Departemen ini?")) return;

    try {

        const { error } = await supabaseClient
            .from("master_departemen")
            .delete()
            .eq("id", id);

        if (error) throw error;

        alert("Departemen berhasil dihapus.");
        await loadDepartemen();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel() {

    if (!allDepartemen.length) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat. Tambahkan script SheetJS di <head> untuk mengaktifkan fitur export.");
        return;
    }

    const rows = allDepartemen.map(item => ({
        "KODE": item.kode_departemen,
        "NAMA DEPARTEMEN": item.nama_departemen,
        "DIBUAT OLEH": item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Departemen");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Departemen_${tanggal}.xlsx`);

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
            alert("Library SheetJS (xlsx) belum dimuat. Tambahkan script SheetJS di <head> untuk mengaktifkan fitur import.");
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
                kode_departemen: String(row.KODE ?? row.kode_departemen ?? "").trim().toUpperCase(),
                nama_departemen: String(row["NAMA DEPARTEMEN"] ?? row.nama_departemen ?? "").trim(),
                created_by: user.nama
            })).filter(item => item.kode_departemen && item.nama_departemen);

            if (!payload.length) {
                alert("Tidak ada baris valid untuk diimport. Pastikan kolom KODE dan NAMA DEPARTEMEN terisi.");
                return;
            }

            const { error } = await supabaseClient
                .from("master_departemen")
                .upsert(payload, { onConflict: "kode_departemen" });

            if (error) throw error;

            alert(`${payload.length} departemen berhasil diimport.`);
            await loadDepartemen();

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
    await loadDepartemen();
});
