// =====================================================================
// MASTER BAGIAN
// Tabel Supabase yang dipakai: master_bagian
// Kolom: id, nama_bagian (text), departemen (text, boleh kosong = umum), created_by, created_at
// Dipakai oleh Master Karyawan (kolom karyawan.bagian menyimpan nama bagian).
// =====================================================================

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

let dataBagian = [];
let daftarDept = [];
let pakaiMap   = {};      // nama bagian (huruf kecil) -> jumlah karyawan yang memakai
let modeForm   = "tambah"; // "tambah" | "edit"
let idEdit     = null;

const tableBody   = () => document.querySelector("#tableBagian tbody");
const totalBadge  = () => document.getElementById("totalBadge");
const searchInput = document.getElementById("searchBagian");
const filterDept  = document.getElementById("filterDept");

function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// =====================================================================
// LOAD DATA
// =====================================================================
async function loadData() {

    const tbody = tableBody();

    try {

        const [b, d, k] = await Promise.all([
            supabaseClient.from("master_bagian").select("*").order("nama_bagian", { ascending: true }),
            supabaseClient.from("master_departemen").select("*").order("nama_departemen"),
            supabaseClient.from("master_karyawan").select("bagian").not("bagian", "is", null)
        ]);

        if (b.error) throw b.error;

        dataBagian = b.data || [];
        daftarDept = (d.data || []).map(x => x.nama_departemen);

        // jumlah pemakaian per bagian (kolom bagian di master_karyawan belum ada = abaikan, jangan gagalkan halaman)
        pakaiMap = {};
        if (!k.error) {
            (k.data || []).forEach(r => {
                const key = String(r.bagian || "").trim().toLowerCase();
                if (key) pakaiMap[key] = (pakaiMap[key] || 0) + 1;
            });
        }

        isiDropdownDept();
        applyFilter();

    } catch (err) {

        console.error("Gagal memuat master bagian:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">⚠ Gagal memuat data: ${escapeHtml(err.message || err)}.<br>Jalankan sql/master_bagian_schema.sql di Supabase terlebih dulu.</td></tr>`;

    }

}

function isiDropdownDept() {

    const selForm   = document.getElementById("departemen");
    const nilaiForm = selForm.value;
    const nilaiFilter = filterDept.value;

    selForm.innerHTML = `<option value="">Semua departemen (umum)</option>` +
        daftarDept.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    filterDept.innerHTML = `<option value="">Semua Departemen</option><option value="__umum">Bagian umum (tanpa departemen)</option>` +
        daftarDept.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");

    selForm.value = nilaiForm;
    filterDept.value = nilaiFilter;

}

// =====================================================================
// RENDER TABLE
// =====================================================================
function renderTable(list) {

    const tbody = tableBody();

    totalBadge().textContent = `${list.length} item`;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada data bagian.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {

        const jumlah = pakaiMap[String(item.nama_bagian || "").trim().toLowerCase()] || 0;

        return `
        <tr>
            <td><strong>${escapeHtml(item.nama_bagian)}</strong></td>
            <td>${item.departemen ? `<span class="pill-dept">${escapeHtml(item.departemen)}</span>` : `<span class="pill-umum">Umum</span>`}</td>
            <td>${jumlah}</td>
            <td>${escapeHtml(item.created_by ?? "-")}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-edit" onclick="bukaModalEdit('${item.id}')">✏ Edit</button>
                    <button class="btn-delete" onclick="hapusData('${item.id}')">🗑 Hapus</button>
                </div>
            </td>
        </tr>
        `;

    }).join("");

}

// =====================================================================
// SEARCH & FILTER
// =====================================================================
function applyFilter() {

    const q = (searchInput.value || "").trim().toLowerCase();
    const d = filterDept.value;

    const filtered = dataBagian.filter(item => {
        const cocokNama = !q || (item.nama_bagian || "").toLowerCase().includes(q);
        const cocokDept = !d || (d === "__umum" ? !item.departemen : item.departemen === d);
        return cocokNama && cocokDept;
    });

    renderTable(filtered);

}

searchInput.addEventListener("input", applyFilter);
filterDept.addEventListener("change", applyFilter);

// =====================================================================
// MODAL TAMBAH / EDIT
// =====================================================================
function bukaModalTambah() {

    modeForm = "tambah";
    idEdit   = null;

    document.getElementById("judulForm").textContent = "➕ Tambah Bagian";
    document.getElementById("nama_bagian").value = "";
    document.getElementById("departemen").value  = filterDept.value && filterDept.value !== "__umum" ? filterDept.value : "";

    document.getElementById("modalBagian").classList.add("active");
    document.getElementById("nama_bagian").focus();

}

function bukaModalEdit(id) {

    const item = dataBagian.find(d => String(d.id) === String(id));
    if (!item) return;

    modeForm = "edit";
    idEdit   = id;

    document.getElementById("judulForm").textContent = "✏ Edit Bagian";
    document.getElementById("nama_bagian").value = item.nama_bagian ?? "";

    // departemen lama yang sudah tidak ada di master tetap ditampilkan agar tidak hilang diam-diam
    const sel = document.getElementById("departemen");
    if (item.departemen && ![...sel.options].some(o => o.value === item.departemen)) {
        sel.innerHTML += `<option value="${escapeHtml(item.departemen)}">${escapeHtml(item.departemen)}</option>`;
    }
    sel.value = item.departemen ?? "";

    document.getElementById("modalBagian").classList.add("active");

}

function tutupModal() {
    document.getElementById("modalBagian").classList.remove("active");
}

document.addEventListener("keydown", e => { if (e.key === "Escape") tutupModal(); });

// =====================================================================
// SUBMIT FORM (Simpan)
// =====================================================================
document.getElementById("formBagian").addEventListener("submit", async function (e) {

    e.preventDefault();

    const btnSimpan = document.getElementById("btnSimpan");
    const nama      = document.getElementById("nama_bagian").value.trim().replace(/\s+/g, " ");
    const dept      = document.getElementById("departemen").value || null;

    if (!nama) return;

    // nama yang sama di departemen yang sama dianggap dobel
    const dobel = dataBagian.some(d =>
        String(d.id) !== String(idEdit) &&
        (d.nama_bagian || "").toLowerCase() === nama.toLowerCase() &&
        (d.departemen || "").toLowerCase() === (dept || "").toLowerCase()
    );
    if (dobel) {
        alert(`Bagian "${nama}" sudah ada${dept ? " di departemen " + dept : " (umum)"}.`);
        return;
    }

    btnSimpan.disabled  = true;
    const teksAsli      = btnSimpan.innerHTML;
    btnSimpan.innerHTML = "⏳ Menyimpan...";

    try {

        if (modeForm === "tambah") {

            const { error } = await supabaseClient
                .from("master_bagian")
                .insert([{ nama_bagian: nama, departemen: dept, created_by: user?.nama || user?.name || "System" }]);

            if (error) throw error;

        } else {

            const lama = dataBagian.find(d => String(d.id) === String(idEdit));

            const { error } = await supabaseClient
                .from("master_bagian")
                .update({ nama_bagian: nama, departemen: dept })
                .eq("id", idEdit);

            if (error) throw error;

            // nama bagian berubah -> ikutkan karyawan yang memakainya, supaya data tetap sinkron
            if (lama && lama.nama_bagian !== nama) {
                const { error: errK } = await supabaseClient
                    .from("master_karyawan")
                    .update({ bagian: nama })
                    .eq("bagian", lama.nama_bagian);
                if (errK) console.warn("Nama bagian pada master karyawan tidak ikut diperbarui:", errK.message);
            }

        }

        tutupModal();
        await loadData();

    } catch (err) {

        console.error("Gagal menyimpan bagian:", err);
        alert("Gagal menyimpan data:\n" + (err?.message || "Error tidak diketahui, cek console (F12)."));

    } finally {

        btnSimpan.disabled  = false;
        btnSimpan.innerHTML = teksAsli;

    }

});

// =====================================================================
// HAPUS (diblokir bila masih dipakai karyawan)
// =====================================================================
async function hapusData(id) {

    const item = dataBagian.find(d => String(d.id) === String(id));
    if (!item) return;

    const dipakai = pakaiMap[String(item.nama_bagian || "").trim().toLowerCase()] || 0;
    if (dipakai > 0) {
        alert(`Bagian "${item.nama_bagian}" masih dipakai ${dipakai} karyawan.\nPindahkan karyawannya ke bagian lain di Master Karyawan terlebih dulu.`);
        return;
    }

    if (!confirm(`Hapus bagian "${item.nama_bagian}"?`)) return;

    try {

        const { error } = await supabaseClient.from("master_bagian").delete().eq("id", id);
        if (error) throw error;

        await loadData();

    } catch (err) {

        console.error("Gagal menghapus bagian:", err);
        alert("Gagal menghapus data:\n" + (err?.message || "Error tidak diketahui, cek console (F12)."));

    }

}

// =====================================================================
// EXPORT EXCEL
// =====================================================================
function exportExcel() {

    if (!dataBagian.length) {
        alert("Tidak ada data untuk di-export.");
        return;
    }

    const rows = dataBagian.map(item => ({
        "Bagian": item.nama_bagian,
        "Departemen": item.departemen || "",
        "Dibuat Oleh": item.created_by || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Bagian");
    XLSX.writeFile(wb, "master-bagian.xlsx");

}

// =====================================================================
// IMPORT EXCEL  (kolom: Bagian, Departemen — Departemen boleh kosong)
// Bagian yang sudah ada (nama + departemen sama) dilewati, tidak ditimpa.
// =====================================================================
document.getElementById("fileImport").addEventListener("change", async function (e) {

    const file = e.target.files[0];
    if (!file) return;

    try {

        const wb   = XLSX.read(await file.arrayBuffer());
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        if (!rows.length) {
            alert("File tidak memiliki data.");
            return;
        }

        const kunci = (n, d) => `${String(n).toLowerCase()}|${String(d || "").toLowerCase()}`;
        const sudah = new Set(dataBagian.map(d => kunci(d.nama_bagian, d.departemen)));
        const deptAda = new Set(daftarDept.map(d => d.toLowerCase()));

        const baru = [], tidakDikenal = new Set();
        rows.forEach(r => {
            const nama = String(r["Bagian"] ?? r["BAGIAN"] ?? r["nama_bagian"] ?? "").trim().replace(/\s+/g, " ");
            let dept   = String(r["Departemen"] ?? r["DEPARTEMEN"] ?? r["departemen"] ?? "").trim();
            if (!nama) return;
            // samakan penulisan dengan master departemen; yang tidak dikenal dicatat
            const cocok = daftarDept.find(d => d.toLowerCase() === dept.toLowerCase());
            if (dept && !cocok && !deptAda.has(dept.toLowerCase())) tidakDikenal.add(dept);
            dept = cocok || dept;
            const k = kunci(nama, dept);
            if (sudah.has(k)) return;
            sudah.add(k);
            baru.push({ nama_bagian: nama, departemen: dept || null, created_by: user?.nama || user?.name || "System" });
        });

        if (!baru.length) {
            alert("Tidak ada bagian baru. Semua baris sudah ada atau kosong.");
            return;
        }

        let pesan = `Import ${baru.length} bagian baru dari file ini?`;
        if (tidakDikenal.size) pesan += `\n\nPeringatan: departemen berikut tidak ada di Master Departemen:\n${[...tidakDikenal].slice(0, 10).join("\n")}`;
        if (!confirm(pesan)) return;

        const { error } = await supabaseClient.from("master_bagian").insert(baru);
        if (error) throw error;

        alert("Import berhasil.");
        await loadData();

    } catch (err) {

        console.error("Gagal import excel:", err);
        alert("Gagal import file. Pastikan format kolom: Bagian, Departemen.\n" + (err?.message || ""));

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
