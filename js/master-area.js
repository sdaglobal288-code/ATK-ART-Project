// =====================================
// MASTER AREA
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;
let allArea = [];   // cache untuk search lokal

// =====================================
// MODAL HELPERS
// =====================================

function bukaModalTambah() {

    editId = null;
    form.reset();

    document.getElementById("kode_area").readOnly = false;
    document.getElementById("judulForm").innerHTML = "➕ Tambah Area";
    document.getElementById("btnSimpan").innerHTML = "💾 Simpan Area";

    document.getElementById("modalArea").classList.add("active");

}

function tutupModal() {

    document.getElementById("modalArea").classList.remove("active");
    editId = null;
    form.reset();
    document.getElementById("kode_area").readOnly = false;

}

const modalAreaEl = document.getElementById("modalArea");
if (modalAreaEl) {

    modalAreaEl.addEventListener("click", function (e) {
        if (e.target === modalAreaEl) tutupModal();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modalAreaEl.classList.contains("active")) {
            tutupModal();
        }
    });

}

// =====================================
// LOAD AREA
// =====================================

async function loadArea() {

    const tbody = document.querySelector("#tableArea tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("master_area")
            .select("*")
            .order("kode_area", { ascending: true });

        if (error) throw error;

        allArea = data || [];

        renderArea(allArea);

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

function renderArea(list) {

    const tbody = document.querySelector("#tableArea tbody");
    const totalBadge = document.getElementById("totalBadge");

    totalBadge.textContent = `${list.length} item`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    Tidak ada data area yang cocok.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    list.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td><span class="kode-pill">${item.kode_area}</span></td>
                <td>${item.nama_area}</td>
                <td>${item.created_by ?? "-"}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-edit" onclick="editArea(${item.id})">✏ Edit</button>
                        <button class="btn-delete" onclick="hapusArea(${item.id})">🗑 Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    });

}

// =====================================
// SEARCH LOKAL
// =====================================

const searchInput = document.getElementById("searchArea");

if (searchInput) {

    searchInput.addEventListener("input", function () {

        const keyword = this.value.trim().toLowerCase();

        const filtered = allArea.filter(item =>
            item.kode_area.toLowerCase().includes(keyword) ||
            item.nama_area.toLowerCase().includes(keyword)
        );

        renderArea(filtered);

    });

}

// =====================================
// SIMPAN / UPDATE AREA
// =====================================

const form = document.getElementById("formArea");

if (form) {

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const btnSimpan = document.getElementById("btnSimpan");
        const teksAsli = btnSimpan.innerHTML;

        try {

            const kode = document.getElementById("kode_area")
                .value.trim().toUpperCase();

            const nama = document.getElementById("nama_area")
                .value.trim();

            if (!kode || !nama) {
                alert("Kode dan Nama Area wajib diisi.");
                return;
            }

            btnSimpan.disabled = true;
            btnSimpan.innerHTML = "⏳ Menyimpan...";

            // ===== UPDATE =====
            if (editId !== null) {

                const { data: cekNamaUpdate, error: errCekUpdate } = await supabaseClient
                    .from("master_area")
                    .select("id")
                    .ilike("nama_area", nama)
                    .neq("id", editId);

                if (errCekUpdate) throw errCekUpdate;

                if (cekNamaUpdate && cekNamaUpdate.length > 0) {
                    alert("Nama Area sudah digunakan.");
                    return;
                }

                const { error } = await supabaseClient
                    .from("master_area")
                    .update({ nama_area: nama })
                    .eq("id", editId);

                if (error) throw error;

                alert("Area berhasil diupdate.");
                tutupModal();
                await loadArea();
                return;

            }

            // ===== VALIDASI KODE =====
            const { data: cekKode, error: errCekKode } = await supabaseClient
                .from("master_area")
                .select("id")
                .eq("kode_area", kode);

            if (errCekKode) throw errCekKode;

            if (cekKode && cekKode.length > 0) {
                alert("Kode Area sudah digunakan.");
                return;
            }

            // ===== VALIDASI NAMA =====
            const { data: cekNama, error: errCekNama } = await supabaseClient
                .from("master_area")
                .select("id")
                .ilike("nama_area", nama);

            if (errCekNama) throw errCekNama;

            if (cekNama && cekNama.length > 0) {
                alert("Nama Area sudah digunakan.");
                return;
            }

            // ===== INSERT =====
            const { error } = await supabaseClient
                .from("master_area")
                .insert([{
                    kode_area: kode,
                    nama_area: nama,
                    created_by: user.nama
                }]);

            if (error) throw error;

            alert("Area berhasil disimpan.");
            tutupModal();
            await loadArea();

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = editId !== null ? "💾 Update Area" : teksAsli;
        }

    });

}

// =====================================
// EDIT AREA
// =====================================

async function editArea(id) {

    try {

        const { data, error } = await supabaseClient
            .from("master_area")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        editId = id;

        document.getElementById("kode_area").value = data.kode_area;
        document.getElementById("nama_area").value = data.nama_area;

        // Kode tidak boleh diubah saat edit
        document.getElementById("kode_area").readOnly = true;

        document.getElementById("judulForm").innerHTML = "✏ Edit Area";
        document.getElementById("btnSimpan").innerHTML = "💾 Update Area";

        document.getElementById("modalArea").classList.add("active");

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// HAPUS AREA
// =====================================

async function hapusArea(id) {

    if (!confirm("Yakin ingin menghapus Area ini?")) return;

    try {

        const { error } = await supabaseClient
            .from("master_area")
            .delete()
            .eq("id", id);

        if (error) throw error;

        alert("Area berhasil dihapus.");
        await loadArea();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel() {

    if (!allArea.length) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat. Tambahkan script SheetJS di <head> untuk mengaktifkan fitur export.");
        return;
    }

    const rows = allArea.map(item => ({
        "KODE": item.kode_area,
        "NAMA AREA": item.nama_area,
        "DIBUAT OLEH": item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Area");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Area_${tanggal}.xlsx`);

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
                kode_area: String(row.KODE ?? row.kode_area ?? "").trim().toUpperCase(),
                nama_area: String(row["NAMA AREA"] ?? row.nama_area ?? "").trim(),
                created_by: user.nama
            })).filter(item => item.kode_area && item.nama_area);

            if (!payload.length) {
                alert("Tidak ada baris valid untuk diimport. Pastikan kolom KODE dan NAMA AREA terisi.");
                return;
            }

            const { error } = await supabaseClient
                .from("master_area")
                .upsert(payload, { onConflict: "kode_area" });

            if (error) throw error;

            alert(`${payload.length} area berhasil diimport.`);
            await loadArea();

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
    await loadArea();
});
