// =====================================================================
// MASTER LEVEL JABATAN
// Tabel Supabase yang dipakai: master_level_jabatan
// Kolom: id, urutan (int), nama_level (text), created_by (text), created_at
// =====================================================================

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

let dataLevel = [];
let modeForm  = "tambah"; // "tambah" | "edit"
let idEdit    = null;

const tableBody   = () => document.querySelector("#tableLevelJabatan tbody");
const totalBadge  = () => document.getElementById("totalBadge");
const searchInput = document.getElementById("searchLevel");

// =====================================================================
// LOAD DATA
// =====================================================================
async function loadData() {

    const tbody = tableBody();

    try {

        const { data, error } = await supabaseClient
            .from("master_level_jabatan")
            .select("*")
            .order("urutan", { ascending: true });

        if (error) throw error;

        dataLevel = data || [];

        renderTable(dataLevel);

    } catch (err) {

        console.error("Gagal memuat master level jabatan:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">⚠ Gagal memuat data.</td></tr>`;

    }

}

// =====================================================================
// RENDER TABLE
// =====================================================================
function renderTable(list) {

    const tbody = tableBody();

    totalBadge().textContent = `${list.length} item`;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Belum ada data level jabatan.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((item, index) => {

        const isFirst = index === 0;
        const isLast  = index === list.length - 1;

        return `
        <tr>
            <td><span class="urutan-pill">${item.urutan ?? "-"}</span></td>
            <td>${escapeHtml(item.nama_level ?? "-")}</td>
            <td>${escapeHtml(item.created_by ?? "-")}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-move" title="Naikkan urutan" ${isFirst ? "disabled" : ""} onclick="pindahUrutan('${item.id}','naik')">▲</button>
                    <button class="btn-move" title="Turunkan urutan" ${isLast ? "disabled" : ""} onclick="pindahUrutan('${item.id}','turun')">▼</button>
                    <button class="btn-edit" onclick="bukaModalEdit('${item.id}')">✏ Edit</button>
                    <button class="btn-delete" onclick="hapusData('${item.id}')">🗑 Hapus</button>
                </div>
            </td>
        </tr>
        `;

    }).join("");

}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

// =====================================================================
// SEARCH
// =====================================================================
if (searchInput) {
    searchInput.addEventListener("input", function () {
        const q = this.value.trim().toLowerCase();

        if (!q) {
            renderTable(dataLevel);
            return;
        }

        const filtered = dataLevel.filter(item =>
            (item.nama_level || "").toLowerCase().includes(q)
        );

        renderTable(filtered);
    });
}

// =====================================================================
// MODAL TAMBAH / EDIT
// =====================================================================
function bukaModalTambah() {

    modeForm = "tambah";
    idEdit   = null;

    document.getElementById("judulForm").textContent = "➕ Tambah Level Jabatan";
    document.getElementById("nama_level").value = "";

    const urutanBerikutnya = dataLevel.length > 0
        ? Math.max(...dataLevel.map(d => Number(d.urutan) || 0)) + 1
        : 1;

    document.getElementById("urutan").value = urutanBerikutnya;

    document.getElementById("modalLevelJabatan").classList.add("active");

}

function bukaModalEdit(id) {

    const item = dataLevel.find(d => String(d.id) === String(id));
    if (!item) return;

    modeForm = "edit";
    idEdit   = id;

    document.getElementById("judulForm").textContent = "✏ Edit Level Jabatan";
    document.getElementById("urutan").value     = item.urutan ?? "";
    document.getElementById("nama_level").value = item.nama_level ?? "";

    document.getElementById("modalLevelJabatan").classList.add("active");

}

function tutupModal() {
    document.getElementById("modalLevelJabatan").classList.remove("active");
}

// =====================================================================
// SUBMIT FORM (Simpan)
// =====================================================================
document.getElementById("formLevelJabatan").addEventListener("submit", async function (e) {

    e.preventDefault();

    const btnSimpan = document.getElementById("btnSimpan");
    const urutan    = parseInt(document.getElementById("urutan").value, 10);
    const namaLevel = document.getElementById("nama_level").value.trim();

    if (!namaLevel || isNaN(urutan)) return;

    btnSimpan.disabled   = true;
    const teksAsli       = btnSimpan.innerHTML;
    btnSimpan.innerHTML  = "⏳ Menyimpan...";

    try {

        if (modeForm === "tambah") {

            const { error } = await supabaseClient
                .from("master_level_jabatan")
                .insert([{
                    urutan: urutan,
                    nama_level: namaLevel,
                    created_by: user?.nama || user?.name || "System"
                }]);

            if (error) throw error;

        } else {

            const { error } = await supabaseClient
                .from("master_level_jabatan")
                .update({
                    urutan: urutan,
                    nama_level: namaLevel
                })
                .eq("id", idEdit);

            if (error) throw error;

        }

        tutupModal();
        await loadData();

    } catch (err) {

        console.error("Gagal menyimpan level jabatan:", err);
        alert("Gagal menyimpan data. Silakan coba lagi.");

    } finally {

        btnSimpan.disabled  = false;
        btnSimpan.innerHTML = teksAsli;

    }

});

// =====================================================================
// HAPUS
// =====================================================================
async function hapusData(id) {

    const item = dataLevel.find(d => String(d.id) === String(id));
    if (!item) return;

    const konfirmasi = confirm(`Hapus level jabatan "${item.nama_level}"?`);
    if (!konfirmasi) return;

    try {

        const { error } = await supabaseClient
            .from("master_level_jabatan")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await loadData();

    } catch (err) {

        console.error("Gagal menghapus level jabatan:", err);
        alert("Gagal menghapus data. Silakan coba lagi.");

    }

}

// =====================================================================
// PINDAH URUTAN (naik / turun) — tukar nilai urutan dengan tetangganya
// =====================================================================
async function pindahUrutan(id, arah) {

    const index = dataLevel.findIndex(d => String(d.id) === String(id));
    if (index === -1) return;

    const targetIndex = arah === "naik" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= dataLevel.length) return;

    const itemA = dataLevel[index];
    const itemB = dataLevel[targetIndex];

    try {

        const [{ error: errA }, { error: errB }] = await Promise.all([
            supabaseClient.from("master_level_jabatan").update({ urutan: itemB.urutan }).eq("id", itemA.id),
            supabaseClient.from("master_level_jabatan").update({ urutan: itemA.urutan }).eq("id", itemB.id)
        ]);

        if (errA || errB) throw (errA || errB);

        await loadData();

    } catch (err) {

        console.error("Gagal memindahkan urutan:", err);
        alert("Gagal memindahkan urutan. Silakan coba lagi.");

    }

}

// =====================================================================
// EXPORT EXCEL
// =====================================================================
function exportExcel() {

    if (!dataLevel || dataLevel.length === 0) {
        alert("Tidak ada data untuk di-export.");
        return;
    }

    const rows = dataLevel.map(item => ({
        "Urutan": item.urutan,
        "Level Jabatan": item.nama_level,
        "Dibuat Oleh": item.created_by || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Level Jabatan");

    XLSX.writeFile(wb, "master-level-jabatan.xlsx");

}

// =====================================================================
// IMPORT EXCEL
// =====================================================================
document.getElementById("fileImport").addEventListener("change", async function (e) {

    const file = e.target.files[0];
    if (!file) return;

    try {

        const data = await file.arrayBuffer();
        const wb   = XLSX.read(data);
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
            alert("File tidak memiliki data.");
            return;
        }

        const payload = rows.map(r => ({
            urutan: Number(r["Urutan"] ?? r["urutan"] ?? 0),
            nama_level: String(r["Level Jabatan"] ?? r["nama_level"] ?? "").trim(),
            created_by: user?.nama || user?.name || "System"
        })).filter(r => r.nama_level);

        if (payload.length === 0) {
            alert("Tidak ada baris valid untuk diimport.");
            return;
        }

        const konfirmasi = confirm(`Import ${payload.length} data level jabatan dari file ini?`);
        if (!konfirmasi) return;

        const { error } = await supabaseClient
            .from("master_level_jabatan")
            .insert(payload);

        if (error) throw error;

        alert("Import berhasil.");
        await loadData();

    } catch (err) {

        console.error("Gagal import excel:", err);
        alert("Gagal import file. Pastikan format kolom: Urutan, Level Jabatan.");

    } finally {

        e.target.value = "";

    }

});

// =====================================================================
// INIT
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    loadData();
});
